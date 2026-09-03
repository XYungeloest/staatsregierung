#!/usr/bin/env node --experimental-strip-types

// Muss vor allen @ostrecht-Importen stehen (SITE_TARGET=law für die Routenhelfer).
import './lib/law-site-env.mjs';

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { buildDerivedContext, deriveNorm, fullCitationFor } from '@ostrecht/shared/lib/norms/derived.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { getSubjectAreaGroups, getSubjectGroups, getSubjectSlug } from '@ostrecht/shared/lib/norms/routes.ts';
import { classifyNormVersion, getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { getPressReleaseUrl, getTopicUrl } from '@ostrecht/shared/lib/portal/routes.ts';
import { loadPressReleases, loadTopics } from '@ostrecht/shared/lib/portal/content.ts';
import { buildFilterOptions, buildSearchDocument, buildSearchPublications, getNormAliases } from '@ostrecht/recht-search/search.ts';

import { metaIdentityChanged, normsCitingPublications, scopeFromChangedPaths } from './lib/d1-sync-scope.mjs';
import { projectionFingerprint } from './lib/d1-projection-fingerprint.mjs';
import { SEARCH_UNIT_COLUMNS, searchIndexResetStatements } from './lib/d1-search-schema.mjs';

/**
 * Spiegelt content/normen und content/verkuendungen nach Cloudflare D1 – die
 * abgeleitete Runtime-Projektion von OstRecht. Git bleibt fachlicher Source of
 * Truth; alle korpusweiten Ableitungen (Beziehungen, Empfehlungen, Herkunft,
 * Textverweise, Vollzitate, Verkündungsbezüge, Portalbezüge) werden hier aus dem
 * vollständigen Bestand berechnet und je Norm gespeichert, damit die Website zur
 * Laufzeit nur die Zeilen der angefragten Norm lesen muss.
 *
 * Schema: data/recht/d1/0001_rechtsbestand.sql … 0005_search_units.sql.
 *
 * Kostenmodell (D1 rechnet gelesene und geschriebene Zeilen ab):
 *   - Inkrementell werden je Norm nur ihre eigenen Zeilen gelöscht und neu geschrieben.
 *     Alle Löschungen laufen über Indizes (Primärschlüssel norm_id bzw.
 *     idx_law_search_units_norm); der Volltextindex law_search ist ein FTS5-Index mit
 *     externem Inhalt über law_search_units und wird per Trigger rowid-genau geführt.
 *     Es gibt keinen Vollscan des Suchindex mehr (bis 0004: „DELETE FROM law_search
 *     WHERE norm_id = ?“ auf einer UNINDEXED-Spalte, ≈38.000 gelesene Zeilen je Norm).
 *   - Die Vollprojektion (--full) leert alle Tabellen einmalig in fremdschlüssel-
 *     sicherer Reihenfolge (Suchindex per FTS5-„delete-all“ ohne Zeilenlauf), schreibt
 *     den gesamten Bestand ohne normweise Löschungen oder NOT-IN-Aufräumläufe und setzt
 *     die Laufzeitmetadaten erst am erfolgreichen Ende. Ein abgebrochener Lauf wird
 *     durch Wiederholung vollständig repariert.
 *   - Der Fingerabdruck der Projektion (scripts/lib/d1-projection-fingerprint.mjs:
 *     Projektionslogik + Rechtsbestand + Portalgrundlagen, reine Inhaltshashes) wird
 *     vor jedem Lauf mit law_runtime_meta verglichen; bei Gleichheit endet der Sync
 *     ohne Schreibzugriff (No-op). --ignore-fingerprint erzwingt den Lauf.
 *   - Der API-Transport summiert Abfragen, Batches, rows_read, rows_written und Dauer
 *     aus den D1-Antworten; --max-rows-read / --max-rows-written brechen den Lauf ab,
 *     sobald das Budget überschritten ist. --dry-run schätzt Umfang und Anweisungen.
 *
 * Transport:
 *   --transport api       D1-REST-API mit parametrisierten Batches (CLOUDFLARE_API_TOKEN)
 *   --transport wrangler  SQL-Dateien unter .cache/d1-sync/ und
 *                         `wrangler d1 execute ostrecht-recht --remote --file` mit der
 *                         lokalen Wrangler-Anmeldung; Parameter werden als SQL-Literale
 *                         gerendert, Blöcke über 40.000 Zeichen in Teile zerlegt.
 * Ohne Angabe wird die API verwendet, wenn ein Token gesetzt ist, sonst Wrangler.
 *
 * Umfang (genau eine Angabe ist Pflicht; ohne Angabe bricht der Sync ab):
 *   --full                      Vollprojektion aller Normen und Verkündungen (Initialimport,
 *                               Recovery, bewusste Neuprojektion)
 *   --slug <slug> …             nur diese Normen (vollständig: Fassungen, Körper, Quellen,
 *                               abgeleitete Daten, Suchindex)
 *   --delete <slug> …           diese Normen samt abhängiger Zeilen aus D1 entfernen
 *   --publications              Verkündungstabelle neu schreiben
 *   --git-diff <base> <head>    Umfang aus dem Git-Diff bestimmen (scripts/lib/d1-sync-scope.mjs):
 *                               betroffene, neue und gelöschte Normen, geänderte Verkündungen und
 *                               deren Normen, Vollprojektion bei geänderter Projektionslogik;
 *                               abgeleitete Daten aller Normen werden nur neu geschrieben, wenn
 *                               sich die Identität einer Norm geändert hat oder Normen hinzukamen
 *                               bzw. entfielen (Beziehungen, Empfehlungen und Textverweise
 *                               anderer Normen hängen davon ab)
 *   --changed-paths <Datei>     wie --git-diff, mit einer Pfadliste (eine Zeile je Pfad; gelöschte
 *                               Normen werden am fehlenden Verzeichnis erkannt, Identitäts-
 *                               änderungen gelten als gegeben)
 *   --database <Name>           Zieldatenbank des Wrangler-Transports (Standard ostrecht-recht;
 *                               Staging: ostrecht-recht-staging)
 *   --corpus-filter <Datei>     nur lokal: beschränkt den geladenen Bestand auf die Slugs der
 *                               JSON-Datei ({ "slugs": [...] }) – Testfixture für Browser- und
 *                               A11y-Smoke (data/recht/runtime-fixture.json); Ableitungen und
 *                               Übersichtsmetadaten beziehen sich dann auf dieses Fixture
 *
 * Lokale Projektion (Wrangler-Transport): `--local [--persist-to <Verzeichnis>]` schreibt in
 * die lokale D1-Datenbank von Miniflare (Standard .cache/wrangler-local), `--apply-schema`
 * spielt davor die Migrationen aus data/recht/d1/ ein. Damit laufen Browser-Smoke-Tests und
 * lokale Entwicklung gegen `wrangler dev --local` ohne Cloudflare-Anmeldung; die produktive
 * Datenbank erhält Migrationen weiterhin nur manuell (zuerst lokal, dann Staging).
 */

const ROOT = resolve(process.cwd());
const MAX_BLOCK_PART_CHARS = 40_000;
const MAX_SEARCH_BODY_CHARS = 40_000;
const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_SQL_FILE_STATEMENTS = 1500;
const DEFAULT_SQL_FILE_BYTES = 6_000_000;
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '28871b9b1c6753235a331544f7c68460';
const DEFAULT_D1_DATABASE_ID = '2491f200-de20-4a45-b028-d00a4fd57840';
const D1_DATABASE_NAME = process.env.OSTRECHT_D1_DATABASE_NAME ?? 'ostrecht-recht';
const RUNTIME_META_KEYS = ['last_sync_at', 'norm_count', 'publication_count', 'corpus_hash', 'projection_fingerprint', 'projection_logic_hash', 'corpus_content_hash', 'sync_mode', 'search_filters_json', 'search_document_count', 'search_publications_json', 'subject_groups_json', 'subject_areas_json', 'corpus_stats_json'];
const execFileAsync = promisify(execFile);

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
}

function integerAfter(args, flag) {
  const raw = valueAfter(args, flag);
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${flag} braucht eine nicht negative Ganzzahl`);
  return value;
}

function q(sql, params = []) {
  return { sql, params };
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/gu, "''")}'`;
}

/** Rendert eine parametrisierte Abfrage als eigenständige SQL-Anweisung. */
export function renderStatement({ sql, params = [] }) {
  let index = 0;
  const rendered = sql.replace(/\?/gu, () => {
    if (index >= params.length) throw new Error('SQL-Anweisung hat mehr Platzhalter als Parameter');
    const literal = sqlLiteral(params[index]);
    index += 1;
    return literal;
  });
  if (index !== params.length) throw new Error('SQL-Anweisung hat weniger Platzhalter als Parameter');
  return `${rendered.trim().replace(/;+$/u, '')};`;
}

/** Fasst Anweisungen normweise zu SQL-Dateien zusammen, ohne eine Norm zu zerteilen. */
export function groupStatementFiles(normStatements, { maxStatements = DEFAULT_SQL_FILE_STATEMENTS, maxBytes = DEFAULT_SQL_FILE_BYTES } = {}) {
  const files = [];
  let current = { statements: [], bytes: 0, slugs: [] };
  const flush = () => {
    if (current.statements.length > 0) files.push(current);
    current = { statements: [], bytes: 0, slugs: [] };
  };
  for (const { slug, statements } of normStatements) {
    const bytes = statements.reduce((sum, statement) => sum + Buffer.byteLength(statement, 'utf8') + 1, 0);
    if (current.statements.length > 0 && (current.statements.length + statements.length > maxStatements || current.bytes + bytes > maxBytes)) {
      flush();
    }
    current.statements.push(...statements);
    current.bytes += bytes;
    current.slugs.push(slug);
  }
  flush();
  return files;
}

/** Zerlegt einen JSON-Text in Teile fester Zeichenlänge (D1 begrenzt die Anweisungslänge). */
export function splitBlockJson(json, maxChars = MAX_BLOCK_PART_CHARS) {
  if (json.length <= maxChars) return [json];
  const parts = [];
  for (let offset = 0; offset < json.length; offset += maxChars) parts.push(json.slice(offset, offset + maxChars));
  return parts;
}

function stripBody(version) {
  const { body, ...rest } = version;
  return rest;
}

function searchUnits(record, version, context) {
  const publicationReference = context.publicationReferences.get(`${record.meta.slug}:${version.versionId}`);
  const document = buildSearchDocument(record, version, context.lookup, publicationReference);
  const { hitUnits, bodySupplement, ...metadata } = document;
  const units = hitUnits.map((unit, index) => ({
    unitIndex: index,
    path: unit.anchor,
    anchor: unit.anchor,
    blockType: unit.type,
    label: unit.label,
    heading: unit.title,
    body: unit.text.slice(0, MAX_SEARCH_BODY_CHARS),
    references: unit.references ?? null,
  }));
  if (bodySupplement) {
    units.push({ unitIndex: units.length, path: 'supplement', anchor: '', blockType: 'supplement', label: '', heading: '', body: bodySupplement.slice(0, MAX_SEARCH_BODY_CHARS), references: null });
  }
  return { metadata, units };
}

/** Jüngstes Datum aus Fassungsbeginn und Historie (Sitemap-lastmod, Übersichten). */
export function lastChangeDate(norm) {
  return [...norm.versions.map((version) => version.validFrom), ...norm.history.entries.map((entry) => entry.date)].sort().at(-1) ?? null;
}

const NORM_COLUMNS = [
  'id', 'slug', 'title', 'short_title', 'abbr', 'type', 'status', 'revosax_law_id', 'current_version_id',
  'document_date', 'publication_date', 'effective_date', 'expiry_date', 'initial_citation', 'summary',
  'responsible_ministry', 'enacting_body', 'source_kind', 'updated_at', 'meta_json', 'history_json', 'sort_title', 'current_valid_from',
  'subjects_json', 'primary_subject', 'keywords_json', 'aliases_json', 'origin_kind', 'origin_baseline_version_id', 'origin_last_own_change_date', 'version_count', 'last_change_date',
];

/**
 * Anweisungen einer Norm. Inkrementell werden zuerst die eigenen Zeilen der Norm über
 * Indizes gelöscht; in der Vollprojektion sind alle Tabellen bereits leer, dann entfallen
 * die Löschungen vollständig.
 */
export function normQueries(norm, context, now, { full = false } = {}) {
  const { meta, history, versions } = norm;
  const current = getApplicableVersion(norm);
  const currentIdentity = getNormVersionIdentity(norm, current);
  const derived = deriveNorm(norm, context);
  const sourceOf = (version) => (version.sourceReferences ?? []).find((source) => source.kind === 'revosax-snapshot') ?? (version.sourceReferences ?? [])[0] ?? null;
  const lawId = [...(current.sourceReferences ?? []), ...(meta.sourceReferences ?? [])].map((source) => source.lawId).find(Boolean) ?? null;
  const sourceKind = [...(current.sourceReferences ?? []), ...(meta.sourceReferences ?? [])].some((source) => source.kind === 'revosax-snapshot') ? 'revosax-baseline' : 'repository';
  const queries = full ? [] : [
    q('DELETE FROM law_search_units WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_norm_subjects WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_norm_history WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_source_objects WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_version_blocks WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_versions WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_norm_derived WHERE norm_id = ?', [meta.id]),
  ];
  const updates = NORM_COLUMNS.filter((column) => column !== 'id').map((column) => `${column}=excluded.${column}`).join(', ');
  queries.push(q(`INSERT INTO law_norms (${NORM_COLUMNS.join(', ')}) VALUES (${NORM_COLUMNS.map(() => '?').join(', ')})
    ON CONFLICT(id) DO UPDATE SET ${updates}`, [
    meta.id, meta.slug, currentIdentity.title, currentIdentity.shortTitle, currentIdentity.abbr ?? null, meta.type, meta.status,
    lawId, current.versionId, meta.documentDate ?? null, meta.publicationDate ?? null,
    meta.effectiveDate ?? null, meta.expiryDate ?? null, meta.initialCitation, meta.summary,
    meta.responsibleMinistry ?? meta.ministry ?? null, meta.enactingBody ?? null, sourceKind, now,
    JSON.stringify(meta), JSON.stringify(history), currentIdentity.title.toLocaleLowerCase('de'), current.validFrom,
    JSON.stringify(meta.subjects), meta.primarySubject ?? null, JSON.stringify(meta.keywords), JSON.stringify(getNormAliases(norm, currentIdentity)),
    derived.origin.kind, derived.origin.baselineVersionId ?? null, derived.origin.lastOwnChangeDate ?? null, versions.length, lastChangeDate(norm),
  ]));

  for (const version of versions) {
    const primarySource = sourceOf(version);
    const publicationReference = context.publicationReferences.get(`${meta.slug}:${version.versionId}`) ?? null;
    queries.push(q(`INSERT INTO law_versions (
      norm_id, version_id, valid_from, valid_to, is_current, title, short_title, abbr, summary,
      citation, change_note, source_sha256, source_url, source_retrieved_at, source_object_key, updated_at,
      version_json, full_citation, publication_ref_json, temporal_kind
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      meta.id, version.versionId, version.validFrom, version.validTo ?? null, version.isCurrent ? 1 : 0,
      version.title ?? null, version.shortTitle ?? null, version.abbr ?? null, version.summary ?? null,
      version.citation, version.changeNote, primarySource?.sha256 ?? null, primarySource?.url ?? null,
      primarySource?.retrievedAt ?? null, primarySource?.objectKey ?? null, now,
      JSON.stringify(stripBody(version)), fullCitationFor(norm, version, context),
      publicationReference ? JSON.stringify(publicationReference) : null, classifyNormVersion(norm, version),
    ]));

    for (const [blockIndex, block] of version.body.entries()) {
      const parts = splitBlockJson(JSON.stringify(block));
      for (const [partIndex, part] of parts.entries()) {
        queries.push(q(
          'INSERT INTO law_version_blocks (norm_id, version_id, block_index, part_index, part_count, block_json) VALUES (?, ?, ?, ?, ?, ?)',
          [meta.id, version.versionId, blockIndex, partIndex, parts.length, part],
        ));
      }
    }

    for (const [sourceIndex, source] of (version.sourceReferences ?? []).entries()) {
      queries.push(q(`INSERT INTO law_source_objects (
        norm_id, version_id, source_index, kind, label, url, local_source, object_key, media_type,
        sha256, retrieved_at, source_valid_from, source_valid_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        meta.id, version.versionId, sourceIndex, source.kind, source.label, source.url ?? null,
        source.localSource ?? null, source.objectKey ?? null, source.mediaType ?? null, source.sha256 ?? null,
        source.retrievedAt ?? null, source.sourceValidFrom ?? null, source.sourceValidTo ?? null,
      ]));
    }
  }

  queries.push(q(`INSERT INTO law_norm_derived (
    norm_id, relations_json, recommendations_json, origin_json, text_references_json, portal_links_json, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    meta.id, JSON.stringify(derived.relations), JSON.stringify(derived.recommendations), JSON.stringify(derived.origin),
    JSON.stringify(derived.textReferences), JSON.stringify(derived.portalLinks), now,
  ]));

  const subjectSlugs = new Set();
  for (const subject of meta.subjects) {
    const subjectSlug = getSubjectSlug(subject);
    if (subjectSlugs.has(subjectSlug)) continue;
    subjectSlugs.add(subjectSlug);
    queries.push(q('INSERT INTO law_norm_subjects (norm_id, subject, subject_slug) VALUES (?, ?, ?)', [meta.id, subject, subjectSlug]));
  }
  for (const [entryIndex, entry] of history.entries.entries()) {
    queries.push(q(`INSERT INTO law_norm_history (
      norm_id, entry_index, change_date, change_type, title, citation, note, affecting_version_id, related_norm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      meta.id, entryIndex, entry.date, entry.type, entry.title, entry.citation, entry.note ?? null,
      entry.affectingVersionId ?? null, entry.relatedNorm ?? null,
    ]));
  }

  // Suchindex: nur die geltende Fassung, provisionsgenau. Die Metadaten des
  // Suchdokuments werden je Fassung gespeichert, damit historische und künftige
  // Fassungen weiterhin über Titel, Fundstelle und Metadaten auffindbar bleiben.
  for (const version of versions) {
    const { metadata, units } = searchUnits(norm, version, context);
    queries.push(q(
      'INSERT INTO law_search_documents (norm_id, version_id, document_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(norm_id, version_id) DO UPDATE SET document_json=excluded.document_json, updated_at=excluded.updated_at',
      [meta.id, version.versionId, JSON.stringify(metadata), now],
    ));
    if (version.versionId !== current.versionId) continue;
    for (const unit of units) {
      // Der Volltextindex folgt per Trigger (scripts/lib/d1-search-schema.mjs).
      queries.push(q(`INSERT INTO law_search_units (${SEARCH_UNIT_COLUMNS.join(', ')}) VALUES (${SEARCH_UNIT_COLUMNS.map(() => '?').join(', ')})`, [
        meta.id, current.versionId, `${unit.unitIndex}`, unit.anchor, unit.blockType, unit.references ? JSON.stringify(unit.references) : null,
        meta.slug, currentIdentity.title, currentIdentity.shortTitle, currentIdentity.abbr ?? '', unit.label, unit.heading, unit.body,
      ]));
    }
  }

  return queries;
}

/** Entfernt eine Norm mit allen abhängigen Zeilen; jede Löschung läuft über den Index norm_id. */
export function deleteNormQueries(slug) {
  const byNorm = 'norm_id IN (SELECT id FROM law_norms WHERE slug = ?)';
  return [
    q(`DELETE FROM law_search_units WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_norm_subjects WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_norm_history WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_search_documents WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_norm_derived WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_source_objects WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_version_blocks WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_versions WHERE ${byNorm}`, [slug]),
    q('DELETE FROM law_norms WHERE slug = ?', [slug]),
  ];
}

/** Nur die abgeleiteten Daten einer Norm (Beziehungen, Empfehlungen, Herkunft, Textverweise, Portalbezüge). */
export function derivedQueries(norm, context, now) {
  const derived = deriveNorm(norm, context);
  return [
    q('DELETE FROM law_norm_derived WHERE norm_id = ?', [norm.meta.id]),
    q(`INSERT INTO law_norm_derived (
      norm_id, relations_json, recommendations_json, origin_json, text_references_json, portal_links_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      norm.meta.id, JSON.stringify(derived.relations), JSON.stringify(derived.recommendations), JSON.stringify(derived.origin),
      JSON.stringify(derived.textReferences), JSON.stringify(derived.portalLinks), now,
    ]),
    q('UPDATE law_norms SET origin_kind = ?, origin_baseline_version_id = ?, origin_last_own_change_date = ? WHERE id = ?', [derived.origin.kind, derived.origin.baselineVersionId ?? null, derived.origin.lastOwnChangeDate ?? null, norm.meta.id]),
  ];
}

/**
 * Leert die Projektion einmalig für eine Vollprojektion: Suchindex ohne Zeilenlauf
 * (FTS5 delete-all, DELETE ohne Trigger), dann alle Tabellen in fremdschlüsselsicherer
 * Reihenfolge (Kinder vor law_norms, damit keine Kaskaden laufen). Die Laufzeit-
 * metadaten werden entfernt, damit ein abgebrochener Lauf nicht als aktuell gilt.
 */
export function fullResetQueries() {
  return [
    ...searchIndexResetStatements().map((sql) => q(sql)),
    ...['law_norm_history', 'law_norm_subjects', 'law_search_documents', 'law_norm_derived', 'law_source_objects', 'law_version_blocks', 'law_versions', 'law_norms', 'law_publications']
      .map((table) => q(`DELETE FROM ${table}`)),
    q(`DELETE FROM law_runtime_meta WHERE key IN (${RUNTIME_META_KEYS.map(() => '?').join(', ')})`, RUNTIME_META_KEYS),
  ];
}

export function deletePublicationQueries(slug) {
  return [q('DELETE FROM law_publications WHERE slug = ?', [slug])];
}

/**
 * Deterministischer Fingerabdruck des Git-Bestands (Slug, Fassung, Gültigkeit je
 * Fassung sowie Verkündungsslugs), den der Sync in law_runtime_meta ablegt und
 * scripts/verify-recht-d1.mjs gegen den Repositorystand vergleicht.
 */
export function corpusFingerprint(norms, publications) {
  const lines = [
    ...norms.flatMap((norm) => norm.versions.map((version) => `${norm.meta.slug}:${version.versionId}:${version.validFrom}:${version.validTo ?? ''}`)),
    ...publications.map((publication) => `publication:${publication.slug}:${publication.date}`),
  ].sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function publicationQueries(publication, now) {
  return [q(`INSERT INTO law_publications (slug, publication_date, publication, year, issue, publication_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET publication_date=excluded.publication_date, publication=excluded.publication,
      year=excluded.year, issue=excluded.issue, publication_json=excluded.publication_json, updated_at=excluded.updated_at`, [
    publication.slug, publication.date, publication.publication, publication.year, publication.issue, JSON.stringify(publication), now,
  ])];
}

/**
 * Korpusweite Übersichtsdaten für Start-, Sachgebiets- und Suchseiten: Sachgebiete mit
 * Zählern, Hauptbereiche und Bestandszahlen. Sie werden bei jedem Sync aus dem vollen
 * Git-Bestand berechnet und als einzelne Metadatenzeilen abgelegt, damit die Website sie
 * mit einer Zeile statt mit dem gesamten Normenbestand liest.
 */
export function corpusOverviewMeta(norms, publications) {
  const subjectGroups = getSubjectGroups(norms).map((group) => ({ name: group.name, slug: group.slug, normCount: group.norms.length }));
  const subjectAreas = getSubjectAreaGroups(norms).map((area) => ({
    name: area.name,
    description: area.description,
    normCount: area.normCount,
    subjects: area.subjects.map((group) => ({ name: group.name, slug: group.slug, normCount: group.norms.length })),
  }));
  const stats = {
    normCount: norms.length,
    inForceCount: norms.filter((norm) => norm.meta.status === 'in-force').length,
    publicationCount: publications.length,
    types: [...new Set(norms.map((norm) => norm.meta.type))].sort(),
    statuses: [...new Set(norms.map((norm) => norm.meta.status))].sort(),
  };
  return {
    subject_groups_json: JSON.stringify(subjectGroups),
    subject_areas_json: JSON.stringify(subjectAreas),
    corpus_stats_json: JSON.stringify(stats),
  };
}

/** Laufzeitmetadaten; sie werden als letzte Anweisungen eines erfolgreichen Laufs geschrieben. */
export function runtimeMetaQueries({ now, norms, publications, fingerprint, mode }) {
  const values = {
    last_sync_at: now,
    norm_count: String(norms.length),
    publication_count: String(publications.length),
    corpus_hash: corpusFingerprint(norms, publications),
    projection_fingerprint: fingerprint.fingerprint,
    projection_logic_hash: fingerprint.logic,
    corpus_content_hash: fingerprint.corpus,
    sync_mode: mode,
    search_filters_json: JSON.stringify(buildFilterOptions(norms)),
    search_document_count: String(norms.reduce((sum, norm) => sum + norm.versions.length, 0)),
    search_publications_json: JSON.stringify(buildSearchPublications(publications)),
    ...corpusOverviewMeta(norms, publications),
  };
  return Object.entries(values).map(([key, value]) => q('INSERT INTO law_runtime_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]));
}

/** Zählt Anweisungen je Art und Tabelle (Schätzung für --dry-run und Protokoll). */
export function summarizeStatements(queries) {
  const counts = {};
  for (const { sql } of queries) {
    const match = sql.trim().match(/^(INSERT INTO|DELETE FROM|UPDATE|DROP TRIGGER IF EXISTS|CREATE TRIGGER IF NOT EXISTS)\s+(\w+)/iu);
    const key = match ? `${match[1].split(' ')[0].toLowerCase()} ${match[2]}` : 'sonstige';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

// ---------------------------------------------------------------------------
// Transport und Kostenzähler
// ---------------------------------------------------------------------------

export class SyncBudgetExceeded extends Error {}

/** Summiert die D1-Metadaten (rows_read, rows_written, duration) über alle Antworten. */
export function createStats(limits = {}) {
  return { queries: 0, batches: 0, rowsRead: 0, rowsWritten: 0, durationMs: 0, limits };
}

export function recordResults(stats, results, { queries = results.length, batches = 1 } = {}) {
  stats.queries += queries;
  stats.batches += batches;
  for (const result of results) {
    const meta = result?.meta ?? {};
    stats.rowsRead += Number(meta.rows_read ?? 0);
    stats.rowsWritten += Number(meta.rows_written ?? 0);
    stats.durationMs += Number(meta.duration ?? 0);
  }
  if (stats.limits.maxRowsRead !== undefined && stats.rowsRead > stats.limits.maxRowsRead) {
    throw new SyncBudgetExceeded(`Lesebudget überschritten: ${stats.rowsRead} gelesene Zeilen > --max-rows-read ${stats.limits.maxRowsRead}; Sync abgebrochen (Laufzeitmetadaten wurden nicht geschrieben)`);
  }
  if (stats.limits.maxRowsWritten !== undefined && stats.rowsWritten > stats.limits.maxRowsWritten) {
    throw new SyncBudgetExceeded(`Schreibbudget überschritten: ${stats.rowsWritten} geschriebene Zeilen > --max-rows-written ${stats.limits.maxRowsWritten}; Sync abgebrochen (Laufzeitmetadaten wurden nicht geschrieben)`);
  }
  return stats;
}

export function formatStats(stats) {
  return `${stats.queries} Abfragen in ${stats.batches} Batch(es)/Datei(en), rows_read ${stats.rowsRead}, rows_written ${stats.rowsWritten}, D1-Dauer ${Math.round(stats.durationMs)} ms`;
}

async function cloudflareQuery({ accountId, databaseId, apiToken }, batch) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ batch }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success || payload.errors?.length) {
    throw new Error(`Cloudflare D1: ${response.status} ${JSON.stringify(payload.errors ?? payload)}`);
  }
  if ((payload.result ?? []).some((result) => result.success === false)) {
    throw new Error(`Cloudflare D1 meldet fehlgeschlagene Batch-Abfrage: ${JSON.stringify(payload.result)}`);
  }
  return payload;
}

async function sendBatches(config, queries, batchSize, stats) {
  for (let index = 0; index < queries.length; index += batchSize) {
    const batch = queries.slice(index, index + batchSize);
    const payload = await cloudflareQuery(config, batch);
    recordResults(stats, payload.result ?? [], { queries: batch.length, batches: 1 });
  }
}

async function runWrangler(args) {
  const { stdout, stderr } = await execFileAsync('npx', ['wrangler', ...args], {
    cwd: join(ROOT, 'apps', 'recht'),
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  return { stdout, stderr };
}

function parseWranglerJson(stdout) {
  const jsonStart = stdout.indexOf('[');
  return jsonStart >= 0 ? JSON.parse(stdout.slice(jsonStart)) : null;
}

const TRANSIENT_D1_ERROR = /Network connection lost|Authentication error \[code: 10000\]|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed|\b5\d\d\b/u;

/**
 * Führt eine SQL-Datei aus. Inkrementelle Dateien schreiben ihre Normen vollständig
 * neu (Löschen je Norm über Indizes, anschließend Einfügen), Vollprojektionen leeren
 * die Tabellen zu Beginn; beide dürfen nach einem abgebrochenen Versuch wiederholt
 * werden. Vorübergehende Netz- oder Anmeldefehler der Cloudflare-API werden mit
 * Backoff erneut versucht.
 */
async function executeSqlFile(filePath, { local = false, persistTo, attempts = 4, databaseName = D1_DATABASE_NAME } = {}) {
  const target = local ? ['--local', '--persist-to', persistTo] : ['--remote'];
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { stdout, stderr } = await runWrangler(['d1', 'execute', databaseName, ...target, '--yes', '--json', '--file', filePath]);
      const payload = parseWranglerJson(stdout);
      if (!Array.isArray(payload) || payload.some((result) => result.success === false)) {
        throw new Error(`wrangler d1 execute ${filePath}: ${(stderr || stdout).trim().slice(-400)}`);
      }
      return payload;
    } catch (error) {
      const message = error instanceof Error ? `${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}` : String(error);
      if (local || attempt >= attempts || !TRANSIENT_D1_ERROR.test(message)) throw error;
      const delayMs = 5_000 * attempt;
      console.warn(`${filePath.replace(`${ROOT}/`, '')}: vorübergehender Fehler (Versuch ${attempt}/${attempts}), neuer Versuch in ${delayMs / 1000} s`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
}

/** Liest die gespeicherten Fingerabdrücke aus law_runtime_meta (null, wenn nicht lesbar). */
async function readStoredFingerprint({ transport, config, local, persistTo, databaseName, stats }) {
  const sql = "SELECT key, value FROM law_runtime_meta WHERE key IN ('projection_fingerprint', 'corpus_hash', 'sync_mode', 'last_sync_at')";
  try {
    let results;
    if (transport === 'api') {
      const payload = await cloudflareQuery(config, [q(sql)]);
      recordResults(stats, payload.result ?? [], { queries: 1, batches: 1 });
      results = payload.result?.[0]?.results ?? [];
    } else {
      const target = local ? ['--local', '--persist-to', persistTo] : ['--remote'];
      const { stdout } = await runWrangler(['d1', 'execute', databaseName, ...target, '--json', '--command', sql]);
      const payload = parseWranglerJson(stdout);
      recordResults(stats, payload ?? [], { queries: 1, batches: 1 });
      results = payload?.[0]?.results ?? [];
    }
    return Object.fromEntries(results.map((row) => [row.key, row.value]));
  } catch (error) {
    if (error instanceof SyncBudgetExceeded) throw error;
    return null;
  }
}

async function gitShowJson(ref, path) {
  try {
    const { stdout } = await execFileAsync('git', ['show', `${ref}:${path}`], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function gitChangedPaths(base, head) {
  const { stdout } = await execFileAsync('git', ['diff', '--name-only', base, head], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return stdout.split(/\r?\n/u).filter(Boolean);
}

/** Beschränkt den Bestand auf ein Testfixture; unbekannte Slugs sind ein Fehler (kein stilles Fixture). */
export function applyCorpusFilter(norms, fixture, label = 'Fixture') {
  const slugs = fixture?.slugs;
  if (!Array.isArray(slugs) || slugs.length === 0) throw new Error(`${label}: "slugs" fehlt oder ist leer`);
  const wanted = new Set(slugs.map((entry) => (typeof entry === 'string' ? entry : entry?.slug)));
  const existing = new Set(norms.map((norm) => norm.meta.slug));
  const missing = [...wanted].filter((slug) => !existing.has(slug));
  if (missing.length > 0) throw new Error(`${label}: Slugs nicht im Bestand: ${missing.join(', ')}`);
  return norms.filter((norm) => wanted.has(norm.meta.slug));
}

/**
 * Bestimmt den Sync-Umfang aus den Kommandozeilenoptionen. Genau eine Umfangsangabe
 * ist erforderlich; ein Aufruf ohne Angabe löst keinen Vollsync mehr aus.
 */
export async function resolveScope(args, { norms, publications }) {
  const existingSlugs = new Set(norms.map((norm) => norm.meta.slug));
  const existingPublications = new Set(publications.map((publication) => publication.slug));
  const requestedSlugs = valuesAfter(args, '--slug');
  const deleteSlugs = valuesAfter(args, '--delete');
  const modes = [args.includes('--full'), requestedSlugs.length > 0 || deleteSlugs.length > 0 || args.includes('--publications'), args.includes('--git-diff'), args.includes('--changed-paths')].filter(Boolean).length;
  if (modes === 0) throw new Error('Kein Umfang angegeben: --full, --slug/--delete/--publications, --git-diff <base> <head> oder --changed-paths <Datei> ist erforderlich');
  if (modes > 1) throw new Error('Nur eine Umfangsangabe ist zulässig (--full | --slug/--delete/--publications | --git-diff | --changed-paths)');
  if (args.includes('--full')) return { mode: 'full', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: ['--full'] };
  if (requestedSlugs.length > 0 || deleteSlugs.length > 0 || args.includes('--publications')) {
    for (const slug of requestedSlugs) if (!existingSlugs.has(slug)) throw new Error(`Norm ${slug} nicht gefunden`);
    for (const slug of deleteSlugs) if (existingSlugs.has(slug)) throw new Error(`Norm ${slug} existiert noch im Repository; --delete nur für entfernte Normen`);
    return { mode: 'incremental', slugs: [...new Set(requestedSlugs)].sort(), deletedSlugs: [...new Set(deleteSlugs)].sort(), publicationSlugs: args.includes('--publications') ? [...existingPublications].sort() : [], deletedPublications: [], derivedRebuild: deleteSlugs.length > 0, reasons: ['explizite Auswahl'] };
  }
  let paths;
  let identityChanged = () => true;
  if (args.includes('--git-diff')) {
    const index = args.indexOf('--git-diff');
    const [base, head] = [args[index + 1], args[index + 2]];
    if (!base || !head) throw new Error('--git-diff braucht <base> <head>');
    paths = await gitChangedPaths(base, head);
    const metaCache = new Map();
    const currentMeta = (slug) => norms.find((norm) => norm.meta.slug === slug)?.meta ?? null;
    const candidateSlugs = new Set(paths.map((path) => path.match(/^content\/normen\/([^/]+)\//u)?.[1]).filter(Boolean));
    for (const slug of candidateSlugs) {
      if (!existingSlugs.has(slug)) continue;
      const previous = await gitShowJson(base, `content/normen/${slug}/meta.json`);
      metaCache.set(slug, metaIdentityChanged(previous, currentMeta(slug)));
    }
    identityChanged = (slug) => metaCache.get(slug) ?? true;
  } else {
    const file = valueAfter(args, '--changed-paths');
    if (!file) throw new Error('--changed-paths braucht eine Datei');
    paths = (await readFile(resolve(ROOT, file), 'utf8')).split(/\r?\n/u).filter(Boolean);
  }
  const scope = scopeFromChangedPaths(paths, { existingSlugs, existingPublications, identityChanged });
  if (scope.mode === 'incremental' && scope.publicationSlugs.length > 0) {
    for (const slug of normsCitingPublications(publications, scope.publicationSlugs)) {
      if (existingSlugs.has(slug) && !scope.slugs.includes(slug)) scope.slugs.push(slug);
    }
    scope.slugs.sort();
  }
  return scope;
}

/**
 * Baut die vollständige Anweisungsliste eines Laufs: Reset (nur --full), Löschungen,
 * Normen, abgeleitete Daten, Verkündungen, Laufzeitmetadaten. Reine Funktion über den
 * geladenen Bestand; Tests prüfen damit Umfang und Kostenpfad ohne Datenbank.
 */
export function buildSyncPlan({ scope, norms, publications, context, now, fingerprint }) {
  const full = scope.mode === 'full';
  const selectedSlugs = new Set(scope.slugs);
  const selected = full ? norms : norms.filter((norm) => selectedSlugs.has(norm.meta.slug));
  const groups = [];
  if (full) groups.push({ slug: '(reset)', queries: fullResetQueries() });
  for (const slug of scope.deletedSlugs) groups.push({ slug: `(löschen ${slug})`, queries: deleteNormQueries(slug) });
  let searchUnitCount = 0;
  for (const norm of selected) {
    const queries = normQueries(norm, context, now, { full });
    searchUnitCount += queries.filter((query) => query.sql.startsWith('INSERT INTO law_search_units')).length;
    groups.push({ slug: norm.meta.slug, queries });
  }
  let derivedCount = 0;
  if (!full && scope.derivedRebuild) {
    for (const norm of norms) {
      if (selectedSlugs.has(norm.meta.slug)) continue;
      groups.push({ slug: `(abgeleitet ${norm.meta.slug})`, queries: derivedQueries(norm, context, now) });
      derivedCount += 1;
    }
  }
  const publicationSelection = full ? publications : publications.filter((publication) => scope.publicationSlugs.includes(publication.slug));
  const finalQueries = [
    ...scope.deletedPublications.flatMap((slug) => deletePublicationQueries(slug)),
    ...publicationSelection.flatMap((publication) => publicationQueries(publication, now)),
    ...runtimeMetaQueries({ now, norms, publications, fingerprint, mode: scope.mode }),
  ];
  groups.push({ slug: '(verkuendungen+meta)', queries: finalQueries });
  const all = groups.flatMap((group) => group.queries);
  return {
    full,
    groups,
    selected,
    derivedCount,
    publicationCount: publicationSelection.length,
    searchUnitCount,
    statementCount: all.length,
    byStatement: summarizeStatements(all),
  };
}

/** Grobe Kostenschätzung eines Plans (Zeilen; Vollprojektionen lesen nur Verwaltungszeilen). */
export function estimatePlanCost(plan) {
  const inserts = Object.entries(plan.byStatement).filter(([key]) => key.startsWith('insert')).reduce((sum, [, count]) => sum + count, 0);
  const deletes = Object.entries(plan.byStatement).filter(([key]) => key.startsWith('delete')).reduce((sum, [, count]) => sum + count, 0);
  return {
    // Jede eingefügte Provision erzeugt zusätzlich die FTS5-Indexzeilen (Trigger); D1 zählt
    // Schattentabellen-Schreibzugriffe mit, deshalb als Spanne angegeben.
    rowsWrittenMin: inserts,
    rowsWrittenMax: inserts + plan.searchUnitCount * 3,
    // Inkrementell: gelöschte Zeilen der betroffenen Normen werden über Indizes gelesen;
    // Vollprojektion: nur Fingerabdruck und Reset.
    rowsReadApprox: plan.full ? 16 : deletes + plan.searchUnitCount + plan.selected.reduce((sum, norm) => sum + norm.versions.length * 4, 0),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSize = Number.parseInt(valueAfter(args, '--batch-size') ?? String(DEFAULT_BATCH_SIZE), 10);
  const config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.OSTRECHT_D1_DATABASE_ID ?? DEFAULT_D1_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  };
  const local = args.includes('--local');
  const applySchema = args.includes('--apply-schema');
  const ignoreFingerprint = args.includes('--ignore-fingerprint');
  // Zieldatenbank des Wrangler-Transports (z. B. ostrecht-recht-staging); die API
  // adressiert über OSTRECHT_D1_DATABASE_ID.
  const databaseName = valueAfter(args, '--database') ?? D1_DATABASE_NAME;
  const persistTo = resolve(ROOT, valueAfter(args, '--persist-to') ?? join('.cache', 'wrangler-local'));
  const transport = valueAfter(args, '--transport') ?? (local ? 'wrangler' : config.apiToken ? 'api' : 'wrangler');
  const stats = createStats({ maxRowsRead: integerAfter(args, '--max-rows-read'), maxRowsWritten: integerAfter(args, '--max-rows-written') });
  if (!['api', 'wrangler'].includes(transport)) throw new Error(`Unbekannter Transport ${transport}`);
  if (local && transport !== 'wrangler') throw new Error('--local gibt es nur für den Wrangler-Transport');
  if (applySchema && !local) throw new Error('--apply-schema ist nur lokal erlaubt; produktive Migrationen werden manuell eingespielt (zuerst lokal, dann Staging)');
  if (!dryRun && transport === 'api' && !config.apiToken) throw new Error('CLOUDFLARE_API_TOKEN ist für --transport api erforderlich');
  if (applySchema && !dryRun) {
    const schemaDir = join(ROOT, 'data', 'recht', 'd1');
    const migrations = (await readdir(schemaDir)).filter((name) => /^\d{4}_.*\.sql$/u.test(name)).sort();
    for (const name of migrations) {
      await executeSqlFile(join(schemaDir, name), { local, persistTo, databaseName });
      console.log(`Migration ${name} lokal angewendet`);
    }
  }

  const startedAt = Date.now();
  const fingerprint = await projectionFingerprint(ROOT);
  console.log(`Projektionsfingerabdruck ${fingerprint.fingerprint.slice(0, 16)}… (Logik ${fingerprint.logic.slice(0, 12)}…, Bestand ${fingerprint.corpus.slice(0, 12)}…)`);
  const canReadTarget = !dryRun || transport === 'wrangler' || Boolean(config.apiToken);
  if (!ignoreFingerprint && canReadTarget) {
    const stored = await readStoredFingerprint({ transport, config, local, persistTo, databaseName, stats });
    if (stored?.projection_fingerprint === fingerprint.fingerprint) {
      console.log(`D1-Projektion ist bereits exakt aktuell (Fingerabdruck identisch, letzter Sync ${stored.last_sync_at ?? '?'}, Modus ${stored.sync_mode ?? '?'}); kein Sync erforderlich.`);
      console.log(`Kosten dieser Prüfung: ${formatStats(stats)}`);
      return;
    }
    console.log(stored?.projection_fingerprint
      ? `Gespeicherter Fingerabdruck ${stored.projection_fingerprint.slice(0, 16)}… weicht ab; Sync läuft.`
      : 'Kein gespeicherter Fingerabdruck in D1 (oder nicht lesbar); Sync läuft.');
  }

  const [loadedNorms, publications, topics, pressReleases] = await Promise.all([
    loadAllNorms(), loadAllVerkuendungen(), loadTopics(), loadPressReleases(),
  ]);
  const corpusFilter = valueAfter(args, '--corpus-filter');
  if (corpusFilter && !local) throw new Error('--corpus-filter ist nur für die lokale Projektion zulässig (Testfixture)');
  const norms = corpusFilter ? applyCorpusFilter(loadedNorms, JSON.parse(await readFile(resolve(ROOT, corpusFilter), 'utf8')), corpusFilter) : loadedNorms;
  console.log(`${loadedNorms.length} Normen und ${publications.length} Verkündungen geladen und validiert (${Math.round((Date.now() - startedAt) / 1000)} s)${corpusFilter ? `; Fixture ${corpusFilter}: ${norms.length} Normen` : ''}`);
  const scope = await resolveScope(args, { norms, publications });
  const full = scope.mode === 'full';
  console.log(full
    ? 'Umfang: Vollprojektion (Tabellen werden einmalig geleert, keine normweisen Löschungen)'
    : `Umfang: ${scope.slugs.length} Norm(en), ${scope.deletedSlugs.length} Löschung(en), ${scope.publicationSlugs.length} Verkündung(en)${scope.derivedRebuild ? ', abgeleitete Daten aller Normen' : ''}${scope.reasons.length ? ` – ${scope.reasons.slice(0, 3).join('; ')}` : ''}`);
  const context = buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl });
  console.log(`Korpusweite Ableitungen berechnet (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const now = new Date().toISOString();
  const plan = buildSyncPlan({ scope, norms, publications, context, now, fingerprint });
  const cost = estimatePlanCost(plan);
  console.log(`Plan: ${plan.selected.length} Normen, ${scope.deletedSlugs.length} Löschungen, ${plan.derivedCount} abgeleitete Datensätze, ${plan.publicationCount} Verkündungen, ${plan.searchUnitCount} Suchprovisionen, ${plan.statementCount} Anweisungen`);
  console.log(`Anweisungen je Tabelle: ${JSON.stringify(plan.byStatement)}`);
  console.log(`Schätzung: rows_written ≈ ${cost.rowsWrittenMin}–${cost.rowsWrittenMax}, rows_read ≈ ${cost.rowsReadApprox} (${full ? 'Vollprojektion: nur Verwaltungsabfragen' : 'inkrementell: nur Zeilen der betroffenen Normen über Indizes'})`);

  if (transport === 'api') {
    if (!dryRun) {
      for (const group of plan.groups) {
        await sendBatches(config, group.queries, batchSize, stats);
      }
    }
  } else {
    const normStatements = plan.groups.map((group) => ({ slug: group.slug, statements: group.queries.map(renderStatement) }));
    const files = groupStatementFiles(normStatements);
    const runDirectory = join(ROOT, '.cache', 'd1-sync', now.replace(/[:.]/gu, '-'));
    await mkdir(runDirectory, { recursive: true });
    for (const [index, file] of files.entries()) {
      const filePath = join(runDirectory, `batch-${String(index + 1).padStart(4, '0')}.sql`);
      await writeFile(filePath, `${file.statements.join('\n')}\n`, 'utf8');
      if (!dryRun) {
        const payload = await executeSqlFile(filePath, { local, persistTo, databaseName });
        recordResults(stats, payload, { queries: file.statements.length, batches: 1 });
        console.log(`SQL-Datei ${index + 1}/${files.length} (${file.slugs.length} Gruppen, ${file.statements.length} Anweisungen) ${local ? 'lokal ' : ''}ausgeführt`);
      }
    }
    console.log(`${files.length} SQL-Datei(en) unter ${runDirectory.replace(`${ROOT}/`, '')}${dryRun ? ' geschrieben (nicht ausgeführt)' : ' ausgeführt'}`);
  }
  console.log(`${plan.selected.length} Normen, ${scope.deletedSlugs.length} Löschungen, ${plan.publicationCount} Verkündungen, ${plan.statementCount} Anweisungen${dryRun ? ' validiert' : local ? ` in die lokale D1 unter ${persistTo.replace(`${ROOT}/`, '')} übertragen` : ' nach D1 übertragen'} (${Math.round((Date.now() - startedAt) / 1000)} s).`);
  if (!dryRun) console.log(`D1-Kosten: ${formatStats(stats)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

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
import { getGermanIndexLetter, getSubjectAreaGroups, getSubjectGroups, getSubjectSlug } from '@ostrecht/shared/lib/norms/routes.ts';
import { classifyNormVersion, getApplicableVersion, getNormLastActivityDate, getNormLastChangeDate } from '@ostrecht/shared/lib/norms/versions.ts';
import { getPressReleaseUrl, getTopicUrl } from '@ostrecht/shared/lib/portal/routes.ts';
import { loadPressReleases, loadTopics } from '@ostrecht/shared/lib/portal/norm-portal-content.ts';
import { buildFilterOptions, buildSearchDocument, buildSearchPublications, getNormAliases, isAmendmentRecord } from '@ostrecht/recht-search/search.ts';

import { isEmptyScope, metaIdentityChanged, normsCitingPublications, REFERENCE_DATE_PATH, scopeFromChangedPaths, scopeSignature } from './lib/d1-sync-scope.mjs';
import { assertIsoDate, referenceDateAffectedSlugs } from './lib/d1-reference-date.mjs';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';
import { FULL_SCOPE, fixtureScope, portalProjectionChangedSince, projectionIdentity, projectionIdentityAtRef } from './lib/d1-projection-fingerprint.mjs';
import { describeProofResult, readProof, validateProof } from './lib/d1-projection-proof-format.mjs';
import { PORTAL_CONTENT_PATTERN } from './lib/d1-sync-scope.mjs';
import { SEARCH_UNIT_COLUMNS, searchIndexResetStatements } from './lib/d1-search-schema.mjs';

/**
 * Spiegelt content/normen und content/verkuendungen nach Cloudflare D1 – die
 * abgeleitete Runtime-Projektion von OstRecht. Git bleibt fachlicher Source of
 * Truth; alle korpusweiten Ableitungen (Beziehungen, Empfehlungen, Herkunft,
 * Textverweise, Vollzitate, Verkündungsbezüge, Portalbezüge) werden hier aus dem
 * vollständigen Bestand berechnet und je Norm gespeichert, damit die Website zur
 * Laufzeit nur die Zeilen der angefragten Norm lesen muss.
 *
 * Schema: data/recht/d1/0001_rechtsbestand.sql … 0007_search_candidate_filters.sql.
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
 *     Code-Abschluss der Projektion + Schema + Rechtsbestand + Portalgrundlagen, reine
 *     Inhaltshashes) wird vor jedem Lauf mit law_runtime_meta verglichen; bei Gleichheit endet
 *     der Sync ohne Schreibzugriff (No-op). --ignore-fingerprint erzwingt den Lauf.
 *   - Der API-Transport summiert Abfragen, Batches, rows_read, rows_written und Dauer
 *     aus den D1-Antworten; --max-rows-read / --max-rows-written brechen den Lauf ab,
 *     sobald das Budget überschritten ist. --dry-run schätzt Umfang und Anweisungen.
 *   - --remote-state liest nur die gespeicherte Identität, bestimmt Umfang und Entscheidung und
 *     endet vor Ableitungen und Planbau (Sekunden; PR-Check d1_token_check). Exit-Code 3, wenn
 *     der automatische Sync eine nicht budgetierte Vollprojektion bräuchte (Release-Gate).
 *   - Verlangt ein --git-diff-Lauf eine Vollprojektion nur wegen geänderter Projektionslogik,
 *     ersetzt der Äquivalenznachweis (scripts/lib/d1-projection-proof.mjs) die Annahme durch
 *     Rechnung (scripts/d1-projection-snapshot.mjs prove): Basis- und Zielprojektion werden lokal
 *     vollständig verglichen, und nur der nachgewiesene inkrementelle Umfang wird geschrieben – im Grenzfall nur Identität und
 *     Laufzeitmetadaten (die neue Identität wird übernommen, ohne Daten neu zu schreiben). Dieser
 *     Metadata-only-Lauf (isMetadataOnlyRun, planRun) berechnet keine korpusweiten Ableitungen:
 *     der Bestand wird nur geladen, weil der Umfang aus ihm bestimmt wird und die 17 Zeilen der
 *     Laufzeitmetadaten (Zähler, corpus_hash, Suchfilter, Übersichten) aus dem Ziel-Bestand
 *     stammen müssen – der Nachweis belegt die Datentabellen, nicht diese Zeilen. Der
 *     Nachweis ist an gespeicherte und neue Identität, Scope, Comparator-Version und Umfang
 *     gebunden; jede Abweichung ist fail-closed. Einen frei setzbaren Bypass gibt es nicht.
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
 *                               anderer Normen hängen davon ab). Eine Fortschreibung des
 *                               redaktionellen Stichtags (editorial.json) ist kein Full-Trigger:
 *                               der alte Stichtag wird aus dem Basis-Ref gelesen, projiziert werden
 *                               nur die stichtagsabhängig betroffenen Normen und die abgeleiteten
 *                               Daten aller Normen (scripts/lib/d1-reference-date.mjs)
 *   --changed-paths <Datei>     wie --git-diff, mit einer Pfadliste (eine Zeile je Pfad; gelöschte
 *                               Normen werden am fehlenden Verzeichnis erkannt, Identitäts-
 *                               änderungen gelten als gegeben); enthält die Liste editorial.json,
 *                               nennt --reference-date-from <Datum> den bisherigen Stichtag, sonst
 *                               bleibt die Stichtagsänderung ein Full-Trigger
 *   --equivalence-proof <Datei> nur mit --git-diff: validierter Äquivalenznachweis
 *                               (scripts/d1-projection-snapshot.mjs prove --base <base>), der statt
 *                               der Vollprojektion den nachgewiesenen Umfang erlaubt; mit
 *                               --remote-state wird nur berichtet, wie der Lauf entscheiden würde
 *   --database <Name>           Zieldatenbank des Wrangler-Transports (Standard ostrecht-recht;
 *                               Staging: ostrecht-recht-staging)
 *   --corpus-filter <Datei>     nur lokal oder Staging: beschränkt den geladenen Bestand auf die Slugs der
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
const RUNTIME_META_KEYS = ['last_sync_at', 'norm_count', 'publication_count', 'corpus_hash', 'projection_fingerprint', 'projection_scope', 'projection_logic_hash', 'corpus_content_hash', 'portal_content_hash', 'sync_mode', 'sync_state', 'search_filters_json', 'search_document_count', 'search_publications_json', 'subject_groups_json', 'subject_areas_json', 'corpus_stats_json'];
const IDENTITY_META_KEYS = ['projection_fingerprint', 'projection_scope', 'projection_logic_hash', 'corpus_content_hash', 'portal_content_hash', 'sync_state'];
const BUDGETS_PATH = join(ROOT, 'data', 'recht', 'd1-sync-budgets.json');
const PRODUCTION_DATABASE_NAME = 'ostrecht-recht';
/** Exit-Code von --remote-state, wenn der automatische Sync eine Vollprojektion bräuchte (Release-Gate). */
export const REMOTE_STATE_GATE_EXIT_CODE = 3;
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
  const document = buildSearchDocument(record, version, context.lookup, publicationReference, context.asOf ?? EDITORIAL_REFERENCE_DATE);
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

/**
 * Jüngste Rechtsänderung bis zum Stichtag (Fassungsbeginne, Erlass, Änderung, Aufhebung; keine
 * bloßen Hinweise, keine künftigen Ereignisse): Standardsortierung der Übersichten und der Suche
 * ohne Suchbegriff. Zentrale Definition in packages/shared/src/lib/norms/versions.ts.
 */
export function lastChangeDate(norm) {
  return getNormLastChangeDate(norm, EDITORIAL_REFERENCE_DATE);
}

/**
 * Jüngstes dokumentiertes Ereignis bis zum Stichtag einschließlich reiner Hinweise: Grundlage
 * für lastmod in der Sitemap. Zentrale Definition in packages/shared/src/lib/norms/versions.ts.
 */
export function lastActivityDate(norm) {
  return getNormLastActivityDate(norm, EDITORIAL_REFERENCE_DATE);
}

const NORM_COLUMNS = [
  'id', 'slug', 'title', 'short_title', 'abbr', 'type', 'status', 'revosax_law_id', 'current_version_id',
  'document_date', 'publication_date', 'effective_date', 'expiry_date', 'initial_citation', 'summary',
  'responsible_ministry', 'enacting_body', 'source_kind', 'updated_at', 'meta_json', 'history_json', 'sort_title', 'current_valid_from',
  'subjects_json', 'primary_subject', 'keywords_json', 'aliases_json', 'origin_kind', 'origin_baseline_version_id', 'origin_last_own_change_date', 'version_count', 'last_change_date', 'last_activity_date', 'is_amendment',
  'index_letter',
];

/** Einträge des Stichwortindex einer Norm (Abkürzung, Kurzbezeichnung, Schlagwörter; mindestens zwei Zeichen). */
export function keywordEntries(norm, identity) {
  const values = [identity.abbr, identity.shortTitle, ...(norm.meta.keywords ?? [])]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length >= 2);
  return [...new Set(values)].map((keyword) => ({ keyword, indexLetter: getGermanIndexLetter(keyword) }));
}

/**
 * Anweisungen einer Norm. Inkrementell werden zuerst die eigenen Zeilen der Norm über
 * Indizes gelöscht; in der Vollprojektion sind alle Tabellen bereits leer, dann entfallen
 * die Löschungen vollständig.
 */
export function normQueries(norm, context, now, { full = false } = {}) {
  const { meta, history, versions } = norm;
  // Der Stichtag der Projektion kommt aus dem Ableitungskontext (Standard: editorial.json).
  const asOf = context.asOf ?? EDITORIAL_REFERENCE_DATE;
  const current = getApplicableVersion(norm, asOf);
  const currentIdentity = getNormVersionIdentity(norm, current);
  const derived = deriveNorm(norm, context);
  const sourceOf = (version) => (version.sourceReferences ?? []).find((source) => source.kind === 'revosax-snapshot') ?? (version.sourceReferences ?? [])[0] ?? null;
  const lawId = [...(current.sourceReferences ?? []), ...(meta.sourceReferences ?? [])].map((source) => source.lawId).find(Boolean) ?? null;
  const sourceKind = [...(current.sourceReferences ?? []), ...(meta.sourceReferences ?? [])].some((source) => source.kind === 'revosax-snapshot') ? 'revosax-baseline' : 'repository';
  const queries = full ? [] : [
    q('DELETE FROM law_search_units WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_norm_subjects WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_norm_keywords WHERE norm_id = ?', [meta.id]),
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
    lastActivityDate(norm), isAmendmentRecord(norm) ? 1 : 0,
    getGermanIndexLetter(currentIdentity.title),
  ]));

  for (const version of versions) {
    const primarySource = sourceOf(version);
    const publicationReference = context.publicationReferences.get(`${meta.slug}:${version.versionId}`) ?? null;
    queries.push(q(`INSERT INTO law_versions (
      norm_id, version_id, valid_from, valid_to, is_current, title, short_title, abbr, summary,
      citation, change_note, source_sha256, source_url, source_retrieved_at, source_object_key, updated_at,
      version_json, full_citation, publication_ref_json, temporal_kind, publication_source, publication_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      meta.id, version.versionId, version.validFrom, version.validTo ?? null, version.isCurrent ? 1 : 0,
      version.title ?? null, version.shortTitle ?? null, version.abbr ?? null, version.summary ?? null,
      version.citation, version.changeNote, primarySource?.sha256 ?? null, primarySource?.url ?? null,
      primarySource?.retrievedAt ?? null, primarySource?.objectKey ?? null, now,
      JSON.stringify(stripBody(version)), fullCitationFor(norm, version, context),
      publicationReference ? JSON.stringify(publicationReference) : null, classifyNormVersion(norm, version, asOf),
      // Schmale Filterspalten der Kandidatenabfrage (Verkündungsblatt, Jahr) je Fassung.
      publicationReference?.publication ?? null, publicationReference?.publicationDate?.slice(0, 4) ?? null,
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
  for (const { keyword, indexLetter } of keywordEntries(norm, currentIdentity)) {
    queries.push(q('INSERT OR IGNORE INTO law_norm_keywords (norm_id, keyword, index_letter) VALUES (?, ?, ?)', [meta.id, keyword, indexLetter]));
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
    queries.push(searchDocumentQuery(meta.id, version.versionId, metadata, now));
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

function searchDocumentQuery(normId, versionId, metadata, now) {
  return q(
    'INSERT INTO law_search_documents (norm_id, version_id, document_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(norm_id, version_id) DO UPDATE SET document_json=excluded.document_json, updated_at=excluded.updated_at',
    [normId, versionId, JSON.stringify(metadata), now],
  );
}

/**
 * Nur die Suchdokumente (Metadaten je Fassung) einer Norm neu schreiben – für nachgewiesen enge
 * Logikänderungen (Äquivalenznachweis, logicChange `narrow`). Provisionen, Normzeilen und
 * Fassungen bleiben unberührt; die Upserts sind idempotent.
 */
export function searchDocumentQueries(norm, context, now) {
  return norm.versions.map((version) => searchDocumentQuery(norm.meta.id, version.versionId, searchUnits(norm, version, context).metadata, now));
}

/** Entfernt eine Norm mit allen abhängigen Zeilen; jede Löschung läuft über den Index norm_id. */
export function deleteNormQueries(slug) {
  const byNorm = 'norm_id IN (SELECT id FROM law_norms WHERE slug = ?)';
  return [
    q(`DELETE FROM law_search_units WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_norm_subjects WHERE ${byNorm}`, [slug]),
    q(`DELETE FROM law_norm_keywords WHERE ${byNorm}`, [slug]),
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
    // Abgeleitete Spalten von law_norms (Herkunft, jüngstes Rechtsereignis) gehören zur
    // Ableitung: ein Derived-Rebuild hält sie mit law_norm_derived zusammen aktuell.
    q('UPDATE law_norms SET origin_kind = ?, origin_baseline_version_id = ?, origin_last_own_change_date = ?, last_change_date = ?, last_activity_date = ? WHERE id = ?', [derived.origin.kind, derived.origin.baselineVersionId ?? null, derived.origin.lastOwnChangeDate ?? null, lastChangeDate(norm), lastActivityDate(norm), norm.meta.id]),
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
    ...['law_norm_history', 'law_norm_subjects', 'law_norm_keywords', 'law_search_documents', 'law_norm_derived', 'law_source_objects', 'law_version_blocks', 'law_versions', 'law_norms', 'law_publications']
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

/** Identitätszeilen (Fingerabdruck, Scope, Teilhashes, Zustand `complete`). */
export function identityMetaValues(identity) {
  return {
    projection_fingerprint: identity.fingerprint,
    projection_scope: identity.scope ?? FULL_SCOPE,
    projection_logic_hash: identity.logic,
    corpus_content_hash: identity.corpus,
    portal_content_hash: identity.portal ?? '',
    sync_state: 'complete',
  };
}

/**
 * Erste Anweisungen eines inkrementellen Laufs: die gespeicherte Identität wird entwertet
 * (`sync_state` = `incremental-in-progress`, Fingerabdruck entfernt), damit ein abgebrochener
 * Lauf nie als vollständiger Basiszustand gilt; die neue Identität kommt erst am Ende.
 */
export function incrementalStartQueries(now) {
  return [
    q('DELETE FROM law_runtime_meta WHERE key = ?', ['projection_fingerprint']),
    q('INSERT INTO law_runtime_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['sync_state', `incremental-in-progress:${now}`]),
  ];
}

/**
 * Metadaten eines manuellen Teilsyncs (--slug/--delete/--publications/--changed-paths):
 * nur Zeitstempel und Modus. Die gespeicherte Identität bleibt unverändert, weil ein
 * Teilsync D1 nicht nachweisbar auf den Stand des Arbeitsbaums bringt; die nächste
 * --git-diff- oder --full-Projektion schreibt sie wieder vollständig.
 */
export function partialMetaQueries({ now, mode }) {
  return Object.entries({ last_sync_at: now, sync_mode: mode }).map(([key, value]) => q('INSERT INTO law_runtime_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]));
}

/** Laufzeitmetadaten; sie werden als letzte Anweisungen eines erfolgreichen Laufs geschrieben. */
export function runtimeMetaQueries({ now, norms, publications, fingerprint, identity = fingerprint, mode }) {
  const values = {
    last_sync_at: now,
    norm_count: String(norms.length),
    publication_count: String(publications.length),
    corpus_hash: corpusFingerprint(norms, publications),
    ...identityMetaValues(identity),
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
    throw new SyncBudgetExceeded(`Lesebudget überschritten: ${stats.rowsRead} gelesene Zeilen > Budget ${stats.limits.maxRowsRead} (${stats.limits.profile ?? '--max-rows-read'}); Sync abgebrochen, Laufzeitmetadaten und Identität wurden nicht geschrieben`);
  }
  if (stats.limits.maxRowsWritten !== undefined && stats.rowsWritten > stats.limits.maxRowsWritten) {
    throw new SyncBudgetExceeded(`Schreibbudget überschritten: ${stats.rowsWritten} geschriebene Zeilen > Budget ${stats.limits.maxRowsWritten} (${stats.limits.profile ?? '--max-rows-written'}); Sync abgebrochen, Laufzeitmetadaten und Identität wurden nicht geschrieben`);
  }
  return stats;
}

export function formatStats(stats) {
  return `${stats.queries} Abfragen in ${stats.batches} Batch(es)/Datei(en), rows_read ${stats.rowsRead}, rows_written ${stats.rowsWritten}, D1-Dauer ${Math.round(stats.durationMs)} ms`;
}

/**
 * Budgetprofil aus data/recht/d1-sync-budgets.json; explizite --max-rows-* Werte gehen vor.
 */
export function resolveBudget(profileName, budgets, { maxRowsRead, maxRowsWritten } = {}) {
  const profile = profileName ? budgets?.profiles?.[profileName] : null;
  if (profileName && !profile) throw new Error(`Unbekanntes Budgetprofil ${profileName}; verfügbar: ${Object.keys(budgets?.profiles ?? {}).join(', ')}`);
  const limits = {
    maxRowsRead: maxRowsRead ?? profile?.maxRowsRead,
    maxRowsWritten: maxRowsWritten ?? profile?.maxRowsWritten,
  };
  if (limits.maxRowsRead === undefined) delete limits.maxRowsRead;
  if (limits.maxRowsWritten === undefined) delete limits.maxRowsWritten;
  if (profileName) limits.profile = profileName;
  return limits;
}

export class SyncBaseMismatch extends Error {}

/**
 * Entscheidet vor dem ersten Schreibzugriff, was ein Lauf tun darf. Reine Funktion über
 *   - requested: 'full' | 'incremental' (Umfang aus den Optionen),
 *   - stored: gespeicherte Identität aus law_runtime_meta (null = nicht lesbar/leer),
 *   - identity: erwartete Identität des Arbeitsbaums im Ziel-Scope,
 *   - baseIdentity: erwartete Identität des Basis-Refs (nur --git-diff) im Vollbestands-Scope,
 *   - recover: ob bei abweichendem Ausgangszustand eine markierte Recovery-Vollprojektion
 *     erlaubt ist (--recover), sonst fail-closed.
 * Ergebnis: { action: 'noop' | 'full' | 'incremental' | 'recovery', reason }.
 *
 * Ein No-op setzt Fingerabdruck UND Scope gleich voraus; ein Fixture-Scope ist nie ein
 * gültiger Basiszustand für den Vollbestand. Ein inkrementeller Lauf verlangt, dass D1
 * genau den Basiszustand trägt (Fingerabdruck des Basis-Refs, Scope `full`, Zustand
 * `complete`); fehlender, abgebrochener (in-progress), fixture- oder fremder Zustand
 * wird nie als Basis anerkannt.
 */
export function decideSyncAction({ requested, stored, identity, baseIdentity = null, recover = false, ignoreFingerprint = false, requiresBase = true }) {
  const storedFingerprint = stored?.projection_fingerprint ?? null;
  const storedScope = stored?.projection_scope ?? (storedFingerprint ? '(unbekannt)' : null);
  const storedState = stored?.sync_state ?? (storedFingerprint ? 'complete' : null);
  const complete = storedState === 'complete';
  if (!ignoreFingerprint && storedFingerprint && storedFingerprint === identity.fingerprint && storedScope === identity.scope && complete) {
    return { action: 'noop', reason: `Fingerabdruck ${identity.fingerprint.slice(0, 16)}… und Scope ${identity.scope} identisch` };
  }
  if (requested === 'full') {
    return { action: 'full', reason: ignoreFingerprint ? '--ignore-fingerprint' : storedFingerprint ? `gespeicherte Identität ${storedFingerprint.slice(0, 16)}… (${storedScope}, ${storedState}) weicht ab` : 'keine gespeicherte Identität' };
  }
  // inkrementell: Basiszustand prüfen
  const problems = [];
  if (!storedFingerprint) problems.push(`D1 trägt keine vollständige Identität (sync_state ${storedState ?? 'fehlt'})`);
  else if (!complete) problems.push(`D1 meldet einen unvollständigen Zustand (${storedState})`);
  if (storedFingerprint && storedScope !== identity.scope) problems.push(`Scope in D1 ist ${storedScope}, erwartet ${identity.scope}`);
  if (baseIdentity) {
    // Übergang: eine vor dem Abschluss-Algorithmus geschriebene Identität desselben Basis-Refs
    // gilt als verifizierte Basis (legacyFingerprint, siehe Fingerprint-Modul und TODO.md).
    const acceptedBases = [baseIdentity.fingerprint, baseIdentity.legacyFingerprint].filter(Boolean);
    if (storedFingerprint && !acceptedBases.includes(storedFingerprint)) problems.push(`Fingerabdruck in D1 ${storedFingerprint.slice(0, 16)}… ≠ erwartete Basis ${baseIdentity.fingerprint.slice(0, 16)}… (${baseIdentity.ref ?? 'Basis'})`);
  } else if (requiresBase) {
    problems.push('kein Basis-Ref zur Verifikation des Ausgangszustands');
  }
  if (problems.length === 0) return { action: 'incremental', reason: `Basiszustand verifiziert (${baseIdentity ? baseIdentity.fingerprint.slice(0, 16) : storedFingerprint.slice(0, 16)}…, Scope ${identity.scope})` };
  if (recover) return { action: 'recovery', reason: `Recovery-Vollprojektion: ${problems.join('; ')}` };
  throw new SyncBaseMismatch(`Inkrementeller Sync abgelehnt (fail-closed): ${problems.join('; ')}. Abhilfe: Vollprojektion mit --full --budget full oder automatische Recovery mit --recover.`);
}

/**
 * Prüft vor dem Planbau, ob Entscheidung und Budgetprofil zusammenpassen. Ein Profil, das keine
 * Vollprojektion trägt (incremental), darf einen `full`-Beschluss nie ausführen: der Lauf endet
 * hier fail-closed, ohne Ableitungen zu rechnen oder Anweisungen zu bauen. Der automatische Sync
 * auf `main` erwartet No-op oder verifizierten inkrementellen Lauf; eine erforderliche
 * Vollprojektion ist ein Release-Gate vor dem Merge (docs/DEPLOYMENT_RUNBOOK.md).
 * @returns {{ ok: boolean, code: 'noop' | 'incremental' | 'recovery' | 'full-gate', message: string }}
 */
export function assessSyncDecision({ decision, scope, budgetProfile = null, limits = {} }) {
  if (decision.action === 'noop') return { ok: true, code: 'noop', message: 'No-op: D1 trägt bereits die Zielidentität; der automatische Sync schreibt nichts.' };
  if (decision.action === 'incremental') {
    const parts = [`${scope.slugs.length} Norm(en)`, `${scope.deletedSlugs.length} Löschung(en)`, `${scope.publicationSlugs.length} Verkündung(en)`];
    if (scope.derivedRebuild) parts.push('abgeleitete Daten aller Normen');
    if (scope.refreshSearchDocuments) parts.push('Suchdokumente aller Normen');
    return { ok: true, code: 'incremental', message: `Inkrementell mit verifizierter Basis: ${parts.join(', ')}.` };
  }
  if (decision.action === 'recovery') return { ok: true, code: 'recovery', message: `Recovery-Vollprojektion mit eigenem Budget (${decision.reason}).` };
  const fullAllowed = budgetProfile === 'full' || budgetProfile === 'recovery' || (!budgetProfile && limits.maxRowsWritten === undefined);
  if (fullAllowed) return { ok: true, code: 'full', message: `Vollprojektion (${decision.reason}); Budget ${budgetProfile ?? 'ohne Grenze'}.` };
  return {
    ok: false,
    code: 'full-gate',
    message: `Vollprojektion erforderlich (${decision.reason}), aber das Budgetprofil ${budgetProfile ?? 'explizit'} trägt keine Vollprojektion. Der automatische Sync führt keine Vollprojektion aus (Tabellen würden geleert). Bei geänderter Projektionslogik ohne Schemaänderung entscheidet der Äquivalenznachweis (npm run norms:runtime:d1-prove -- --base <base>, dann --equivalence-proof <Datei>): nachgewiesen gleiche Daten werden ohne Rebuild übernommen, ein nachgewiesener inkrementeller Umfang wird geschrieben. Sonst Release-Gate: Staging und Produktion bewusst mit --full --budget full auf den Zielstand bringen; danach ist dieser Lauf ein No-op (docs/DEPLOYMENT_RUNBOOK.md, Abschnitt D1-Release-Gate).`,
  };
}

/**
 * Metadata-only-Lauf: verifizierter inkrementeller Lauf, dessen Umfang außer Identität und
 * Laufzeitmetadaten nichts schreibt – entweder ohne jede Logikänderung (der Umfang wurde mit
 * logicChange `full` bestimmt; eine geänderte Logik hätte `full` ergeben) oder mit angewendetem
 * Äquivalenznachweis `identity`/`ignore`, der genau diesen leeren Umfang belegt. Alles andere
 * (Normen, Löschungen, Verkündungen, abgeleitete Daten, Suchdokumente, Nachweis `incremental`
 * oder `narrow`, abweichende Umfangssignatur, No-op, Voll- oder Recovery-Projektion) nimmt den
 * normalen fail-closed Projektionsweg. Reine Funktion. Die Laufzeitmetadaten werden auch im
 * Metadata-only-Lauf aus dem geladenen Bestand neu berechnet: der Nachweis belegt die
 * Datentabellen, nicht die korpusabgeleiteten Zeilen von law_runtime_meta.
 */
export function isMetadataOnlyRun({ decision, scope, proof = null }) {
  if (decision?.action !== 'incremental') return false;
  if (!isEmptyScope(scope)) return false;
  if (!proof) return true;
  return proof.result === 'identity' && proof.logicChange === 'ignore' && proof.scopeSignature === scopeSignature(scope);
}

/**
 * Plan eines Laufs. `buildContext` (korpusweite Ableitungen über buildDerivedContext) wird nur
 * gerufen, wenn der Plan Normen, abgeleitete Daten oder Suchdokumente schreibt; der
 * Metadata-only-Lauf baut den Plan ohne Ableitungskontext (buildSyncPlan prüft das fail-closed).
 * @returns {{ plan: ReturnType<typeof buildSyncPlan>, metadataOnly: boolean }}
 */
export function planRun({ decision, scope, norms, publications, buildContext, now, identity, writeIdentity, proof = null }) {
  const metadataOnly = isMetadataOnlyRun({ decision, scope, proof });
  const context = metadataOnly ? null : buildContext();
  const plan = buildSyncPlan({ scope, norms, publications, context, now, identity, writeIdentity });
  return { plan, metadataOnly };
}

/** Vorabprüfung der Planschätzung gegen das Budget; wirft, bevor irgendetwas geschrieben wird. */
export function assertEstimateWithinBudget(cost, limits) {
  const problems = [];
  if (limits.maxRowsWritten !== undefined && cost.rowsWrittenMax > limits.maxRowsWritten) problems.push(`geschätzte rows_written ${cost.rowsWrittenMax} > Budget ${limits.maxRowsWritten}`);
  if (limits.maxRowsRead !== undefined && cost.rowsReadApprox > limits.maxRowsRead) problems.push(`geschätzte rows_read ${cost.rowsReadApprox} > Budget ${limits.maxRowsRead}`);
  if (problems.length > 0) throw new SyncBudgetExceeded(`Vorabschätzung überschreitet das Budget (${limits.profile ?? 'explizit'}): ${problems.join('; ')}; es wurde nichts geschrieben`);
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

/**
 * Vorübergehende Transport- und Plattformfehler, die je SQL-Datei wiederholt werden: Netzabbrüche,
 * Anmeldelatenz, HTTP 5xx/429 sowie die Wrangler-Meldungen beim Hochladen einer SQL-Datei
 * (Cloudflare antwortet gelegentlich mit ServiceUnavailable). Echte SQL- oder Budgetfehler
 * werden nie wiederholt.
 */
export const TRANSIENT_D1_ERROR = /Network connection lost|Authentication error \[code: 10000\]|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|fetch failed|could not be uploaded|Please retry|ServiceUnavailable|Service Unavailable|InternalError|Internal error|Too Many Requests|\b(?:429|5\d\d)\b/u;
export const D1_FILE_ATTEMPTS = 6;

export function isTransientD1Error(message) {
  return TRANSIENT_D1_ERROR.test(String(message ?? ''));
}

/**
 * Führt eine SQL-Datei aus. Inkrementelle Dateien schreiben ihre Normen vollständig
 * neu (Löschen je Norm über Indizes, anschließend Einfügen), Vollprojektionen leeren
 * die Tabellen zu Beginn; beide dürfen nach einem abgebrochenen Versuch wiederholt
 * werden. Vorübergehende Netz- oder Anmeldefehler der Cloudflare-API werden mit
 * Backoff erneut versucht.
 */
async function executeSqlFile(filePath, { local = false, persistTo, attempts = D1_FILE_ATTEMPTS, databaseName = D1_DATABASE_NAME } = {}) {
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
      if (local || attempt >= attempts || !isTransientD1Error(message)) throw error;
      const delayMs = Math.min(5_000 * attempt, 30_000);
      console.warn(`${filePath.replace(`${ROOT}/`, '')}: vorübergehender Fehler (Versuch ${attempt}/${attempts}), neuer Versuch in ${delayMs / 1000} s`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
}

/** Liest die gespeicherten Fingerabdrücke aus law_runtime_meta (null, wenn nicht lesbar). */
/**
 * Einordnung eines Fehlers beim Lesen der gespeicherten Identität: nur eine noch nicht
 * migrierte Datenbank (fehlende Tabelle) gilt als „keine Identität“. Vorübergehende Transport-
 * fehler werden wiederholt, alles andere bricht ab – ein Lesefehler darf nie als leere Datenbank
 * gelten, sonst würde der automatische Sync eine Recovery-Vollprojektion auslösen.
 * @returns {'missing-table' | 'transient' | 'fatal'}
 */
export function classifyStoredIdentityError(message) {
  const text = String(message ?? '');
  if (/no such table|SQLITE_ERROR.*law_runtime_meta|D1_ERROR: no such table/iu.test(text)) return 'missing-table';
  if (isTransientD1Error(text)) return 'transient';
  return 'fatal';
}

async function readStoredIdentity({ transport, config, local, persistTo, databaseName, stats, attempts = D1_FILE_ATTEMPTS }) {
  const sql = "SELECT key, value FROM law_runtime_meta WHERE key IN ('projection_fingerprint', 'projection_scope', 'sync_state', 'corpus_hash', 'sync_mode', 'last_sync_at', 'norm_count', 'publication_count')";
  for (let attempt = 1; ; attempt += 1) {
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
      // Wie executeSqlFile: die Wrangler-Meldung steht in stdout/stderr, nicht in error.message.
      const message = error instanceof Error ? `${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}` : String(error);
      const kind = classifyStoredIdentityError(message);
      if (kind === 'missing-table') return null;
      if (kind === 'transient' && attempt < attempts) {
        const delayMs = Math.min(5_000 * attempt, 30_000);
        console.warn(`Gespeicherte Identität konnte nicht gelesen werden (Versuch ${attempt}/${attempts}), neuer Versuch in ${delayMs / 1000} s: ${message.trim().slice(-200)}`);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
        continue;
      }
      throw new Error(`Gespeicherte Identität in D1 nicht lesbar (fail-closed, keine Entscheidung ohne Zustand): ${message.trim().slice(-300)}`);
    }
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
export async function resolveScope(args, { norms, publications, logicPaths = null, logicChange = 'full' }) {
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
  let portalProjectionChanged = () => true;
  // Bisheriger Stichtag für eine Stichtagsfortschreibung: aus dem Basis-Ref (--git-diff) oder
  // ausdrücklich (--reference-date-from); ohne Angabe bleibt editorial.json ein Full-Trigger.
  let previousReferenceDate = valueAfter(args, '--reference-date-from') ?? null;
  if (previousReferenceDate) assertIsoDate(previousReferenceDate, '--reference-date-from');
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
    // Themen und Presse: nur ein geänderter projektionsrelevanter Auszug (Slug, Titel, Datum,
    // Normbezüge) erneuert die abgeleiteten Daten; Hervorhebungen, Teaser usw. lösen nichts aus.
    const portalCache = new Map();
    for (const path of paths.filter((entry) => PORTAL_CONTENT_PATTERN.test(entry))) {
      portalCache.set(path, await portalProjectionChangedSince(ROOT, base, path));
    }
    portalProjectionChanged = (path) => portalCache.get(path) ?? true;
    if (!previousReferenceDate && paths.includes(REFERENCE_DATE_PATH)) {
      previousReferenceDate = (await gitShowJson(base, REFERENCE_DATE_PATH))?.referenceDate ?? null;
    }
  } else {
    const file = valueAfter(args, '--changed-paths');
    if (!file) throw new Error('--changed-paths braucht eine Datei');
    paths = (await readFile(resolve(ROOT, file), 'utf8')).split(/\r?\n/u).filter(Boolean);
  }
  const referenceDateSlugs = previousReferenceDate && typeof previousReferenceDate === 'string'
    ? () => referenceDateAffectedSlugs(norms, previousReferenceDate, EDITORIAL_REFERENCE_DATE)
    : null;
  if (args.includes('--assume-narrow-logic-change')) throw new Error('--assume-narrow-logic-change gibt es nicht mehr: eine enge Logikprojektion wird mit --prove-equivalence oder --equivalence-proof <Datei> nachgewiesen, nicht angenommen');
  const scope = scopeFromChangedPaths(paths, { existingSlugs, existingPublications, identityChanged, referenceDateSlugs, logicPaths, logicChange, portalProjectionChanged });
  if (referenceDateSlugs && paths.includes(REFERENCE_DATE_PATH)) scope.referenceDate = { from: previousReferenceDate, to: EDITORIAL_REFERENCE_DATE };
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
 * geladenen Bestand; Tests prüfen damit Umfang und Kostenpfad ohne Datenbank. `context` darf
 * nur fehlen, wenn der Umfang leer ist (Metadata-only-Lauf, planRun).
 */
export function buildSyncPlan({ scope, norms, publications, context, now, fingerprint, identity = fingerprint, writeIdentity = true }) {
  const full = scope.mode === 'full';
  const selectedSlugs = new Set(scope.slugs);
  const selected = full ? norms : norms.filter((norm) => selectedSlugs.has(norm.meta.slug));
  // Fail-closed: ohne Ableitungskontext darf der Plan weder Normen noch abgeleitete Daten oder
  // Suchdokumente schreiben – nur der leere Umfang kommt ohne Kontext aus.
  if (!context && (full || scope.slugs.length > 0 || scope.derivedRebuild || scope.refreshSearchDocuments)) {
    throw new Error('Ableitungskontext fehlt: dieser Umfang schreibt Normen, abgeleitete Daten oder Suchdokumente und kann kein Metadata-only-Plan sein (fail-closed)');
  }
  const groups = [];
  if (full) groups.push({ slug: '(reset)', queries: fullResetQueries() });
  else if (writeIdentity) groups.push({ slug: '(identität entwerten)', queries: incrementalStartQueries(now) });
  for (const slug of scope.deletedSlugs) groups.push({ slug: `(löschen ${slug})`, queries: deleteNormQueries(slug) });
  let searchUnitCount = 0;
  for (const norm of selected) {
    const queries = normQueries(norm, context, now, { full });
    searchUnitCount += queries.filter((query) => query.sql.startsWith('INSERT INTO law_search_units')).length;
    groups.push({ slug: norm.meta.slug, queries });
  }
  let derivedCount = 0;
  let documentRefreshCount = 0;
  if (!full && (scope.derivedRebuild || scope.refreshSearchDocuments)) {
    for (const norm of norms) {
      if (selectedSlugs.has(norm.meta.slug)) continue;
      const queries = [
        ...(scope.derivedRebuild ? derivedQueries(norm, context, now) : []),
        ...(scope.refreshSearchDocuments ? searchDocumentQueries(norm, context, now) : []),
      ];
      groups.push({ slug: `(abgeleitet ${norm.meta.slug})`, queries });
      if (scope.derivedRebuild) derivedCount += 1;
      if (scope.refreshSearchDocuments) documentRefreshCount += 1;
    }
  }
  const publicationSelection = full ? publications : publications.filter((publication) => scope.publicationSlugs.includes(publication.slug));
  const finalQueries = [
    ...scope.deletedPublications.flatMap((slug) => deletePublicationQueries(slug)),
    ...publicationSelection.flatMap((publication) => publicationQueries(publication, now)),
    ...(full || writeIdentity ? runtimeMetaQueries({ now, norms, publications, identity, mode: scope.mode }) : partialMetaQueries({ now, mode: 'manual-partial' })),
  ];
  groups.push({ slug: '(verkuendungen+meta)', queries: finalQueries });
  const all = groups.flatMap((group) => group.queries);
  return {
    full,
    groups,
    selected,
    derivedCount,
    documentRefreshCount,
    publicationCount: publicationSelection.length,
    searchUnitCount,
    statementCount: all.length,
    byStatement: summarizeStatements(all),
  };
}

export const DEFAULT_ESTIMATE = { writtenPerStatement: 1.25, writtenPerSearchUnit: 14, readPerStatementFull: 1.0, readPerStatementIncremental: 2.0 };

/**
 * Konservative Kostenschätzung eines Plans (Zeilen), kalibriert an der produktiven
 * Vollprojektion vom 3. September 2026 (103.127 Anweisungen, 38.561 Suchprovisionen →
 * gemessen 103.403 gelesene / 465.926 geschriebene Zeilen): D1 zählt je Anweisung die
 * Zeile selbst, Indexzeilen und die FTS5-Schattentabellen der Provisionen mit.
 */
export function estimatePlanCost(plan, estimate = DEFAULT_ESTIMATE) {
  const inserts = Object.entries(plan.byStatement).filter(([key]) => key.startsWith('insert')).reduce((sum, [, count]) => sum + count, 0);
  const statements = plan.statementCount;
  const rowsWrittenMax = Math.ceil(statements * estimate.writtenPerStatement + plan.searchUnitCount * estimate.writtenPerSearchUnit);
  return {
    rowsWrittenMin: inserts,
    rowsWrittenMax,
    rowsReadApprox: Math.ceil(statements * (plan.full ? estimate.readPerStatementFull : estimate.readPerStatementIncremental)) + 16,
  };
}

async function main() {
  const args = process.argv.slice(2);
  // --remote-state: nur Identität, gespeicherte Identität, Umfang und Entscheidung – ohne
  // Ableitungen und ohne Sync-Plan (Sekunden statt Minuten); schreibt nie.
  const remoteState = args.includes('--remote-state');
  const dryRun = args.includes('--dry-run') || remoteState;
  const batchSize = Number.parseInt(valueAfter(args, '--batch-size') ?? String(DEFAULT_BATCH_SIZE), 10);
  const config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.OSTRECHT_D1_DATABASE_ID ?? DEFAULT_D1_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  };
  const local = args.includes('--local');
  const applySchema = args.includes('--apply-schema');
  const ignoreFingerprint = args.includes('--ignore-fingerprint');
  const recover = args.includes('--recover');
  const budgetProfile = valueAfter(args, '--budget');
  const proofFile = valueAfter(args, '--equivalence-proof');
  if (args.includes('--stamp-fingerprint')) throw new Error('--stamp-fingerprint gibt es nicht mehr: eine unveränderte Projektion wird mit dem Äquivalenznachweis (scripts/d1-projection-snapshot.mjs prove, dann --git-diff … --equivalence-proof <Datei>) belegt und die Identität ohne Daten-Rebuild übernommen');
  if (args.includes('--prove-equivalence')) throw new Error('--prove-equivalence gibt es nicht: den Nachweis erzeugt scripts/d1-projection-snapshot.mjs prove --base <base>; der Sync prüft ihn mit --equivalence-proof <Datei>');
  if (proofFile && !args.includes('--git-diff')) throw new Error('--equivalence-proof gibt es nur mit --git-diff <base> <head>');
  const budgets = JSON.parse(await readFile(BUDGETS_PATH, 'utf8'));
  // Zieldatenbank des Wrangler-Transports (z. B. ostrecht-recht-staging); die API
  // adressiert über OSTRECHT_D1_DATABASE_ID.
  const databaseName = valueAfter(args, '--database') ?? D1_DATABASE_NAME;
  const persistTo = resolve(ROOT, valueAfter(args, '--persist-to') ?? join('.cache', 'wrangler-local'));
  const transport = valueAfter(args, '--transport') ?? (local ? 'wrangler' : config.apiToken ? 'api' : 'wrangler');
  const explicitLimits = { maxRowsRead: integerAfter(args, '--max-rows-read'), maxRowsWritten: integerAfter(args, '--max-rows-written') };
  const stats = createStats(resolveBudget(budgetProfile, budgets, explicitLimits));
  const corpusFilter = valueAfter(args, '--corpus-filter');
  // Ein Fixture darf nie die produktive Datenbank treffen (Vollprojektion würde den Bestand
  // auf das Fixture reduzieren): nur lokal oder gegen eine ausdrücklich andere Datenbank (Staging).
  const targetsProduction = transport === 'api' ? config.databaseId === DEFAULT_D1_DATABASE_ID : !local && databaseName === PRODUCTION_DATABASE_NAME;
  if (corpusFilter && targetsProduction) throw new Error('--corpus-filter ist nur lokal oder gegen eine Staging-Datenbank zulässig (Testfixture)');
  if (targetsProduction && !dryRun && !stats.limits.maxRowsWritten) console.warn('Hinweis: kein Schreibbudget gesetzt (--budget <Profil> oder --max-rows-written); der automatische Sync verwendet immer ein Profil.');
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
  // Projektionsidentität im Ziel-Scope: Vollbestand oder Fixture (Pfad + Inhaltshash).
  const scopeId = corpusFilter ? await fixtureScope(ROOT, corpusFilter) : FULL_SCOPE;
  const fingerprint = await projectionIdentity({ root: ROOT, scope: scopeId });
  console.log(`Projektionsidentität ${fingerprint.fingerprint.slice(0, 16)}… (Scope ${fingerprint.scope}, Logik ${fingerprint.logic.slice(0, 12)}…, Bestand ${fingerprint.corpus.slice(0, 12)}…, Portal ${fingerprint.portal.slice(0, 12)}…)`);
  const canReadTarget = !dryRun || transport === 'wrangler' || Boolean(config.apiToken);
  const stored = canReadTarget ? await readStoredIdentity({ transport, config, local, persistTo, databaseName, stats }) : null;
  if (stored) console.log(`D1 trägt: Fingerabdruck ${stored.projection_fingerprint?.slice(0, 16) ?? '(keiner)'}…, Scope ${stored.projection_scope ?? '(keiner)'}, Zustand ${stored.sync_state ?? '(keiner)'}, Modus ${stored.sync_mode ?? '?'}, letzter Sync ${stored.last_sync_at ?? '?'}`);
  else console.log(canReadTarget ? 'D1 trägt keine lesbare Identität.' : 'Identität in D1 nicht geprüft (Dry-run ohne Zugang).');

  const [loadedNorms, publications, topics, pressReleases] = await Promise.all([
    loadAllNorms(), loadAllVerkuendungen(), loadTopics(), loadPressReleases(),
  ]);
  const norms = corpusFilter ? applyCorpusFilter(loadedNorms, JSON.parse(await readFile(resolve(ROOT, corpusFilter), 'utf8')), corpusFilter) : loadedNorms;
  console.log(`${loadedNorms.length} Normen und ${publications.length} Verkündungen geladen und validiert (${Math.round((Date.now() - startedAt) / 1000)} s)${corpusFilter ? `; Fixture ${corpusFilter}: ${norms.length} Normen` : ''}`);
  // Entscheidung vor dem ersten Schreibzugriff: No-op, Vollprojektion, verifizierter
  // inkrementeller Lauf oder markierte Recovery (fail-closed bei abweichender Basis).
  const gitDiffBase = args.includes('--git-diff') ? args[args.indexOf('--git-diff') + 1] : null;
  const baseIdentity = gitDiffBase ? await projectionIdentityAtRef(gitDiffBase, { root: ROOT, scope: scopeId }) : null;
  if (baseIdentity) console.log(`Erwartete Basisidentität ${gitDiffBase}: ${baseIdentity.fingerprint.slice(0, 16)}…${baseIdentity.legacyFingerprint ? ` (frühere Berechnung ${baseIdentity.legacyFingerprint.slice(0, 16)}…)` : ''}`);
  // Logikänderungen sind genau die geänderten Dateien des Code-Abschlusses von Basis oder Ziel;
  // ist ein Abschluss unsicher, gilt fail-closed die konservative Obermenge.
  const logicPaths = fingerprint.closureUncertain || Boolean(baseIdentity?.closureUncertain) ? null : new Set([...fingerprint.logicFiles, ...(baseIdentity?.logicFiles ?? [])]);
  if (!logicPaths) console.log(`Code-Abschluss unsicher (${[...fingerprint.closureReasons, ...(baseIdentity?.closureReasons ?? [])].join('; ') || 'ohne Angabe'}); Logikänderungen zählen über die konservative Obermenge.`);
  let scope = await resolveScope(args, { norms, publications, logicPaths });
  const decide = (requested) => decideSyncAction({
    requested,
    stored,
    identity: fingerprint,
    baseIdentity,
    recover,
    ignoreFingerprint,
    // Manuelle Auswahl (--slug/--publications/--changed-paths) kennt keinen Basis-Ref; sie
    // verlangt trotzdem eine vollständige Identität im selben Scope.
    requiresBase: Boolean(gitDiffBase),
  });
  let decision;
  try {
    decision = decide(scope.mode);
  } catch (error) {
    // Im Dry-run ist die Ablehnung das Ergebnis der Prüfung, kein Fehler: der Lauf schreibt
    // nichts und meldet, dass ein echter Lauf fail-closed abbrechen bzw. --recover brauchen würde.
    if (!(error instanceof SyncBaseMismatch) || !dryRun) throw error;
    console.log(`Dry-run: ${error.message}`);
    console.log(`Kosten dieser Prüfung: ${formatStats(stats)}`);
    return;
  }
  console.log(`Entscheidung: ${decision.action} – ${decision.reason}`);
  // Entscheidung gegen das Budgetprofil prüfen, bevor Ableitungen gerechnet oder Anweisungen
  // gebaut werden: eine nicht tragbare Vollprojektion endet hier, nicht nach dem Planbau.
  let assessment = assessSyncDecision({ decision, scope, budgetProfile, limits: stats.limits });
  // Der angewendete Nachweis bleibt für den Planbau sichtbar (Metadata-only-Lauf, isMetadataOnlyRun).
  let appliedProof = null;
  if (!assessment.ok && assessment.code === 'full-gate' && gitDiffBase && proofFile) {
    // Äquivalenznachweis statt Vollprojektion: jede Bindung wird geprüft, bevor der nachgewiesene
    // Umfang gilt (scripts/lib/d1-projection-proof-format.mjs).
    const proof = await readProof(resolve(ROOT, proofFile));
    const validation = validateProof(proof, { storedFingerprint: stored?.projection_fingerprint ?? null, headIdentity: fingerprint, scope: scopeId });
    if (!validation.ok) {
      const message = `Äquivalenznachweis nicht anwendbar (fail-closed): ${validation.problems.join('; ')}`;
      if (proof?.result === 'full') assessment = { ok: false, code: 'full-gate', message: `${assessment.message} Nachweis: ${describeProofResult(proof)}.` };
      else assessment = { ok: false, code: 'proof-invalid', message };
    } else {
      scope = await resolveScope(args, { norms, publications, logicPaths, logicChange: proof.logicChange });
      if (scope.mode !== 'incremental' || scopeSignature(scope) !== proof.scopeSignature) {
        assessment = { ok: false, code: 'proof-scope-mismatch', message: `Äquivalenznachweis nicht anwendbar (fail-closed): der Umfang dieses Laufs entspricht nicht dem nachgewiesenen Umfang (${scope.mode}; ${scope.reasons.slice(0, 3).join('; ')})` };
      } else {
        decision = decide('incremental');
        appliedProof = proof;
        assessment = assessSyncDecision({ decision, scope, budgetProfile, limits: stats.limits });
        console.log(`Äquivalenznachweis (${proof.head.commit.slice(0, 9)} gegen ${proof.base.commit.slice(0, 9)}): ${describeProofResult(proof)}`);
        console.log(`Entscheidung: ${decision.action} – ${decision.reason}`);
      }
    }
  }
  if (remoteState) {
    console.log(`Remote-State: ${assessment.message}`);
    console.log(`Kosten dieser Prüfung: ${formatStats(stats)}`);
    if (!assessment.ok) {
      console.error(`Remote-State: der automatische Sync würde fehlschlagen (${assessment.code}).`);
      process.exitCode = REMOTE_STATE_GATE_EXIT_CODE;
    }
    return;
  }
  if (!assessment.ok) throw new Error(assessment.message);
  if (decision.action === 'noop') {
    console.log(`D1-Projektion ist bereits exakt aktuell (letzter Sync ${stored?.last_sync_at ?? '?'}, Modus ${stored?.sync_mode ?? '?'}); kein Sync erforderlich.`);
    console.log(`Kosten dieser Prüfung: ${formatStats(stats)}`);
    return;
  }
  if (decision.action === 'recovery') {
    scope = { mode: 'full', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: [decision.reason] };
    if (!budgetProfile && explicitLimits.maxRowsWritten === undefined) Object.assign(stats.limits, resolveBudget('recovery', budgets));
    else if (budgetProfile && budgetProfile !== 'recovery' && budgetProfile !== 'full') Object.assign(stats.limits, resolveBudget('recovery', budgets, explicitLimits));
    console.log(`Recovery-Vollprojektion (Budget ${stats.limits.profile ?? 'explizit'}: rows_read ≤ ${stats.limits.maxRowsRead ?? '∞'}, rows_written ≤ ${stats.limits.maxRowsWritten ?? '∞'})`);
  }
  const full = scope.mode === 'full';
  console.log(full
    ? 'Umfang: Vollprojektion (Tabellen werden einmalig geleert, keine normweisen Löschungen)'
    : `Umfang: ${scope.slugs.length} Norm(en), ${scope.deletedSlugs.length} Löschung(en), ${scope.publicationSlugs.length} Verkündung(en)${scope.derivedRebuild ? ', abgeleitete Daten aller Normen' : ''}${scope.refreshSearchDocuments ? ', Suchdokumente aller Normen' : ''}${scope.reasons.length ? ` – ${scope.reasons.slice(0, 3).join('; ')}` : ''}`);
  if (scope.referenceDate) console.log(`Stichtag: ${scope.referenceDate.from} → ${scope.referenceDate.to}; betroffene Normen: ${scope.slugs.join(', ') || '(keine)'}`);
  const now = new Date().toISOString();
  // Identität nur bei Vollprojektion und verifiziertem Git-Diff schreiben; manuelle Teilsyncs
  // lassen die gespeicherte Identität unverändert (siehe partialMetaQueries).
  const writeIdentity = full || Boolean(gitDiffBase);
  // Korpusweite Ableitungen nur, wenn der Plan sie schreibt: der nachgewiesen datenneutrale leere
  // Umfang (isMetadataOnlyRun) erzeugt den Metadata-only-Plan ohne Ableitungskontext.
  const { plan, metadataOnly } = planRun({
    decision, scope, norms, publications, now, identity: fingerprint, writeIdentity, proof: appliedProof,
    buildContext: () => buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl, asOf: EDITORIAL_REFERENCE_DATE }),
  });
  if (metadataOnly) {
    console.log(`Umfang leer und nachgewiesen datenneutral: Metadata-only-Plan (Identität und Laufzeitmetadaten aus dem geladenen Bestand), keine korpusweiten Ableitungen berechnet (${Math.round((Date.now() - startedAt) / 1000)} s)`);
    // Plausibilität, kein Gate: unter leerem Umfang ändern sich die Zähler nicht; eine Abweichung
    // deutet auf einen fremden Zustand in D1 hin (die Basis prüft decideSyncAction über die Identität).
    for (const [key, actual] of [['norm_count', norms.length], ['publication_count', publications.length]]) {
      const storedValue = stored?.[key];
      if (storedValue !== undefined && storedValue !== null && Number(storedValue) !== actual) console.warn(`Hinweis: ${key} in D1 (${storedValue}) weicht vom geladenen Bestand (${actual}) ab; die Laufzeitmetadaten werden aus dem Bestand neu geschrieben.`);
    }
  } else {
    console.log(`Korpusweite Ableitungen berechnet (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  }
  const cost = estimatePlanCost(plan, budgets.estimate ?? DEFAULT_ESTIMATE);
  console.log(`Plan: ${plan.selected.length} Normen, ${scope.deletedSlugs.length} Löschungen, ${plan.derivedCount} abgeleitete Datensätze, ${plan.documentRefreshCount} Normen mit erneuerten Suchdokumenten, ${plan.publicationCount} Verkündungen, ${plan.searchUnitCount} Suchprovisionen, ${plan.statementCount} Anweisungen`);
  console.log(`Anweisungen je Tabelle: ${JSON.stringify(plan.byStatement)}`);
  console.log(`Schätzung: rows_written ≈ ${cost.rowsWrittenMin}–${cost.rowsWrittenMax}, rows_read ≈ ${cost.rowsReadApprox}; Budget ${stats.limits.profile ?? (stats.limits.maxRowsWritten ? 'explizit' : 'keins')}: rows_read ≤ ${stats.limits.maxRowsRead ?? '∞'}, rows_written ≤ ${stats.limits.maxRowsWritten ?? '∞'}`);
  if (!dryRun) assertEstimateWithinBudget(cost, stats.limits);

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

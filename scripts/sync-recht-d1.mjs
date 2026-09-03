#!/usr/bin/env node --experimental-strip-types

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { buildDerivedContext, deriveNorm, fullCitationFor } from '@ostrecht/shared/lib/norms/derived.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { classifyNormVersion, getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { getPressReleaseUrl, getTopicUrl } from '@ostrecht/shared/lib/portal/routes.ts';
import { loadPressReleases, loadTopics } from '@ostrecht/shared/lib/portal/content.ts';
import { buildSearchDocument } from '@ostrecht/recht-search/search.ts';

/**
 * Spiegelt content/normen und content/verkuendungen nach Cloudflare D1 – die
 * abgeleitete Runtime-Projektion von OstRecht. Git bleibt fachlicher Source of
 * Truth; alle korpusweiten Ableitungen (Beziehungen, Empfehlungen, Herkunft,
 * Textverweise, Vollzitate, Verkündungsbezüge, Portalbezüge) werden hier aus dem
 * vollständigen Bestand berechnet und je Norm gespeichert, damit die Website zur
 * Laufzeit nur die Zeilen der angefragten Norm lesen muss.
 *
 * Schema: data/recht/d1/0001_rechtsbestand.sql + 0002_runtime_projection.sql.
 *
 * Transport:
 *   --transport api       D1-REST-API mit parametrisierten Batches (CLOUDFLARE_API_TOKEN)
 *   --transport wrangler  SQL-Dateien unter .cache/d1-sync/ und
 *                         `wrangler d1 execute ostrecht-recht --remote --file` mit der
 *                         lokalen Wrangler-Anmeldung; Parameter werden als SQL-Literale
 *                         gerendert, Blöcke über 40.000 Zeichen in Teile zerlegt.
 * Ohne Angabe wird die API verwendet, wenn ein Token gesetzt ist, sonst Wrangler.
 * `--dry-run` validiert alle Normen und schreibt beim Wrangler-Transport die SQL-Dateien
 * zur Kontrolle, ohne sie auszuführen. `--slug` synchronisiert einzelne Normen (dann
 * werden keine veralteten Zeilen gelöscht).
 */

const ROOT = resolve(process.cwd());
const MAX_BLOCK_PART_CHARS = 40_000;
const MAX_SEARCH_BODY_CHARS = 40_000;
const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_SQL_FILE_STATEMENTS = 1500;
const DEFAULT_SQL_FILE_BYTES = 6_000_000;
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '28871b9b1c6753235a331544f7c68460';
const DEFAULT_D1_DATABASE_ID = '2491f200-de20-4a45-b028-d00a4fd57840';
const D1_DATABASE_NAME = 'ostrecht-recht';
const execFileAsync = promisify(execFile);

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
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

export function normQueries(norm, context, now) {
  const { meta, history, versions } = norm;
  const current = getApplicableVersion(norm);
  const currentIdentity = getNormVersionIdentity(norm, current);
  const derived = deriveNorm(norm, context);
  const sourceOf = (version) => (version.sourceReferences ?? []).find((source) => source.kind === 'revosax-snapshot') ?? (version.sourceReferences ?? [])[0] ?? null;
  const lawId = [...(current.sourceReferences ?? []), ...(meta.sourceReferences ?? [])].map((source) => source.lawId).find(Boolean) ?? null;
  const sourceKind = [...(current.sourceReferences ?? []), ...(meta.sourceReferences ?? [])].some((source) => source.kind === 'revosax-snapshot') ? 'revosax-baseline' : 'repository';
  const queries = [
    q('DELETE FROM law_search WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_source_objects WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_version_blocks WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_versions WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_norm_derived WHERE norm_id = ?', [meta.id]),
    q(`INSERT INTO law_norms (
      id, slug, title, short_title, abbr, type, status, revosax_law_id, current_version_id,
      document_date, publication_date, effective_date, expiry_date, initial_citation, summary,
      responsible_ministry, enacting_body, source_kind, updated_at, meta_json, history_json, sort_title, current_valid_from
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug=excluded.slug, title=excluded.title, short_title=excluded.short_title, abbr=excluded.abbr,
      type=excluded.type, status=excluded.status, revosax_law_id=excluded.revosax_law_id,
      current_version_id=excluded.current_version_id, document_date=excluded.document_date,
      publication_date=excluded.publication_date, effective_date=excluded.effective_date,
      expiry_date=excluded.expiry_date, initial_citation=excluded.initial_citation,
      summary=excluded.summary, responsible_ministry=excluded.responsible_ministry,
      enacting_body=excluded.enacting_body, source_kind=excluded.source_kind, updated_at=excluded.updated_at,
      meta_json=excluded.meta_json, history_json=excluded.history_json, sort_title=excluded.sort_title,
      current_valid_from=excluded.current_valid_from`, [
      meta.id, meta.slug, currentIdentity.title, currentIdentity.shortTitle, currentIdentity.abbr ?? null, meta.type, meta.status,
      lawId, current.versionId, meta.documentDate ?? null, meta.publicationDate ?? null,
      meta.effectiveDate ?? null, meta.expiryDate ?? null, meta.initialCitation, meta.summary,
      meta.responsibleMinistry ?? meta.ministry ?? null, meta.enactingBody ?? null, sourceKind, now,
      JSON.stringify(meta), JSON.stringify(history), currentIdentity.title.toLocaleLowerCase('de'), current.validFrom,
    ]),
  ];

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
      queries.push(q(`INSERT INTO law_search (
        norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        meta.id, current.versionId, `${unit.unitIndex}`, unit.anchor, unit.blockType, unit.references ? JSON.stringify(unit.references) : null,
        meta.slug, currentIdentity.title, currentIdentity.shortTitle, currentIdentity.abbr ?? '', unit.label, unit.heading, unit.body,
      ]));
    }
  }

  return queries;
}

export function publicationQueries(publication, now) {
  return [q(`INSERT INTO law_publications (slug, publication_date, publication, year, issue, publication_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET publication_date=excluded.publication_date, publication=excluded.publication,
      year=excluded.year, issue=excluded.issue, publication_json=excluded.publication_json, updated_at=excluded.updated_at`, [
    publication.slug, publication.date, publication.publication, publication.year, publication.issue, JSON.stringify(publication), now,
  ])];
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

async function sendBatches(config, queries, batchSize) {
  for (let index = 0; index < queries.length; index += batchSize) {
    await cloudflareQuery(config, queries.slice(index, index + batchSize));
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

async function executeSqlFile(filePath) {
  const { stdout, stderr } = await runWrangler(['d1', 'execute', D1_DATABASE_NAME, '--remote', '--yes', '--json', '--file', filePath]);
  const jsonStart = stdout.indexOf('[');
  const payload = jsonStart >= 0 ? JSON.parse(stdout.slice(jsonStart)) : null;
  if (!Array.isArray(payload) || payload.some((result) => result.success === false)) {
    throw new Error(`wrangler d1 execute ${filePath}: ${(stderr || stdout).trim().slice(-400)}`);
  }
  return payload;
}

async function main() {
  const args = process.argv.slice(2);
  const requestedSlugs = valuesAfter(args, '--slug');
  const dryRun = args.includes('--dry-run');
  const batchSize = Number.parseInt(valueAfter(args, '--batch-size') ?? String(DEFAULT_BATCH_SIZE), 10);
  const config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.OSTRECHT_D1_DATABASE_ID ?? DEFAULT_D1_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  };
  const transport = valueAfter(args, '--transport') ?? (config.apiToken ? 'api' : 'wrangler');
  if (!['api', 'wrangler'].includes(transport)) throw new Error(`Unbekannter Transport ${transport}`);
  if (!dryRun && transport === 'api' && !config.apiToken) throw new Error('CLOUDFLARE_API_TOKEN ist für --transport api erforderlich');

  const startedAt = Date.now();
  const [norms, publications, topics, pressReleases] = await Promise.all([
    loadAllNorms(), loadAllVerkuendungen(), loadTopics(), loadPressReleases(),
  ]);
  console.log(`${norms.length} Normen und ${publications.length} Verkündungen geladen und validiert (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const context = buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl });
  console.log(`Korpusweite Ableitungen berechnet (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const selected = requestedSlugs.length > 0
    ? requestedSlugs.map((slug) => norms.find((norm) => norm.meta.slug === slug) ?? (() => { throw new Error(`Norm ${slug} nicht gefunden`); })())
    : norms;
  const now = new Date().toISOString();
  let queryCount = 0;
  const normStatements = [];
  const apiQueue = [];
  for (const [index, norm] of selected.entries()) {
    const queries = normQueries(norm, context, now);
    queryCount += queries.length;
    if (transport === 'api') apiQueue.push(...queries);
    else normStatements.push({ slug: norm.meta.slug, statements: queries.map(renderStatement) });
    if ((index + 1) % 100 === 0 || index === selected.length - 1) {
      console.log(`[${index + 1}/${selected.length}] ${norm.meta.slug}: ${queries.length} D1-Operationen vorbereitet`);
    }
  }
  const publicationStatements = publications.flatMap((publication) => publicationQueries(publication, now));
  const finalQueries = [
    ...publicationStatements,
    ...(requestedSlugs.length === 0
      ? [
          q('DELETE FROM law_publications WHERE updated_at < ?', [now]),
          q('DELETE FROM law_norms WHERE updated_at < ?', [now]),
          q('DELETE FROM law_search_documents WHERE updated_at < ?', [now]),
        ]
      : []),
    q(`INSERT INTO law_runtime_meta (key, value) VALUES ('last_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [now]),
    q(`INSERT INTO law_runtime_meta (key, value) VALUES ('norm_count', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [String(norms.length)]),
    q(`INSERT INTO law_runtime_meta (key, value) VALUES ('publication_count', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [String(publications.length)]),
  ];

  if (transport === 'api') {
    if (!dryRun) {
      await sendBatches(config, apiQueue, batchSize);
      await sendBatches(config, finalQueries, batchSize);
    }
  } else {
    normStatements.push({ slug: '(verkuendungen+meta)', statements: finalQueries.map(renderStatement) });
    const files = groupStatementFiles(normStatements);
    const runDirectory = join(ROOT, '.cache', 'd1-sync', now.replace(/[:.]/gu, '-'));
    await mkdir(runDirectory, { recursive: true });
    for (const [index, file] of files.entries()) {
      const filePath = join(runDirectory, `batch-${String(index + 1).padStart(4, '0')}.sql`);
      await writeFile(filePath, `${file.statements.join('\n')}\n`, 'utf8');
      if (!dryRun) {
        await executeSqlFile(filePath);
        console.log(`SQL-Datei ${index + 1}/${files.length} (${file.slugs.length} Normen, ${file.statements.length} Anweisungen) ausgeführt`);
      }
    }
    console.log(`${files.length} SQL-Datei(en) unter ${runDirectory.replace(`${ROOT}/`, '')}${dryRun ? ' geschrieben (nicht ausgeführt)' : ' ausgeführt'}`);
  }
  console.log(`${selected.length} Normen, ${publications.length} Verkündungen, ${queryCount} Inhaltsoperationen${dryRun ? ' validiert' : ' nach D1 übertragen'} (${Math.round((Date.now() - startedAt) / 1000)} s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

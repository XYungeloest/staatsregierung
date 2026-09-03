#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

/**
 * Spiegelt content/normen nach Cloudflare D1 (abgeleitete Runtime-Projektion).
 *
 * Transport:
 *   --transport api       D1-REST-API mit parametrisierten Batches (CLOUDFLARE_API_TOKEN)
 *   --transport wrangler  SQL-Dateien unter .cache/d1-sync/ und
 *                         `wrangler d1 execute ostrecht-recht --remote --file` mit der lokalen
 *                         Wrangler-Anmeldung; Parameter werden als SQL-Literale gerendert.
 * Ohne Angabe wird die API verwendet, wenn ein Token gesetzt ist, sonst Wrangler.
 * `--dry-run` validiert alle Normen und schreibt beim Wrangler-Transport die SQL-Dateien
 * zur Kontrolle, ohne sie auszuführen.
 */

const ROOT = resolve(process.cwd());
const CONTENT_ROOT = join(ROOT, 'content', 'normen');
const MAX_D1_TEXT_BYTES = 1_800_000;
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function listSlugs() {
  const entries = await readdir(CONTENT_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function loadNorm(slug) {
  const base = join(CONTENT_ROOT, slug);
  const [meta, history, versionEntries] = await Promise.all([
    readJson(join(base, 'meta.json')),
    readJson(join(base, 'history.json')),
    readdir(join(base, 'versions'), { withFileTypes: true }),
  ]);
  const versions = [];
  for (const entry of versionEntries.filter((item) => item.isFile() && item.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
    versions.push(await readJson(join(base, 'versions', entry.name)));
  }
  return { meta, history, versions };
}

function currentVersion(norm) {
  return norm.versions.find((version) => version.isCurrent) ?? norm.versions.at(-1);
}

function sourceLawId(meta, version) {
  return [...(version.sourceReferences ?? []), ...(meta.sourceReferences ?? [])]
    .map((source) => source.lawId)
    .find(Boolean) ?? null;
}

function sourceKind(meta, version) {
  return [...(version.sourceReferences ?? []), ...(meta.sourceReferences ?? [])]
    .some((source) => source.kind === 'revosax-snapshot') ? 'revosax-baseline' : 'repository';
}

function textBytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function blockText(block) {
  return [block.text, ...(block.children ?? []).map(blockText)].filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim();
}

function flattenSearchBlocks(blocks, path = [], output = []) {
  for (const [index, block] of blocks.entries()) {
    const label = block.label ?? '';
    const heading = block.title ?? '';
    const nextPath = [...path, label || `${block.type}-${index + 1}`];
    const searchableTypes = new Set(['paragraph', 'article', 'section', 'subsection', 'annex', 'chapter', 'part']);
    if (searchableTypes.has(block.type)) {
      output.push({
        path: nextPath.join(' > '),
        label,
        heading,
        body: blockText(block),
      });
    }
    if (Array.isArray(block.children)) flattenSearchBlocks(block.children, nextPath, output);
  }
  return output;
}

function q(sql, params = []) {
  return { sql, params };
}

function normQueries(norm, now) {
  const { meta, versions } = norm;
  const current = currentVersion(norm);
  if (!current) throw new Error(`${meta.slug}: keine Fassung vorhanden`);
  const queries = [
    q('DELETE FROM law_search WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_source_objects WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_version_blocks WHERE norm_id = ?', [meta.id]),
    q('DELETE FROM law_versions WHERE norm_id = ?', [meta.id]),
    q(`INSERT INTO law_norms (
      id, slug, title, short_title, abbr, type, status, revosax_law_id, current_version_id,
      document_date, publication_date, effective_date, expiry_date, initial_citation, summary,
      responsible_ministry, enacting_body, source_kind, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug=excluded.slug, title=excluded.title, short_title=excluded.short_title, abbr=excluded.abbr,
      type=excluded.type, status=excluded.status, revosax_law_id=excluded.revosax_law_id,
      current_version_id=excluded.current_version_id, document_date=excluded.document_date,
      publication_date=excluded.publication_date, effective_date=excluded.effective_date,
      expiry_date=excluded.expiry_date, initial_citation=excluded.initial_citation,
      summary=excluded.summary, responsible_ministry=excluded.responsible_ministry,
      enacting_body=excluded.enacting_body, source_kind=excluded.source_kind, updated_at=excluded.updated_at`, [
      meta.id, meta.slug, meta.title, meta.shortTitle, meta.abbr ?? null, meta.type, meta.status,
      sourceLawId(meta, current), current.versionId, meta.documentDate ?? null, meta.publicationDate ?? null,
      meta.effectiveDate ?? null, meta.expiryDate ?? null, meta.initialCitation, meta.summary,
      meta.responsibleMinistry ?? meta.ministry ?? null, meta.enactingBody ?? null, sourceKind(meta, current), now,
    ]),
  ];

  for (const version of versions) {
    const primarySource = (version.sourceReferences ?? []).find((source) => source.kind === 'revosax-snapshot')
      ?? (version.sourceReferences ?? [])[0]
      ?? null;
    queries.push(q(`INSERT INTO law_versions (
      norm_id, version_id, valid_from, valid_to, is_current, title, short_title, abbr, summary,
      citation, change_note, source_sha256, source_url, source_retrieved_at, source_object_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      meta.id, version.versionId, version.validFrom, version.validTo ?? null, version.isCurrent ? 1 : 0,
      version.title ?? null, version.shortTitle ?? null, version.abbr ?? null, version.summary ?? null,
      version.citation, version.changeNote, primarySource?.sha256 ?? null, primarySource?.url ?? null,
      primarySource?.retrievedAt ?? null, primarySource?.objectKey ?? null, now,
    ]));

    for (const [blockIndex, block] of version.body.entries()) {
      const blockJson = JSON.stringify(block);
      if (textBytes(blockJson) > MAX_D1_TEXT_BYTES) {
        throw new Error(
          `${meta.slug}/${version.versionId}: äußerer Body-Block ${blockIndex} ist ${textBytes(blockJson)} Byte groß; ` +
          `vor D1-Sync strukturell weiter aufteilen`,
        );
      }
      queries.push(q(
        'INSERT INTO law_version_blocks (norm_id, version_id, block_index, block_json) VALUES (?, ?, ?, ?)',
        [meta.id, version.versionId, blockIndex, blockJson],
      ));
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

  const identityTitle = current.title ?? meta.title;
  const identityShortTitle = current.shortTitle ?? meta.shortTitle;
  const identityAbbr = current.abbr ?? meta.abbr ?? '';
  for (const provision of flattenSearchBlocks(current.body)) {
    queries.push(q(`INSERT INTO law_search (
      norm_id, version_id, provision_path, slug, title, short_title, abbr, label, heading, body
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      meta.id, current.versionId, provision.path, meta.slug, identityTitle, identityShortTitle,
      identityAbbr, provision.label, provision.heading, provision.body,
    ]));
  }

  return queries;
}

async function cloudflareQuery({ accountId, databaseId, apiToken }, batch) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json',
    },
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
    const batch = queries.slice(index, index + batchSize);
    await cloudflareQuery(config, batch);
  }
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

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
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
  if (!dryRun && transport === 'api' && !config.apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN ist für --transport api erforderlich');
  }

  const slugs = requestedSlugs.length > 0 ? requestedSlugs : await listSlugs();
  const now = new Date().toISOString();
  const totalNormCount = requestedSlugs.length > 0 ? (await listSlugs()).length : slugs.length;
  let queryCount = 0;
  const normStatements = [];
  for (const [index, slug] of slugs.entries()) {
    const norm = await loadNorm(slug);
    const queries = normQueries(norm, now);
    queryCount += queries.length;
    if (transport === 'api') {
      if (!dryRun) await sendBatches(config, queries, batchSize);
    } else {
      normStatements.push({ slug, statements: queries.map(renderStatement) });
    }
    console.log(`[${index + 1}/${slugs.length}] ${slug}: ${queries.length} D1-Operationen${dryRun ? ' geprüft' : transport === 'api' ? ' synchronisiert' : ' vorbereitet'}`);
  }

  const metadataQueries = [
    q(`INSERT INTO law_runtime_meta (key, value) VALUES ('last_sync_at', ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [now]),
    q(`INSERT INTO law_runtime_meta (key, value) VALUES ('norm_count', ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [String(totalNormCount)]),
  ];

  if (transport === 'api') {
    if (!dryRun) await sendBatches(config, metadataQueries, batchSize);
  } else {
    normStatements.push({ slug: '(runtime-meta)', statements: metadataQueries.map(renderStatement) });
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
  console.log(`${slugs.length} Normen, ${queryCount} Inhaltsoperationen${dryRun ? ' validiert' : ' nach D1 übertragen'}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

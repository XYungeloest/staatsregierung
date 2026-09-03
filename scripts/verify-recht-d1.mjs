#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Prüft die D1-Projektion von OstRecht gegen den Git-Bestand: Tabellenzähler
 * (Normen, Fassungen, Verkündungen, Suchindexabdeckung) und Stichproben je Norm
 * (Titel, Typ, Status, Fassungen mit Blöcken, Suchzeilen).
 *
 * Aufruf:
 *   node scripts/verify-recht-d1.mjs [--local [--persist-to .cache/wrangler-local]] [--database <Name>] [slug ...]
 *
 * Ohne --local wird die produktive Datenbank über die Wrangler-Anmeldung gelesen;
 * mit --local die Miniflare-Datenbank von scripts/serve-law-worker.mjs.
 */

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const local = args.includes('--local');
const persistIndex = args.indexOf('--persist-to');
const persistTo = resolve(ROOT, persistIndex >= 0 ? args[persistIndex + 1] : join('.cache', 'wrangler-local'));
const databaseIndex = args.indexOf('--database');
const databaseName = databaseIndex >= 0 ? args[databaseIndex + 1] : (process.env.OSTRECHT_D1_DATABASE_NAME ?? 'ostrecht-recht');
const requestedSlugs = args.filter((value, index) => !value.startsWith('--') && index !== persistIndex + 1 && index !== databaseIndex + 1);

function query(sql) {
  const target = local ? ['--local', '--persist-to', persistTo] : ['--remote'];
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', databaseName, ...target, '--json', '--command', sql], {
    cwd: join(ROOT, 'apps', 'recht'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  const start = out.indexOf('[');
  return JSON.parse(out.slice(start))[0].results;
}

const counts = query(`SELECT
  (SELECT COUNT(*) FROM law_norms) AS norms,
  (SELECT COUNT(*) FROM law_versions) AS versions,
  (SELECT COUNT(*) FROM law_version_blocks) AS blocks,
  (SELECT COUNT(*) FROM law_source_objects) AS sources,
  (SELECT COUNT(*) FROM law_source_objects WHERE object_key IS NOT NULL) AS r2_sources,
  (SELECT COUNT(*) FROM law_norm_derived) AS derived,
  (SELECT COUNT(*) FROM law_publications) AS publications,
  (SELECT COUNT(*) FROM law_search_documents) AS search_documents,
  (SELECT COUNT(*) FROM law_search) AS search_rows,
  (SELECT COUNT(DISTINCT slug) FROM law_search) AS search_norms,
  (SELECT value FROM law_runtime_meta WHERE key='last_sync_at') AS last_sync_at,
  (SELECT value FROM law_runtime_meta WHERE key='norm_count') AS norm_count_meta,
  (SELECT value FROM law_runtime_meta WHERE key='publication_count') AS publication_count_meta,
  (SELECT value FROM law_runtime_meta WHERE key='corpus_hash') AS corpus_hash`)[0];
console.log(`D1 (${local ? 'lokal' : 'remote'}):`, JSON.stringify(counts));

const normDir = join(ROOT, 'content', 'normen');
const slugs = readdirSync(normDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
let gitVersions = 0;
let gitR2Sources = 0;
const fingerprintLines = [];
const bySlug = new Map();
for (const slug of slugs) {
  const meta = JSON.parse(readFileSync(join(normDir, slug, 'meta.json'), 'utf8'));
  const versionFiles = readdirSync(join(normDir, slug, 'versions')).filter((file) => file.endsWith('.json'));
  gitVersions += versionFiles.length;
  const versions = [];
  for (const file of versionFiles) {
    const version = JSON.parse(readFileSync(join(normDir, slug, 'versions', file), 'utf8'));
    versions.push(version);
    gitR2Sources += (version.sourceReferences ?? []).filter((reference) => reference.availability === 'r2-archived').length;
    fingerprintLines.push(`${slug}:${version.versionId}:${version.validFrom}:${version.validTo ?? ''}`);
  }
  bySlug.set(slug, { meta, versions });
}
const publicationFiles = readdirSync(join(ROOT, 'content', 'verkuendungen')).filter((file) => file.endsWith('.json'));
for (const file of publicationFiles) {
  const publication = JSON.parse(readFileSync(join(ROOT, 'content', 'verkuendungen', file), 'utf8'));
  fingerprintLines.push(`publication:${publication.slug}:${publication.date}`);
}
const publications = publicationFiles.length;
const gitHash = createHash('sha256').update(fingerprintLines.sort().join('\n')).digest('hex');
console.log('Git:', JSON.stringify({ norms: slugs.length, versions: gitVersions, r2_sources: gitR2Sources, publications, corpus_hash: gitHash }));

const problems = [];
if (Number(counts.norms) !== slugs.length) problems.push(`Normen: D1 ${counts.norms} ≠ Git ${slugs.length}`);
if (Number(counts.versions) !== gitVersions) problems.push(`Fassungen: D1 ${counts.versions} ≠ Git ${gitVersions}`);
if (Number(counts.publications) !== publications) problems.push(`Verkündungen: D1 ${counts.publications} ≠ Git ${publications}`);
if (Number(counts.search_norms) !== slugs.length) problems.push(`Suchindex deckt ${counts.search_norms} von ${slugs.length} Normen ab`);
if (Number(counts.norm_count_meta) !== slugs.length) problems.push(`law_runtime_meta.norm_count ${counts.norm_count_meta} ≠ Git ${slugs.length}`);
if (Number(counts.publication_count_meta) !== publications) problems.push(`law_runtime_meta.publication_count ${counts.publication_count_meta} ≠ Git ${publications}`);
if (Number(counts.derived) !== slugs.length) problems.push(`law_norm_derived ${counts.derived} ≠ Normen ${slugs.length}`);
if (Number(counts.search_documents) !== gitVersions) problems.push(`law_search_documents ${counts.search_documents} ≠ Fassungen ${gitVersions}`);
if (Number(counts.r2_sources) !== gitR2Sources) problems.push(`R2-Quellen: D1 ${counts.r2_sources} ≠ Git ${gitR2Sources}`);
if (counts.corpus_hash !== gitHash) problems.push(`corpus_hash: D1 ${counts.corpus_hash ?? '(fehlt)'} ≠ Git ${gitHash}`);

// Stichproben: übergebene Slugs oder deterministische Auswahl über den Bestand plus
// gezielte Fälle: übernommene REVOSax-Normen, eine Ost-Norm mit späteren Fassungen,
// eine Änderungsvorschrift, ein Mantelbestandteil und die größte Norm.
const isBaseline = (slug) => bySlug.get(slug).versions.some((version) => (version.sourceReferences ?? []).some((reference) => reference.availability === 'r2-archived'));
const targeted = [
  slugs.filter((slug) => isBaseline(slug))[0],
  slugs.filter((slug) => isBaseline(slug)).at(-1),
  slugs.find((slug) => bySlug.get(slug).versions.length >= 3),
  slugs.find((slug) => bySlug.get(slug).meta.type === 'aenderungsvorschrift' && isBaseline(slug)),
  slugs.find((slug) => bySlug.get(slug).meta.containedIn),
  [...slugs].sort((left, right) => JSON.stringify(bySlug.get(right).versions).length - JSON.stringify(bySlug.get(left).versions).length)[0],
].filter(Boolean);
const sample = requestedSlugs.length > 0
  ? requestedSlugs
  : [...new Set([...targeted, ...slugs.filter((_, index) => index % Math.max(1, Math.floor(slugs.length / 12)) === 0).slice(0, 12)])];
const inList = sample.map((slug) => `'${slug.replaceAll("'", "''")}'`).join(',');
const rows = query(`SELECT n.slug, n.title, n.type, n.status,
  (SELECT COUNT(*) FROM law_versions v WHERE v.norm_id = n.id) AS versions,
  (SELECT COUNT(DISTINCT b.version_id) FROM law_version_blocks b WHERE b.norm_id = n.id) AS versions_with_blocks,
  (SELECT COUNT(*) FROM law_search s WHERE s.norm_id = n.id) AS search_rows,
  (SELECT d.portal_links_json FROM law_norm_derived d WHERE d.norm_id = n.id) AS portal_links_json
  FROM law_norms n WHERE n.slug IN (${inList}) ORDER BY n.slug`);
for (const row of rows) {
  const meta = JSON.parse(readFileSync(join(normDir, row.slug, 'meta.json'), 'utf8'));
  const versionCount = readdirSync(join(normDir, row.slug, 'versions')).filter((file) => file.endsWith('.json')).length;
  const relativePortalLink = /"(?:url|href)":"\/(?!\/)/u.test(row.portal_links_json ?? '');
  const ok = meta.title === row.title && meta.type === row.type && meta.status === row.status
    && versionCount === Number(row.versions) && Number(row.versions_with_blocks) === versionCount && !relativePortalLink;
  console.log(`${ok ? 'OK ' : 'ABWEICHUNG'} ${row.slug}: D1 ${row.versions} Fassungen (${row.versions_with_blocks} mit Blöcken, ${row.search_rows} Suchzeilen) | Git ${versionCount} Fassungen | ${row.type}/${row.status}`);
  if (!ok) problems.push(`${row.slug}: Titel/Typ/Status/Fassungen/Portalverweise weichen ab (D1 „${row.title}“ vs Git „${meta.title}“${relativePortalLink ? ', relativer Portalverweis' : ''})`);
}
const missing = sample.filter((slug) => !rows.some((row) => row.slug === slug));
if (missing.length > 0) problems.push(`in D1 fehlen: ${missing.join(', ')}`);

if (problems.length > 0) {
  console.error(`Abweichungen:\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Git und D1 stimmen für Zähler und Stichproben überein.');
}

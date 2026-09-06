#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { loadKeywordRegister, registerKeywordsBySlug } from '@ostrecht/shared/lib/norms/register.ts';

import { FULL_SCOPE, fixtureScope, projectionIdentity } from './lib/d1-projection-fingerprint.mjs';
import { fixtureSlugList, isSyntheticFixture, loadFixtureCorpus, readFixtureManifest } from './lib/runtime-fixture.mjs';

/**
 * Prüft die D1-Projektion von OstRecht gegen den erwarteten Bestand: Tabellenzähler
 * (Normen, Fassungen, Verkündungen, Suchindexabdeckung) und Stichproben je Norm
 * (Titel, Typ, Status, Fassungen mit Blöcken, Suchzeilen).
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/verify-recht-d1.mjs [--local [--persist-to .cache/wrangler-local]] [--database <Name>] [--fts-integrity] [--corpus-filter <Datei>] [slug ...]
 *
 * Ohne --local wird die produktive Datenbank über die Wrangler-Anmeldung gelesen;
 * mit --local die Miniflare-Datenbank von scripts/serve-law-worker.mjs.
 *
 * Erwarteter Bestand: ohne --corpus-filter der Git-Bestand unter content/; mit einem synthetischen
 * Fixture (data/recht/runtime-fixture.json, source "synthetic") die Datensätze des Builders
 * tests/helpers/fixture-corpus.ts (daher --experimental-strip-types); mit einer Slug-Liste
 * ({ "slugs": [...] }, Staging) die genannten realen Normen und alle Verkündungen.
 */

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const local = args.includes('--local');
const persistIndex = args.indexOf('--persist-to');
const persistTo = resolve(ROOT, persistIndex >= 0 ? args[persistIndex + 1] : join('.cache', 'wrangler-local'));
const databaseIndex = args.indexOf('--database');
const databaseName = databaseIndex >= 0 ? args[databaseIndex + 1] : (process.env.OSTRECHT_D1_DATABASE_NAME ?? 'ostrecht-recht');
// --corpus-filter <Datei>: die Projektion ist ein Testfixture (lokal/Staging); erwarteter Bestand
// und erwartete Identität beziehen sich dann auf das Fixture.
const corpusIndex = args.indexOf('--corpus-filter');
const corpusFilter = corpusIndex >= 0 ? args[corpusIndex + 1] : null;
const fixtureManifest = corpusFilter ? await readFixtureManifest(ROOT, corpusFilter) : null;
const synthetic = fixtureManifest ? isSyntheticFixture(fixtureManifest) : false;
const expectedLabel = synthetic ? 'Fixture' : 'Git';
const requestedSlugs = args.filter((value, index) => !value.startsWith('--') && index !== persistIndex + 1 && index !== databaseIndex + 1 && index !== corpusIndex + 1);

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

// Schema-Stand: die Zählerabfrage setzt Migration 0006 voraus (index_letter, law_norm_keywords);
// eine ältere Datenbank wird als klare Abweichung gemeldet statt mit einem SQL-Fehler abzubrechen.
const schemaState = query("SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='law_norm_keywords') AS keywords_table, (SELECT COUNT(*) FROM pragma_table_info('law_norms') WHERE name='index_letter') AS index_letter_column")[0];
if (Number(schemaState.keywords_table) !== 1 || Number(schemaState.index_letter_column) !== 1) {
  console.error(`Abweichungen:\n- Schema unvollständig: Migration data/recht/d1/0006_index_letter_keywords.sql ist auf ${databaseName} (${local ? 'lokal' : 'remote'}) nicht eingespielt`);
  process.exit(1);
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
  (SELECT COUNT(*) FROM law_search_units) AS search_rows,
  (SELECT COUNT(DISTINCT slug) FROM law_search_units) AS search_norms,
  (SELECT COUNT(*) FROM law_norm_subjects) AS subject_rows,
  (SELECT COUNT(*) FROM law_norm_history) AS history_rows,
  (SELECT COUNT(*) FROM law_norm_keywords) AS keyword_rows,
  (SELECT COUNT(*) FROM law_norms WHERE index_letter IS NULL OR (index_letter != '#' AND (index_letter < 'A' OR index_letter > 'Z' OR length(index_letter) != 1))) AS bad_index_letters,
  (SELECT value FROM law_runtime_meta WHERE key='last_sync_at') AS last_sync_at,
  (SELECT value FROM law_runtime_meta WHERE key='norm_count') AS norm_count_meta,
  (SELECT value FROM law_runtime_meta WHERE key='publication_count') AS publication_count_meta,
  (SELECT value FROM law_runtime_meta WHERE key='corpus_hash') AS corpus_hash,
  (SELECT value FROM law_runtime_meta WHERE key='projection_fingerprint') AS projection_fingerprint,
  (SELECT value FROM law_runtime_meta WHERE key='projection_scope') AS projection_scope,
  (SELECT value FROM law_runtime_meta WHERE key='sync_state') AS sync_state,
  (SELECT value FROM law_runtime_meta WHERE key='sync_mode') AS sync_mode`)[0];
console.log(`D1 (${local ? 'lokal' : 'remote'}):`, JSON.stringify(counts));

// Erwarteter Bestand als Datensätze je Slug ({ meta, versions }) und Verkündungen ({ slug, date }):
// aus dem Builder (synthetisches Fixture) oder aus content/ (Vollbestand bzw. Slug-Liste).
const bySlug = new Map();
const expectedPublications = [];
if (synthetic) {
  const corpus = await loadFixtureCorpus(ROOT, fixtureManifest);
  for (const norm of corpus.norms) bySlug.set(norm.meta.slug, { meta: norm.meta, versions: norm.versions });
  expectedPublications.push(...corpus.publications.map((publication) => ({ slug: publication.slug, date: publication.date })));
} else {
  const fixtureSlugs = fixtureManifest ? new Set(fixtureSlugList(fixtureManifest)) : null;
  const normDir = join(ROOT, 'content', 'normen');
  const directories = readdirSync(normDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((slug) => !fixtureSlugs || fixtureSlugs.has(slug));
  if (fixtureSlugs && directories.length !== fixtureSlugs.size) throw new Error(`Fixture ${corpusFilter}: ${fixtureSlugs.size - directories.length} Slug(s) nicht im Bestand`);
  for (const slug of directories) {
    const meta = JSON.parse(readFileSync(join(normDir, slug, 'meta.json'), 'utf8'));
    const versions = readdirSync(join(normDir, slug, 'versions')).filter((file) => file.endsWith('.json')).map((file) => JSON.parse(readFileSync(join(normDir, slug, 'versions', file), 'utf8')));
    bySlug.set(slug, { meta, versions });
  }
  for (const file of readdirSync(join(ROOT, 'content', 'verkuendungen')).filter((name) => name.endsWith('.json'))) {
    const publication = JSON.parse(readFileSync(join(ROOT, 'content', 'verkuendungen', file), 'utf8'));
    expectedPublications.push({ slug: publication.slug, date: publication.date });
  }
}
const slugs = [...bySlug.keys()].sort();
let gitVersions = 0;
let gitR2Sources = 0;
const fingerprintLines = [];
for (const slug of slugs) {
  for (const version of bySlug.get(slug).versions) {
    gitVersions += 1;
    gitR2Sources += (version.sourceReferences ?? []).filter((reference) => reference.availability === 'r2-archived').length;
    fingerprintLines.push(`${slug}:${version.versionId}:${version.validFrom}:${version.validTo ?? ''}`);
  }
}
for (const publication of expectedPublications) fingerprintLines.push(`publication:${publication.slug}:${publication.date}`);
// Das Stichwortregister ist eine Eingabe der Projektion; der Sync zählt es in denselben
// Fingerabdruck (corpusFingerprint in scripts/sync-recht-d1.mjs).
for (const [slug, keywords] of registerKeywordsBySlug(await loadKeywordRegister())) {
  fingerprintLines.push(`register:${slug}:${[...keywords].sort().join('|')}`);
}
const publications = expectedPublications.length;
const gitHash = createHash('sha256').update(fingerprintLines.sort().join('\n')).digest('hex');
console.log(`${expectedLabel}:`, JSON.stringify({ norms: slugs.length, versions: gitVersions, r2_sources: gitR2Sources, publications, corpus_hash: gitHash }));

const problems = [];
if (Number(counts.norms) !== slugs.length) problems.push(`Normen: D1 ${counts.norms} ≠ ${expectedLabel} ${slugs.length}`);
if (Number(counts.versions) !== gitVersions) problems.push(`Fassungen: D1 ${counts.versions} ≠ ${expectedLabel} ${gitVersions}`);
if (Number(counts.publications) !== publications) problems.push(`Verkündungen: D1 ${counts.publications} ≠ ${expectedLabel} ${publications}`);
if (Number(counts.search_norms) !== slugs.length) problems.push(`Suchindex deckt ${counts.search_norms} von ${slugs.length} Normen ab`);
if (Number(counts.norm_count_meta) !== slugs.length) problems.push(`law_runtime_meta.norm_count ${counts.norm_count_meta} ≠ ${expectedLabel} ${slugs.length}`);
if (Number(counts.publication_count_meta) !== publications) problems.push(`law_runtime_meta.publication_count ${counts.publication_count_meta} ≠ ${expectedLabel} ${publications}`);
if (Number(counts.derived) !== slugs.length) problems.push(`law_norm_derived ${counts.derived} ≠ Normen ${slugs.length}`);
if (Number(counts.bad_index_letters) !== 0) problems.push(`${counts.bad_index_letters} Normen ohne gültigen Buchstabenindex (Migration 0006 / Sync)`);
if (Number(counts.keyword_rows) < slugs.length) problems.push(`law_norm_keywords ${counts.keyword_rows} < Normen ${slugs.length} (Stichwortindex unvollständig)`);
if (Number(counts.search_documents) !== gitVersions) problems.push(`law_search_documents ${counts.search_documents} ≠ Fassungen ${gitVersions}`);
if (Number(counts.r2_sources) !== gitR2Sources) problems.push(`R2-Quellen: D1 ${counts.r2_sources} ≠ ${expectedLabel} ${gitR2Sources}`);
if (counts.corpus_hash !== gitHash) problems.push(`corpus_hash: D1 ${counts.corpus_hash ?? '(fehlt)'} ≠ ${expectedLabel} ${gitHash}`);
// Erwartete Identität im geprüften Scope: Vollbestand oder (--corpus-filter) Fixture.
const expectedScope = corpusFilter ? await fixtureScope(ROOT, corpusFilter) : FULL_SCOPE;
const expectedFingerprint = await projectionIdentity({ root: ROOT, scope: expectedScope });
console.log('Projektionsidentität:', JSON.stringify({ d1: counts.projection_fingerprint ?? null, git: expectedFingerprint.fingerprint, scope_d1: counts.projection_scope ?? null, scope_git: expectedScope, sync_state: counts.sync_state ?? null, sync_mode: counts.sync_mode ?? null }));
if (counts.projection_fingerprint !== expectedFingerprint.fingerprint) {
  problems.push(`projection_fingerprint: D1 ${counts.projection_fingerprint ?? '(fehlt)'} ≠ ${expectedLabel} ${expectedFingerprint.fingerprint} (Sync würde erneut projizieren)`);
}
if ((counts.projection_scope ?? null) !== expectedScope) problems.push(`projection_scope: D1 ${counts.projection_scope ?? '(fehlt)'} ≠ erwartet ${expectedScope}`);
if ((counts.sync_state ?? null) !== 'complete') problems.push(`sync_state: D1 ${counts.sync_state ?? '(fehlt)'} ≠ complete`);
if (args.includes('--fts-integrity')) {
  // FTS5-Integritätsprüfung des Index mit externem Inhalt (liest den gesamten Index; nur auf Wunsch).
  query("INSERT INTO law_search(law_search) VALUES ('integrity-check')");
  console.log('FTS5-Integritätsprüfung: OK');
}

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
  (SELECT COUNT(*) FROM law_search_units s WHERE s.norm_id = n.id) AS search_rows,
  (SELECT d.portal_links_json FROM law_norm_derived d WHERE d.norm_id = n.id) AS portal_links_json
  FROM law_norms n WHERE n.slug IN (${inList}) ORDER BY n.slug`);
for (const row of rows) {
  const expected = bySlug.get(row.slug);
  if (!expected) {
    problems.push(`${row.slug}: in D1, aber nicht im erwarteten Bestand`);
    continue;
  }
  const { meta } = expected;
  const versionCount = expected.versions.length;
  const relativePortalLink = /"(?:url|href)":"\/(?!\/)/u.test(row.portal_links_json ?? '');
  const ok = meta.title === row.title && meta.type === row.type && meta.status === row.status
    && versionCount === Number(row.versions) && Number(row.versions_with_blocks) === versionCount && !relativePortalLink;
  console.log(`${ok ? 'OK ' : 'ABWEICHUNG'} ${row.slug}: D1 ${row.versions} Fassungen (${row.versions_with_blocks} mit Blöcken, ${row.search_rows} Suchzeilen) | ${expectedLabel} ${versionCount} Fassungen | ${row.type}/${row.status}`);
  if (!ok) problems.push(`${row.slug}: Titel/Typ/Status/Fassungen/Portalverweise weichen ab (D1 „${row.title}“ vs ${expectedLabel} „${meta.title}“${relativePortalLink ? ', relativer Portalverweis' : ''})`);
}
const missing = sample.filter((slug) => !rows.some((row) => row.slug === slug));
if (missing.length > 0) problems.push(`in D1 fehlen: ${missing.join(', ')}`);

if (problems.length > 0) {
  console.error(`Abweichungen:\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`${expectedLabel} und D1 stimmen für Zähler und Stichproben überein.`);
}

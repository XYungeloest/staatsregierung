#!/usr/bin/env node --experimental-strip-types

// Muss vor allen @ostrecht-Importen stehen (SITE_TARGET=law für die Routenhelfer).
import './lib/law-site-env.mjs';

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Lokaler Nachweis für gezielte D1-Projektionen ohne Cloudflare-Zugriff.
 *
 * Die Projektion wird mit den echten Migrationen (data/recht/d1/*.sql, FTS5, Trigger) in eine
 * SQLite-Datei geschrieben (node:sqlite) – entweder als Vollprojektion oder als gezielter
 * Git-Diff-Lauf in eine vorhandene Datei. Zwei Dateien lassen sich anschließend tabellenweise
 * vergleichen (ohne Zeitstempel, Laufmodus und die fortlaufende rowid der Suchzeilen).
 *
 * Typischer Nachweis „gezielte Fortschreibung == frische Vollprojektion“:
 *   1. im Basis-Stand (z. B. git worktree des letzten Produktionscommits, eigenes npm ci):
 *      node --experimental-strip-types <dieses Skript> project --out base.sqlite --full
 *   2. im Zielstand:
 *      node --experimental-strip-types scripts/d1-projection-snapshot.mjs project --into base.sqlite \
 *        --git-diff <base> <head> [--assume-narrow-logic-change]
 *      node --experimental-strip-types scripts/d1-projection-snapshot.mjs project --out target.sqlite --full
 *   3. node scripts/d1-projection-snapshot.mjs compare base.sqlite target.sqlite
 *
 * `project` verwendet immer den Sync des aktuellen Arbeitsverzeichnisses (scripts/sync-recht-d1.mjs)
 * und dessen Rechtsbestand; das Skript selbst kann dafür unverändert in einen Basis-Worktree
 * kopiert werden. Es schreibt nie in eine Cloudflare-Datenbank.
 */

const ROOT = resolve(process.cwd());
const TABLES = [
  'law_norms', 'law_versions', 'law_version_blocks', 'law_source_objects', 'law_norm_derived', 'law_publications',
  'law_search_documents', 'law_search_units', 'law_norm_subjects', 'law_norm_history', 'law_norm_keywords', 'law_runtime_meta',
];
const IGNORED_COLUMNS = new Set(['updated_at']);
const IGNORED_META_KEYS = new Set(['last_sync_at', 'sync_mode']);

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function openDatabase(path, { create }) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path);
  if (create) {
    const schemaDir = join(ROOT, 'data', 'recht', 'd1');
    for (const name of (await readdir(schemaDir)).filter((file) => /^\d{4}_.*\.sql$/u.test(file)).sort()) {
      db.exec(await readFile(join(schemaDir, name), 'utf8'));
    }
  }
  return db;
}

function bindable(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function executePlan(db, plan) {
  let count = 0;
  db.exec('BEGIN');
  try {
    for (const group of plan.groups) {
      for (const query of group.queries) {
        db.prepare(query.sql).run(...(query.params ?? []).map(bindable));
        count += 1;
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return count;
}

async function project(args) {
  const out = valueAfter(args, '--out');
  const into = valueAfter(args, '--into');
  if (Boolean(out) === Boolean(into)) throw new Error('project braucht genau eines von --out <neue Datei> oder --into <vorhandene Datei>');
  const sync = await import(pathToFileURL(join(ROOT, 'scripts', 'sync-recht-d1.mjs')).href);
  const fingerprintLib = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'd1-projection-fingerprint.mjs')).href);
  const { loadAllNorms } = await import('@ostrecht/shared/lib/norms/loader.ts');
  const { loadAllVerkuendungen } = await import('@ostrecht/shared/lib/norms/publications.ts');
  const { buildDerivedContext } = await import('@ostrecht/shared/lib/norms/derived.ts');
  const { loadPressReleases, loadTopics } = await import('@ostrecht/shared/lib/portal/content.ts');
  const { getPressReleaseUrl, getTopicUrl } = await import('@ostrecht/shared/lib/portal/routes.ts');
  const startedAt = Date.now();
  const [norms, publications, topics, pressReleases] = await Promise.all([loadAllNorms(), loadAllVerkuendungen(), loadTopics(), loadPressReleases()]);
  console.log(`${norms.length} Normen und ${publications.length} Verkündungen geladen (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const identity = await fingerprintLib.projectionIdentity({ root: ROOT, scope: fingerprintLib.FULL_SCOPE });
  console.log(`Projektionsidentität ${identity.fingerprint.slice(0, 16)}… (Logik ${identity.logic.slice(0, 12)}…, Bestand ${identity.corpus.slice(0, 12)}…, Portal ${identity.portal.slice(0, 12)}…)`);
  const scopeArgs = args.filter((value) => value !== 'project');
  const scope = await sync.resolveScope(scopeArgs, { norms, publications });
  const context = buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl });
  console.log(`Umfang: ${scope.mode}${scope.mode === 'incremental' ? ` – ${scope.slugs.length} Norm(en), ${scope.publicationSlugs.length} Verkündung(en)${scope.derivedRebuild ? ', abgeleitete Daten aller Normen' : ''}${scope.refreshSearchDocuments ? ', Suchdokumente aller Normen' : ''}` : ''}${scope.reasons?.length ? ` – ${scope.reasons.slice(0, 4).join('; ')}` : ''}`);
  const now = valueAfter(args, '--now') ?? '2026-01-01T00:00:00.000Z';
  const plan = sync.buildSyncPlan({ scope, norms, publications, context, now, fingerprint: identity, identity, writeIdentity: true });
  console.log(`Plan: ${plan.selected.length} Normen, ${plan.derivedCount} abgeleitete Datensätze, ${plan.documentRefreshCount ?? 0} Normen mit erneuerten Suchdokumenten, ${plan.publicationCount} Verkündungen, ${plan.statementCount} Anweisungen (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const db = await openDatabase(out ?? into, { create: Boolean(out) });
  const executed = executePlan(db, plan);
  db.exec("INSERT INTO law_search(law_search) VALUES ('integrity-check')");
  db.close();
  console.log(`${executed} Anweisungen nach ${out ?? into} geschrieben; FTS5-Integrität geprüft (${Math.round((Date.now() - startedAt) / 1000)} s).`);
}

function dumpTable(db, table) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all().map((row) => {
    const entry = {};
    for (const [key, value] of Object.entries(row)) {
      if (IGNORED_COLUMNS.has(key)) continue;
      if (table === 'law_search_units' && key === 'id') continue;
      entry[key] = value;
    }
    return JSON.stringify(entry);
  });
  if (table === 'law_runtime_meta') return rows.filter((row) => !IGNORED_META_KEYS.has(JSON.parse(row).key)).sort();
  return rows.sort();
}

async function compare(args) {
  const [left, right] = args.filter((value) => value !== 'compare' && !value.startsWith('--'));
  if (!left || !right) throw new Error('compare braucht zwei SQLite-Dateien');
  const { createHash } = await import('node:crypto');
  const a = await openDatabase(left, { create: false });
  const b = await openDatabase(right, { create: false });
  let differences = 0;
  for (const table of TABLES) {
    const rowsA = dumpTable(a, table);
    const rowsB = dumpTable(b, table);
    const hashA = createHash('sha256').update(rowsA.join('\n')).digest('hex').slice(0, 16);
    const hashB = createHash('sha256').update(rowsB.join('\n')).digest('hex').slice(0, 16);
    const equal = hashA === hashB;
    if (!equal) differences += 1;
    console.log(`${equal ? 'OK ' : 'DIFF'} ${table}: ${rowsA.length} vs ${rowsB.length} Zeilen, ${hashA} vs ${hashB}`);
    if (!equal) {
      const setB = new Set(rowsB);
      const setA = new Set(rowsA);
      const onlyA = rowsA.filter((row) => !setB.has(row));
      const onlyB = rowsB.filter((row) => !setA.has(row));
      console.log(`     nur links: ${onlyA.length}, nur rechts: ${onlyB.length}`);
      for (const row of onlyA.slice(0, 3)) console.log(`     < ${row.slice(0, 300)}`);
      for (const row of onlyB.slice(0, 3)) console.log(`     > ${row.slice(0, 300)}`);
    }
  }
  for (const term of ['Interflug', 'Zinnwald', 'Daseinsvorsorge', 'Hoheitszeichen', 'Gemeindeordnung']) {
    const hits = (db) => db.prepare('SELECT norm_id, version_id, provision_path FROM law_search WHERE law_search MATCH ? ORDER BY norm_id, version_id, provision_path').all(term).map((row) => JSON.stringify(row)).join('\n');
    const equal = hits(a) === hits(b);
    if (!equal) differences += 1;
    console.log(`${equal ? 'OK ' : 'DIFF'} Volltextsuche „${term}“`);
  }
  a.close();
  b.close();
  if (differences > 0) {
    console.error(`${differences} Tabelle(n)/Suchabfrage(n) weichen ab.`);
    process.exitCode = 1;
  } else {
    console.log('Beide Projektionen sind tabellenweise identisch (ohne Zeitstempel, Laufmodus und Suchzeilen-rowid).');
  }
}

const command = process.argv[2];
if (command === 'project') await project(process.argv.slice(2));
else if (command === 'compare') await compare(process.argv.slice(2));
else {
  console.error('Verwendung: d1-projection-snapshot.mjs project (--out <Datei> --full | --into <Datei> --git-diff <base> <head> [--assume-narrow-logic-change]) | compare <a.sqlite> <b.sqlite>');
  process.exit(2);
}

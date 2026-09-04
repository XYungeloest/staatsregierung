#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

/**
 * Isolierte Schreibprobe für die D1-Zugangsdaten der CI – ausschließlich gegen die
 * Staging-Datenbank. Sie beweist echten Schreibzugriff, ohne den Rechtsbestand zu berühren:
 *
 *   1. CREATE TABLE IF NOT EXISTS law_ci_write_probe (eigene, unkritische Probetabelle)
 *   2. INSERT eines eindeutigen Probeeintrags
 *   3. SELECT – der Eintrag muss vorhanden sein
 *   4. DELETE
 *   5. SELECT – der Eintrag muss verschwunden sein
 *
 * Unberührt bleiben law_norms, law_versions, law_search*, law_publications, law_runtime_meta
 * (Projektionsidentität, Scope, sync_state, corpus_hash). Die Produktionsdatenbank
 * (ostrecht-recht, 2491f200-…) wird fail-closed abgelehnt.
 *
 * Aufruf:
 *   node scripts/d1-write-probe.mjs --transport api        (CLOUDFLARE_API_TOKEN, OSTRECHT_D1_DATABASE_ID = Staging)
 *   node scripts/d1-write-probe.mjs --transport wrangler --database ostrecht-recht-staging
 */

const ROOT = resolve(process.cwd());
const PRODUCTION_DATABASE_NAME = 'ostrecht-recht';
const PRODUCTION_DATABASE_ID = '2491f200-de20-4a45-b028-d00a4fd57840';
const DEFAULT_ACCOUNT_ID = '28871b9b1c6753235a331544f7c68460';
export const PROBE_TABLE = 'law_ci_write_probe';
const PROTECTED_TABLES = ['law_norms', 'law_versions', 'law_version_blocks', 'law_source_objects', 'law_norm_derived', 'law_publications', 'law_search_documents', 'law_search_units', 'law_search', 'law_norm_subjects', 'law_norm_history', 'law_norm_keywords', 'law_runtime_meta'];
const execFileAsync = promisify(execFile);

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Die Probe-Anweisungen; reine Funktion für Tests. */
export function probeStatements(probeId, now) {
  return [
    { sql: `CREATE TABLE IF NOT EXISTS ${PROBE_TABLE} (probe_id TEXT PRIMARY KEY, written_at TEXT NOT NULL, note TEXT)`, params: [] },
    { sql: `INSERT INTO ${PROBE_TABLE} (probe_id, written_at, note) VALUES (?, ?, ?)`, params: [probeId, now, 'CI-Schreibprobe; wird sofort wieder gelöscht'] },
    { sql: `SELECT probe_id FROM ${PROBE_TABLE} WHERE probe_id = ?`, params: [probeId] },
    { sql: `DELETE FROM ${PROBE_TABLE} WHERE probe_id = ?`, params: [probeId] },
    { sql: `SELECT COUNT(*) AS remaining FROM ${PROBE_TABLE} WHERE probe_id = ?`, params: [probeId] },
  ];
}

/** Prüft die fünf Ergebnisse (Zeilenlisten) der Probe; wirft bei jeder Abweichung. */
export function assertProbeResults(probeId, results) {
  const [, , selected, , remaining] = results;
  if (!Array.isArray(selected) || selected.length !== 1 || selected[0]?.probe_id !== probeId) {
    throw new Error(`Schreibprobe: Eintrag ${probeId} wurde nach dem INSERT nicht gelesen (${JSON.stringify(selected)})`);
  }
  if (!Array.isArray(remaining) || Number(remaining[0]?.remaining) !== 0) {
    throw new Error(`Schreibprobe: Eintrag ${probeId} ist nach dem DELETE noch vorhanden (${JSON.stringify(remaining)})`);
  }
  for (const statement of probeStatements(probeId, '')) {
    for (const table of PROTECTED_TABLES) {
      if (new RegExp(`\\b${table}\\b`, 'u').test(statement.sql)) throw new Error(`Schreibprobe berührt geschützte Tabelle ${table}`);
    }
  }
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function render({ sql, params }) {
  let index = 0;
  return `${sql.replace(/\?/gu, () => sqlLiteral(params[index++]))};`;
}

async function runApi({ accountId, databaseId, apiToken }, statements, stats) {
  const results = [];
  for (const statement of statements) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: statement.sql, params: statement.params }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success || payload.errors?.length) throw new Error(`Cloudflare D1: ${response.status} ${JSON.stringify(payload.errors ?? payload)}`);
    const result = payload.result?.[0];
    if (result?.success === false) throw new Error(`Cloudflare D1: fehlgeschlagene Anweisung ${JSON.stringify(result)}`);
    stats.rowsRead += Number(result?.meta?.rows_read ?? 0);
    stats.rowsWritten += Number(result?.meta?.rows_written ?? 0);
    results.push(result?.results ?? []);
  }
  return results;
}

async function runWrangler(databaseName, statements, stats) {
  const results = [];
  for (const statement of statements) {
    const { stdout } = await execFileAsync('npx', ['wrangler', 'd1', 'execute', databaseName, '--remote', '--json', '--command', render(statement)], {
      cwd: join(ROOT, 'apps', 'recht'),
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
    const payload = JSON.parse(stdout.slice(stdout.indexOf('[')));
    const result = payload[0];
    if (!result || result.success === false) throw new Error(`wrangler d1 execute: ${stdout.slice(-300)}`);
    stats.rowsRead += Number(result.meta?.rows_read ?? 0);
    stats.rowsWritten += Number(result.meta?.rows_written ?? 0);
    results.push(result.results ?? []);
  }
  return results;
}

export async function main(args = process.argv.slice(2)) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const transport = valueAfter(args, '--transport') ?? (apiToken ? 'api' : 'wrangler');
  const databaseName = valueAfter(args, '--database') ?? process.env.OSTRECHT_D1_DATABASE_NAME ?? 'ostrecht-recht-staging';
  const databaseId = process.env.OSTRECHT_D1_DATABASE_ID;
  if (transport === 'api') {
    if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN ist für --transport api erforderlich');
    if (!databaseId) throw new Error('OSTRECHT_D1_DATABASE_ID (Staging-Datenbank) ist für --transport api erforderlich');
    if (databaseId === PRODUCTION_DATABASE_ID) throw new Error('Schreibprobe abgelehnt: OSTRECHT_D1_DATABASE_ID bezeichnet die produktive Datenbank');
  } else if (transport === 'wrangler') {
    if (databaseName === PRODUCTION_DATABASE_NAME) throw new Error('Schreibprobe abgelehnt: --database bezeichnet die produktive Datenbank');
  } else {
    throw new Error(`Unbekannter Transport ${transport}`);
  }
  const probeId = `ci-probe-${new Date().toISOString().replace(/[:.]/gu, '-')}-${randomUUID().slice(0, 8)}`;
  const statements = probeStatements(probeId, new Date().toISOString());
  const stats = { rowsRead: 0, rowsWritten: 0 };
  const results = transport === 'api'
    ? await runApi({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID, databaseId, apiToken }, statements, stats)
    : await runWrangler(databaseName, statements, stats);
  assertProbeResults(probeId, results);
  console.log(`D1-Schreibprobe erfolgreich (${transport}, ${transport === 'api' ? `Datenbank ${databaseId}` : databaseName}): ${probeId} geschrieben, gelesen und gelöscht; rows_read ${stats.rowsRead}, rows_written ${stats.rowsWritten}; Rechtsbestand und Projektionsidentität unberührt.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}

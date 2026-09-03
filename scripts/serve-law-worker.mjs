#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/**
 * Startet den gebauten OstRecht-Worker lokal (`wrangler dev --local`) mit einer aus
 * `content/` projizierten lokalen D1-Datenbank. Browser-Smoke- und Barrierefreiheits-
 * tests laufen damit gegen dieselben On-demand-Routen wie in Produktion, ohne
 * Cloudflare-Anmeldung und ohne die produktive Datenbank zu berühren.
 *
 * Aufruf:
 *   node scripts/serve-law-worker.mjs [--port 4322] [--persist-to .cache/wrangler-local]
 *                                     [--seed-only] [--force]
 *
 * Die lokale Projektion wird nur neu geschrieben, wenn sich der Fingerabdruck der
 * Rechtsdaten, der Migrationen oder der Projektionslogik geändert hat (`--force`
 * erzwingt es). Voraussetzung ist ein vorhandener Build unter apps/recht/dist.
 */

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const port = valueAfter('--port') ?? '4322';
const persistTo = resolve(ROOT, valueAfter('--persist-to') ?? join('.cache', 'wrangler-local'));
const seedOnly = args.includes('--seed-only');
const force = args.includes('--force');
const workerConfig = join(ROOT, 'apps', 'recht', 'dist', 'server', 'wrangler.json');
const markerPath = join(persistTo, 'ostrecht-recht.seed.json');

const FINGERPRINT_ROOTS = [
  'content/normen',
  'content/verkuendungen',
  'content/themen',
  'content/presse',
  'data/recht/d1',
];
const FINGERPRINT_FILES = [
  'scripts/sync-recht-d1.mjs',
  'packages/shared/src/lib/norms/derived.ts',
  'packages/recht-search/src/search.ts',
];

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory, entries) {
  let children;
  try {
    children = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const child of children) {
    const path = join(directory, child.name);
    if (child.isDirectory()) await walk(path, entries);
    else if (child.isFile()) {
      const info = await stat(path);
      entries.push(`${relative(ROOT, path)}\t${info.size}\t${Math.round(info.mtimeMs)}`);
    }
  }
}

async function fingerprint() {
  const entries = [];
  for (const root of FINGERPRINT_ROOTS) await walk(join(ROOT, root), entries);
  for (const file of FINGERPRINT_FILES) {
    const info = await stat(join(ROOT, file));
    entries.push(`${file}\t${info.size}\t${Math.round(info.mtimeMs)}`);
  }
  entries.sort();
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { cwd: ROOT, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${commandArgs.join(' ')} endete mit ${signal ?? code}`));
    });
  });
}

async function seed() {
  const current = await fingerprint();
  if (!force && (await exists(markerPath))) {
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    if (marker.fingerprint === current) {
      console.log(`Lokale D1-Projektion ist aktuell (${marker.seededAt}, ${marker.normCount ?? '?'} Normen).`);
      return;
    }
  }
  console.log('Lokale D1-Projektion wird neu aufgebaut …');
  // Nur der lokale Miniflare-Zustand unter dem Persist-Verzeichnis wird verworfen.
  await rm(join(persistTo, 'v3', 'd1'), { recursive: true, force: true });
  await mkdir(persistTo, { recursive: true });
  await run(process.execPath, [
    '--experimental-strip-types',
    'scripts/sync-recht-d1.mjs',
    '--full',
    '--transport', 'wrangler',
    '--local',
    '--persist-to', persistTo,
    '--apply-schema',
  ], { env: { ...process.env, SITE_TARGET: 'law' } });
  const normCount = (await readdir(join(ROOT, 'content', 'normen'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).length;
  await writeFile(markerPath, `${JSON.stringify({ fingerprint: current, seededAt: new Date().toISOString(), normCount }, null, 2)}\n`, 'utf8');
  console.log(`Lokale D1-Projektion unter ${relative(ROOT, persistTo)} geschrieben (${normCount} Normen).`);
}

if (!(await exists(workerConfig))) {
  throw new Error(`${relative(ROOT, workerConfig)} fehlt – zuerst npm run build:recht ausführen`);
}
await seed();
if (seedOnly) process.exit(0);

const wrangler = spawn('npx', [
  'wrangler', 'dev',
  '--config', workerConfig,
  '--local',
  '--port', port,
  '--ip', '127.0.0.1',
  '--persist-to', persistTo,
  '--show-interactive-dev-session=false',
], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: process.env.CI ?? '' } });

const stop = (signal) => {
  if (!wrangler.killed) wrangler.kill(signal);
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal));
wrangler.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

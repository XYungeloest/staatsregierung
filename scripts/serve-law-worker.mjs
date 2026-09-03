#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { projectionFingerprint } from './lib/d1-projection-fingerprint.mjs';

/**
 * Startet den gebauten OstRecht-Worker lokal (`wrangler dev --local`) mit einer aus
 * `content/` projizierten lokalen D1-Datenbank. Browser-Smoke- und Barrierefreiheits-
 * tests laufen damit gegen dieselben On-demand-Routen wie in Produktion, ohne
 * Cloudflare-Anmeldung und ohne die produktive Datenbank zu berühren.
 *
 * Aufruf:
 *   node scripts/serve-law-worker.mjs [--port 4322] [--persist-to .cache/wrangler-local]
 *                                     [--fixture data/recht/runtime-fixture.json] [--seed-only] [--force]
 *
 * Persist-Verzeichnis: `--persist-to` oder OSTRECHT_D1_PERSIST_TO (Standard .cache/wrangler-local);
 * so können Fixture- und Vollbestandsprojektion nebeneinander liegen.
 *
 * Fixture: mit `--fixture <Datei>` oder der Umgebungsvariable OSTRECHT_D1_FIXTURE wird
 * nur der repräsentative Testbestand (data/recht/runtime-fixture.json) projiziert –
 * dieselbe D1-Runtimearchitektur, aber wenige Dutzend statt tausender Normen. Pull-
 * Request-Smoke nutzt das Fixture; der Vollbestand bleibt Release-Gate und manuellem
 * Lauf vorbehalten (.github/workflows/full-corpus-smoke.yml).
 *
 * Die lokale Projektion wird nur neu geschrieben, wenn sich der Fingerabdruck der
 * Projektion (scripts/lib/d1-projection-fingerprint.mjs: reine Inhaltshashes von
 * Rechtsbestand, Migrationen und Projektionslogik – keine Änderungszeiten) oder das
 * Fixture geändert hat (`--force` erzwingt es). Voraussetzung ist ein vorhandener
 * Build unter apps/recht/dist.
 */

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const port = valueAfter('--port') ?? '4322';
const persistTo = resolve(ROOT, valueAfter('--persist-to') ?? process.env.OSTRECHT_D1_PERSIST_TO ?? join('.cache', 'wrangler-local'));
const seedOnly = args.includes('--seed-only');
const force = args.includes('--force');
const fixture = valueAfter('--fixture') ?? (process.env.OSTRECHT_D1_FIXTURE || undefined);
const workerConfig = join(ROOT, 'apps', 'recht', 'dist', 'server', 'wrangler.json');
const markerPath = join(persistTo, 'ostrecht-recht.seed.json');

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

/** Fingerabdruck der zu erzeugenden Projektion: Inhaltshash plus Fixture-Inhalt. */
async function seedFingerprint() {
  const { fingerprint } = await projectionFingerprint(ROOT);
  if (!fixture) return { fingerprint, mode: 'full' };
  const fixtureText = await readFile(resolve(ROOT, fixture), 'utf8');
  const { createHash } = await import('node:crypto');
  return { fingerprint: createHash('sha256').update(`${fingerprint}\nfixture:${fixture}\n${fixtureText}`).digest('hex'), mode: `fixture:${fixture}` };
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
  const current = await seedFingerprint();
  if (!force && (await exists(markerPath))) {
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    if (marker.fingerprint === current.fingerprint) {
      console.log(`Lokale D1-Projektion ist aktuell (${marker.seededAt}, ${marker.normCount ?? '?'} Normen, ${marker.mode ?? 'full'}).`);
      return;
    }
  }
  console.log(`Lokale D1-Projektion wird neu aufgebaut (${current.mode}) …`);
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
    '--ignore-fingerprint',
    ...(fixture ? ['--corpus-filter', fixture] : []),
  ], { env: { ...process.env, SITE_TARGET: 'law' } });
  const normCount = fixture
    ? JSON.parse(await readFile(resolve(ROOT, fixture), 'utf8')).slugs.length
    : (await readdir(join(ROOT, 'content', 'normen'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).length;
  await writeFile(markerPath, `${JSON.stringify({ fingerprint: current.fingerprint, mode: current.mode, seededAt: new Date().toISOString(), normCount }, null, 2)}\n`, 'utf8');
  console.log(`Lokale D1-Projektion unter ${relative(ROOT, persistTo)} geschrieben (${normCount} Normen, ${current.mode}).`);
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

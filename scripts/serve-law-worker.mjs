#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

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
 * Request-Smoke nutzt das Fixture; der Vollbestand läuft, wenn die Änderung die Laufzeit
 * oder die Projektion berührt, sowie wöchentlich (.github/workflows/full-corpus-smoke.yml).
 *
 * Der Seed kommt aus scripts/d1-runtime-seed.mjs: ein portabler SQLite-Snapshot mit
 * deterministischem Seed-Fingerabdruck (Projektionsidentität, Seed-Werkzeuge, Wrangler-/
 * Miniflare-Version; keine Änderungszeiten). Ein passender Snapshot unter .cache/d1-seed
 * (lokal oder aus dem CI-Cache) wird verifiziert und eingesetzt; nur ohne Snapshot wird
 * genau einmal projiziert. `--force` erzwingt Neuaufbau und Einsatz. Voraussetzung ist
 * ein vorhandener Build unter apps/recht/dist. Beendet sich wrangler dev unerwartet (abgebrochene
 * Antwort eines Browsers), wird es begrenzt oft neu gestartet.
 */

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const port = valueAfter('--port') ?? '4322';
const persistTo = resolve(ROOT, valueAfter('--persist-to') ?? process.env.OSTRECHT_D1_PERSIST_TO ?? join('.cache', 'wrangler-local'));
const seedOnly = args.includes('--seed-only');
const force = args.includes('--force');
const fixture = valueAfter('--fixture') ?? (process.env.OSTRECHT_D1_FIXTURE || undefined);
const workerConfig = join(ROOT, 'apps', 'recht', 'dist', 'server', 'wrangler.json');

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

/** Seed sicherstellen: aktueller Marker → nichts, Snapshot → verifizieren und einsetzen, sonst einmal bauen. */
async function seed() {
  await run(process.execPath, [
    '--experimental-strip-types',
    'scripts/d1-runtime-seed.mjs',
    'ensure',
    '--persist-to', persistTo,
    ...(fixture ? ['--fixture', fixture] : []),
    ...(force ? ['--force'] : []),
  ]);
}

if (!(await exists(workerConfig))) {
  throw new Error(`${relative(ROOT, workerConfig)} fehlt – zuerst npm run build:recht ausführen`);
}
await seed();
if (seedOnly) process.exit(0);

// wrangler dev beendet sich lokal, wenn ein Browser eine laufende Antwort abbricht („Uncaught
// Error: Network connection lost“ im Inspector-Protokoll) – in Produktion ist das folgenlos. Damit
// ein einzelner Abbruch nicht jeden folgenden Browsertest scheitern lässt, wird der Dev-Server
// begrenzt oft neu gestartet; die lokale D1 bleibt unter --persist-to erhalten.
const MAX_RESTARTS = 5;
let restarts = 0;
let stopping = false;
let wrangler = null;

function spawnWrangler() {
  wrangler = spawn('npx', [
    'wrangler', 'dev',
    '--config', workerConfig,
    '--local',
    '--port', port,
    '--ip', '127.0.0.1',
    '--persist-to', persistTo,
    '--show-interactive-dev-session=false',
  ], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: process.env.CI ?? '' } });
  wrangler.on('exit', (code, signal) => {
    if (stopping) {
      process.exit(code ?? (signal ? 1 : 0));
      return;
    }
    if (restarts >= MAX_RESTARTS) {
      console.error(`OstRecht-Worker: wrangler dev beendet (${code ?? signal}); ${MAX_RESTARTS} Neustarts erschöpft.`);
      process.exit(code ?? 1);
      return;
    }
    restarts += 1;
    console.error(`OstRecht-Worker: wrangler dev unerwartet beendet (${code ?? signal}); Neustart ${restarts}/${MAX_RESTARTS} in 2 s.`);
    setTimeout(spawnWrangler, 2000);
  });
}

const stop = (signal) => {
  stopping = true;
  if (wrangler && !wrangler.killed) wrangler.kill(signal);
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal));
spawnWrangler();

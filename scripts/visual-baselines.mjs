#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { normalizeSiteTargets } from './lib/site-targets.mjs';

/**
 * Screenshot-Baselines der Screenshot-Suite (tests/visual.spec.ts) erneuern – ein Befehl, ein
 * Ergebnis: Linux ist die kanonische Plattform, versioniert sind nur `-linux.png`-Baselines.
 *
 *   update [--site portal|law|portal,law] [--grep <Muster>] [--critical] [--no-build]
 *     Führt die Suite im festen Playwright-Container (Docker, exakt die Version aus
 *     package-lock.json wie in CI) gegen das Testfixture aus, erzeugt nur die gewählten Baselines
 *     neu (--update-snapshots) und vergleicht anschließend strikt gegen die neuen Dateien. Node-
 *     Abhängigkeiten des Containers liegen in einem Docker-Volume (erster Lauf: npm ci), der
 *     Build und der Fixture-Seed entstehen im Container; das Repository ist eingehängt, die
 *     Baselines landen direkt unter tests/visual.spec.ts-snapshots/.
 *
 *   apply --run <Workflow-Lauf-ID>
 *     Ohne Docker: Artefakt des Workflows „Screenshot-Baselines erneuern“ herunterladen (gh) und
 *     die enthaltenen Linux-Baselines in tests/visual.spec.ts-snapshots/ übernehmen.
 *
 * In beiden Fällen bleibt die Sichtprüfung (git diff --stat, Bilder ansehen) und der Commit
 * bewusst manuell; die normale PR-CI aktualisiert nie selbst Baselines.
 */

const ROOT = resolve(process.cwd());
const SNAPSHOT_DIR = join(ROOT, 'tests', 'visual.spec.ts-snapshots');
const FIXTURE = 'data/recht/runtime-fixture.json';
const NODE_MODULES_VOLUME = 'ostrecht-visual-node-modules';

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function run(command, args, { cwd = ROOT, env = process.env, capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    const stdout = [];
    if (capture) child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(`${command} ${args.slice(0, 3).join(' ')} endete mit ${signal ?? code}`));
    });
  });
}

async function playwrightVersion() {
  const lock = JSON.parse(await readFile(join(ROOT, 'package-lock.json'), 'utf8'));
  const version = lock.packages?.['node_modules/@playwright/test']?.version;
  if (!version) throw new Error('Playwright-Version nicht in package-lock.json gefunden');
  return version;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

async function update(args) {
  const sites = normalizeSiteTargets(valueAfter(args, '--site'));
  const grep = valueAfter(args, '--grep');
  const critical = args.includes('--critical');
  const build = !args.includes('--no-build');
  await run('docker', ['--version'], { capture: true }).catch(() => {
    throw new Error('Docker ist nicht verfügbar. Ohne Docker: Workflow „Screenshot-Baselines erneuern“ starten und danach `npm run test:visual:baselines:apply -- --run <Lauf-ID>` ausführen.');
  });
  const image = `mcr.microsoft.com/playwright:v${await playwrightVersion()}-noble`;
  const suite = critical ? 'npm run test:visual:critical --' : 'npm run test:visual:extended --';
  const grepArgument = grep ? ` --grep ${shellQuote(grep)}` : '';
  const steps = [
    'set -euo pipefail',
    'git config --global --add safe.directory /work',
    // Linux-Abhängigkeiten im Volume, nur bei geänderter package-lock.json erneut installieren.
    'if [ ! -f node_modules/.ostrecht-lock-sha ] || [ "$(cat node_modules/.ostrecht-lock-sha)" != "$(sha256sum package-lock.json | cut -d\' \' -f1)" ]; then npm ci --no-audit --no-fund && sha256sum package-lock.json | cut -d\' \' -f1 > node_modules/.ostrecht-lock-sha; fi',
    build ? 'npm run build' : 'echo "Build übersprungen (--no-build)"',
    `OSTRECHT_D1_FIXTURE=${FIXTURE} node scripts/serve-law-worker.mjs --seed-only`,
    `${suite} --update-snapshots${grepArgument}`,
    `${suite}${grepArgument}`,
  ];
  const dockerArgs = [
    'run', '--rm', '--ipc=host',
    '-v', `${ROOT}:/work`,
    '-v', `${NODE_MODULES_VOLUME}:/work/node_modules`,
    '-w', '/work',
    '-e', 'HOME=/root',
    '-e', 'CI=1',
    '-e', 'OSTRECHT_VISUAL_STRICT=1',
    '-e', `OSTRECHT_D1_FIXTURE=${FIXTURE}`,
    '-e', `SITE_TARGETS=${sites.join(',')}`,
    image,
    'bash', '-lc', steps.join(' && '),
  ];
  console.log(`Container ${image}; Websites ${sites.join(', ')}${grep ? `; Tests „${grep}“` : ''}${critical ? '; kritische Suite' : ''}`);
  await run('docker', dockerArgs);
  const changed = (await run('git', ['status', '--porcelain', '--', 'tests/visual.spec.ts-snapshots'], { capture: true })).trim();
  console.log(changed ? `Geänderte Baselines:\n${changed}\nSichtprüfung, dann committen.` : 'Keine Baseline hat sich geändert.');
}

async function apply(args) {
  const runId = valueAfter(args, '--run');
  if (!runId) throw new Error('apply braucht --run <Workflow-Lauf-ID> (Workflow „Screenshot-Baselines erneuern“)');
  const directory = await mkdtemp(join(tmpdir(), 'visual-baselines-'));
  try {
    await run('gh', ['run', 'download', runId, '--pattern', 'visual-baselines-linux-*', '--dir', directory]);
    const files = [];
    async function walk(current) {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile() && entry.name.endsWith('-linux.png')) files.push(path);
      }
    }
    await walk(directory);
    if (files.length === 0) throw new Error(`Artefakt des Laufs ${runId} enthält keine -linux.png-Baselines`);
    let added = 0;
    let replaced = 0;
    for (const file of files) {
      const target = join(SNAPSHOT_DIR, file.slice(file.lastIndexOf('/') + 1));
      const existed = await stat(target).then(() => true, () => false);
      await copyFile(file, target);
      if (existed) replaced += 1;
      else added += 1;
    }
    const changed = (await run('git', ['status', '--porcelain', '--', 'tests/visual.spec.ts-snapshots'], { capture: true })).trim();
    console.log(`${files.length} Baselines übernommen (${replaced} ersetzt, ${added} neu); tatsächlich geändert:\n${changed || '(keine)'}\nSichtprüfung, dann committen. Der strikte Vergleich lief bereits im Workflow.`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const command = process.argv[2];
const args = process.argv.slice(3);
if (command === 'update') await update(args);
else if (command === 'apply') await apply(args);
else {
  console.error('Verwendung: visual-baselines.mjs update [--site portal|law|portal,law] [--grep <Muster>] [--critical] [--no-build] | apply --run <Workflow-Lauf-ID>');
  process.exit(2);
}

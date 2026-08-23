#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const root = resolve(process.cwd());
const args = process.argv.slice(2);
const files = args.flatMap((argument, index) => argument === '--file' && args[index + 1]
  ? args[index + 1].split(',').map((file) => basename(file.trim())).filter(Boolean)
  : []);
const write = args.includes('--write');
const quick = args.includes('--quick');

if (files.length === 0) {
  console.error('Verwendung: npm run norms:workflow -- --file <amtliche-quelle.html> [--file <weitere-quelle>] [--write] [--quick]');
  process.exit(2);
}

function run(command, commandArgs, label) {
  console.log(`\n[Normworkflow] ${label}`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const selected = files.flatMap((file) => ['--file', file]);
run('node', ['scripts/import-normen.mjs', '--source-dir', 'Gesetze', '--strict', ...selected], 'Quellen und Parser strikt prüfen');
run('node', ['scripts/revosax-snapshot.mjs', 'audit'], 'versionierte REVOSax-Ausgangsquellen prüfen');
run('node', ['scripts/audit-consolidation.mjs', '--check'], 'Patch-Rezepte und Konsolidierung auf Sperrgründe prüfen');

if (write) {
  run('node', ['scripts/import-normen.mjs', '--source-dir', 'Gesetze', '--write', '--update-existing', ...selected], 'ausgewählte Quellen inkrementell importieren');
  run('node', ['scripts/consolidate-norms.mjs', '--write'], 'geprüfte Folgefassungen erzeugen');
}

run('npm', ['run', 'content:check'], 'Content- und Metadatenprüfung');
run('npm', ['run', 'knowledge:check'], 'Wissenshub vor der Generierung prüfen');
if (write) run('npm', ['run', 'knowledge:build'], 'Wissenshub generieren');
run('npm', ['run', 'knowledge:check'], 'Wissenshub nach der Generierung prüfen');

if (!quick) {
  for (const [script, label] of [
    ['test:unit', 'Unit- und Regressionstests'],
    ['check', 'Astro- und TypeScript-Prüfung'],
    ['editorial:check', 'Editorial Worker'],
    ['build', 'beide öffentlichen Anwendungen'],
    ['links:check', 'interne und domainübergreifende Links'],
    ['seo:check', 'öffentliche Metadaten und SEO'],
    ['test:browsers', 'Browser-Smoke-Tests'],
    ['test:a11y', 'Accessibility-Smoke-Tests'],
    ['test:visual', 'visuelle Regressionen'],
  ]) run('npm', ['run', script], label);
}

console.log(`\nNormworkflow erfolgreich abgeschlossen (${write ? 'Schreibmodus' : 'Prüfmodus'}${quick ? ', verkürzte QA' : ''}).`);

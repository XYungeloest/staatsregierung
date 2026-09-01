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
run(
  'node',
  ['scripts/import-normen.mjs', '--source-dir', 'Gesetze', ...(write ? [] : ['--strict']), ...selected],
  write ? 'Quellen und Parser vor dem Schreiben prüfen' : 'Quellen und Parser strikt prüfen',
);
run('node', ['scripts/revosax-snapshot.mjs', 'audit'], 'versionierte REVOSax-Ausgangsquellen prüfen');
run('node', ['scripts/audit-consolidation.mjs', '--check'], 'Patch-Rezepte und Konsolidierung auf Sperrgründe prüfen');

if (write) {
  run('node', ['scripts/import-normen.mjs', '--source-dir', 'Gesetze', '--write', '--update-existing', ...selected], 'ausgewählte Quellen inkrementell importieren');
  run('node', ['scripts/apply-corrections.mjs', '--all', '--write'], 'amtliche Berichtigungen deklaratorisch anwenden');
  run('node', ['scripts/audit-consolidation.mjs'], 'Konsolidierungsmanifest nach dem Import aktualisieren');
  run('node', ['scripts/revosax-snapshot.mjs', 'parse', '--all'], 'alle REVOSax-Ausgangsquellen strukturiert erneuern');
  run(
    'node',
    ['scripts/materialize-revosax-norms.mjs', '--all', '--update-existing', '--write'],
    'REVOSax-Stammfassungen deterministisch materialisieren',
  );
  run('node', ['scripts/consolidate-norms.mjs', '--all', '--write'], 'geprüfte Folgefassungen erzeugen');
  run('node', ['scripts/apply-corrections.mjs', '--all', '--write'], 'Berichtigungsprovenienz nach der Konsolidierung sichern');
  run('node', ['scripts/audit-consolidation.mjs'], 'Konsolidierungsmanifest und Bericht abschließend erneuern');
  run('node', ['scripts/audit-consolidation.mjs', '--check'], 'Konsolidierungsmanifest und Bericht abschließend prüfen');
  run('node', ['scripts/import-normen.mjs', '--source-dir', 'Gesetze', '--strict', ...selected], 'geschriebene Quellen strikt gegen den Parser prüfen');
}

run('npm', ['run', 'content:check'], 'Content- und Metadatenprüfung');
run('npm', ['run', 'knowledge:check'], 'Wissenshub vor der Generierung prüfen');
if (write) run('npm', ['run', 'knowledge:build'], 'Wissenshub generieren');
run('npm', ['run', 'knowledge:check'], 'Wissenshub nach der Generierung prüfen');

if (!quick) {
  for (const [script, label] of [
    ['test:unit', 'Unit- und Regressionstests'],
    ['check', 'Astro- und TypeScript-Prüfung'],
    ['build', 'beide öffentlichen Anwendungen'],
    ['test:links:run', 'interne und domainübergreifende Links'],
    ['test:seo:run', 'öffentliche Metadaten und SEO'],
    ['test:browsers:ci', 'zentrale Nutzerwege in Chromium'],
    ['test:a11y:ci', 'repräsentative Accessibility-Smoke-Tests'],
  ]) run('npm', ['run', script], label);
}

console.log(`\nNormworkflow erfolgreich abgeschlossen (${write ? 'Schreibmodus' : 'Prüfmodus'}${quick ? ', verkürzte QA' : ''}).`);

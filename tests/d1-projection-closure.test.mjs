import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { computeProjectionClosure, projectionClosure, PROJECTION_ENTRY_POINTS } from '../scripts/lib/d1-projection-closure.mjs';
import { projectionLogicLines, projectionIdentity, projectionIdentityAtRef } from '../scripts/lib/d1-projection-fingerprint.mjs';
import { isProjectionLogicPath, scopeFromChangedPaths } from '../scripts/lib/d1-sync-scope.mjs';

const ROOT = process.cwd();

/** Synthetischer Baum: Einstieg, Workspace-Paket mit Exportmuster, Sammeldatei, JSON, dynamische Importe. */
async function syntheticTree({ nonLiteral = false } = {}) {
  const tree = await mkdtemp(join(tmpdir(), 'closure-'));
  await mkdir(join(tree, 'scripts', 'lib'), { recursive: true });
  await mkdir(join(tree, 'packages', 'shared', 'src', 'lib', 'norms'), { recursive: true });
  await mkdir(join(tree, 'packages', 'shared', 'src', 'config'), { recursive: true });
  await writeFile(join(tree, 'package.json'), '{"name":"root","workspaces":["packages/*"]}\n');
  await writeFile(join(tree, 'packages', 'shared', 'package.json'), '{"name":"@ostrecht/shared","exports":{"./*":"./src/*"}}\n');
  await writeFile(join(tree, 'packages', 'shared', 'src', 'config', 'editorial.json'), '{"referenceDate":"2026-09-04"}\n');
  await writeFile(join(tree, 'packages', 'shared', 'src', 'lib', 'norms', 'used.ts'), "export function used(): string { return 'used'; }\n");
  await writeFile(join(tree, 'packages', 'shared', 'src', 'lib', 'norms', 'unused.ts'), "export function unused(): string { return 'unused'; }\n");
  await writeFile(join(tree, 'packages', 'shared', 'src', 'lib', 'norms', 'render.ts'), "export function render(): string { return 'darstellung'; }\n");
  await writeFile(join(tree, 'packages', 'shared', 'src', 'lib', 'norms', 'index.ts'), "export * from '@ostrecht/shared/lib/norms/used.ts';\nexport { unused } from '@ostrecht/shared/lib/norms/unused.ts';\n");
  await writeFile(join(tree, 'packages', 'shared', 'src', 'lib', 'norms', 'versions.ts'), "import editorial from '@ostrecht/shared/config/editorial.json' with { type: 'json' };\nexport const DATE: string = editorial.referenceDate;\n");
  await writeFile(join(tree, 'scripts', 'lib', 'helper.mjs'), "export const helper = () => import('./lazy.mjs');\n");
  await writeFile(join(tree, 'scripts', 'lib', 'lazy.mjs'), "export const lazy = 1;\n");
  await writeFile(join(tree, 'scripts', 'sync-recht-d1.mjs'), [
    "import { used } from '@ostrecht/shared/lib/norms/index.ts';",
    "import { DATE } from '@ostrecht/shared/lib/norms/versions.ts';",
    "import { helper } from './lib/helper.mjs';",
    "import { readFile } from 'node:fs/promises';",
    "import parse5 from 'parse5';",
    nonLiteral ? "export const dyn = (name) => import(name);" : '// import(name) nur im Kommentar – zählt nicht',
    'export const run = () => [used(), DATE, helper, readFile, parse5];',
    '',
  ].join('\n'));
  return tree;
}

test('Abschluss folgt Importen, Re-Exports, Sammeldateien, JSON und literalen dynamischen Importen; Darstellung bleibt draußen', async () => {
  const tree = await syntheticTree();
  const closure = await computeProjectionClosure({ tree });
  assert.equal(closure.uncertain, false, closure.reasons.join('; '));
  assert.deepEqual(closure.files, [
    'packages/shared/src/config/editorial.json',
    'packages/shared/src/lib/norms/index.ts',
    'packages/shared/src/lib/norms/unused.ts',
    'packages/shared/src/lib/norms/used.ts',
    'packages/shared/src/lib/norms/versions.ts',
    'scripts/lib/helper.mjs',
    'scripts/lib/lazy.mjs',
    'scripts/sync-recht-d1.mjs',
  ]);
  // Die Sammeldatei zieht ihre Ziele mit (unused.ts wird über index.ts erreicht), render.ts nie.
  assert.ok(!closure.files.includes('packages/shared/src/lib/norms/render.ts'));
  assert.deepEqual(closure.externals, ['parse5']);
});

test('nicht literale dynamische Importe machen den Abschluss unsicher (fail-closed); ein fehlender Einstieg ebenso', async () => {
  const closure = await computeProjectionClosure({ tree: await syntheticTree({ nonLiteral: true }) });
  assert.equal(closure.uncertain, true);
  assert.match(closure.reasons.join('; '), /sync-recht-d1\.mjs: dynamischer Import/u);
  const missing = await computeProjectionClosure({ tree: await syntheticTree(), entryPoints: ['scripts/gibt-es-nicht.mjs'] });
  assert.equal(missing.uncertain, true);
  assert.deepEqual(missing.files, []);
});

test('Abschluss des Repositorys: Projektionscode ist drin, reine Darstellung nicht, keine Unsicherheit', async () => {
  const closure = await projectionClosure({ root: ROOT });
  assert.equal(closure.uncertain, false, closure.reasons.join('; '));
  assert.deepEqual(closure.externals, [], 'die Projektion braucht keine externen Pakete');
  for (const file of [
    ...PROJECTION_ENTRY_POINTS,
    'packages/shared/src/lib/norms/origin.ts',
    'packages/shared/src/lib/norms/derived.ts',
    'packages/recht-search/src/search.ts',
    'packages/shared/src/config/site-routing.ts',
    'packages/shared/src/config/editorial.json',
    'packages/shared/src/lib/portal/schema.ts',
    'scripts/lib/d1-sync-scope.mjs',
  ]) assert.ok(closure.files.includes(file), `${file} gehört zur Projektion`);
  for (const file of [
    'packages/shared/src/config/site.ts',
    'packages/shared/src/lib/norms/origin-presentation.ts',
    'packages/shared/src/lib/norms/display.ts',
    'packages/shared/src/lib/portal/organization.ts',
    'packages/shared/src/lib/norms/diff-render.ts',
    'packages/shared/src/lib/norms/diff.ts',
    'packages/shared/src/lib/norms/units.ts',
    'packages/shared/src/lib/norms/index.ts',
    'packages/recht-search/src/search-query.ts',
    'packages/recht-search/src/search-files.ts',
    'packages/shared/src/config/analytics.ts',
    'scripts/lib/d1-runtime-seed.mjs',
  ]) assert.ok(!closure.files.includes(file), `${file} ist keine Projektionslogik`);
});

test('Abschluss und Identität eines Git-Refs entsprechen dem sauberen Arbeitsbaum; Logikzeilen tragen Schema, Abschluss und Format', async () => {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'scripts', 'packages', 'data/recht/d1', 'package.json', 'package-lock.json'], { encoding: 'utf8' }).trim();
  const lines = await projectionLogicLines(ROOT);
  assert.ok(lines.includes('closure-format:1'));
  assert.ok(!lines.includes('closure:uncertain'));
  assert.ok(lines.some((line) => line.startsWith('data/recht/d1/0001_rechtsbestand.sql\t')), 'Schema ist Teil des Logikhashes');
  assert.ok(lines.some((line) => line.startsWith('scripts/sync-recht-d1.mjs\t')));
  assert.ok(!lines.some((line) => line.startsWith('packages/shared/src/lib/norms/diff-render.ts\t')));
  if (dirty) return;
  const [working, atHead] = await Promise.all([projectionIdentity({ root: ROOT }), projectionIdentityAtRef('HEAD', { root: ROOT })]);
  assert.deepEqual(atHead.logicFiles, working.logicFiles);
  assert.equal(atHead.logic, working.logic);
  assert.equal(atHead.fingerprint, working.fingerprint);
  assert.equal(atHead.legacyFingerprint, working.legacyFingerprint);
});

test('Umfangsbestimmung mit Abschluss: nur erreichte Dateien sind Logikänderungen, Schema immer, ohne Abschluss die Obermenge', () => {
  const logicPaths = new Set(['packages/shared/src/lib/norms/origin.ts', 'packages/recht-search/src/search.ts', 'scripts/sync-recht-d1.mjs']);
  const existingSlugs = new Set(['foo']);
  // Darstellung in denselben Verzeichnissen: kein Trigger.
  for (const path of ['packages/shared/src/lib/norms/diff-render.ts', 'packages/recht-search/src/search-query.ts', 'packages/shared/src/lib/norms/index.ts']) {
    assert.equal(isProjectionLogicPath(path, logicPaths), false, path);
    const scope = scopeFromChangedPaths([path, 'content/normen/foo/history.json'], { existingSlugs, logicPaths });
    assert.equal(scope.mode, 'incremental', path);
    assert.deepEqual(scope.slugs, ['foo']);
    assert.equal(scope.ignoredPaths, 1);
  }
  // Erreichte Dateien: Vollprojektion, sofern kein Nachweis etwas anderes belegt.
  for (const path of ['packages/shared/src/lib/norms/origin.ts', 'packages/recht-search/src/search.ts']) {
    assert.equal(isProjectionLogicPath(path, logicPaths), true, path);
    assert.equal(scopeFromChangedPaths([path], { existingSlugs, logicPaths }).mode, 'full', path);
    const narrow = scopeFromChangedPaths([path], { existingSlugs, logicPaths, logicChange: 'narrow' });
    assert.equal(narrow.mode, 'incremental');
    assert.equal(narrow.derivedRebuild, true);
    assert.equal(narrow.refreshSearchDocuments, true);
    const ignored = scopeFromChangedPaths([path], { existingSlugs, logicPaths, logicChange: 'ignore' });
    assert.equal(ignored.mode, 'incremental');
    assert.equal(ignored.derivedRebuild, false);
    assert.equal(ignored.refreshSearchDocuments, false);
  }
  // Schema: immer Vollprojektion, auch mit Nachweis.
  for (const logicChange of ['full', 'narrow', 'ignore']) {
    assert.equal(scopeFromChangedPaths(['data/recht/d1/0008_neu.sql'], { existingSlugs, logicPaths, logicChange }).mode, 'full', logicChange);
  }
  // Ohne Abschluss (unsicher): konservative Obermenge, auch reine Darstellung löst die Vollprojektion aus.
  assert.equal(isProjectionLogicPath('packages/shared/src/lib/norms/diff-render.ts', null), true);
  assert.equal(scopeFromChangedPaths(['packages/shared/src/lib/norms/diff-render.ts'], { existingSlugs }).mode, 'full');
  // Eine unbekannte Datei im Projektionspfad, die der Abschluss nicht erreicht, ist keine Logik – aber
  // ohne sicheren Abschluss fail-closed schon.
  assert.equal(isProjectionLogicPath('packages/shared/src/lib/norms/neu.ts', logicPaths), false);
  assert.equal(isProjectionLogicPath('packages/shared/src/lib/norms/neu.ts', null), true);
  assert.throws(() => scopeFromChangedPaths([], { existingSlugs, logicChange: 'trust-me' }), /logicChange muss full, narrow oder ignore sein/u);
});

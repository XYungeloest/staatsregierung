import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { compareProjections, formatComparison } from '../../scripts/lib/d1-projection-compare.mjs';
import { FULL_SCOPE, projectionIdentity } from '../../scripts/lib/d1-projection-fingerprint.mjs';
import { linkNodeModules } from '../../scripts/lib/d1-projection-proof.mjs';
import { scopeFromChangedPaths } from '../../scripts/lib/d1-sync-scope.mjs';

/**
 * Abnahmefälle der Projektionsidentität, gerechnet statt behauptet – auf dem Testfixture
 * (data/recht/runtime-fixture.json), damit jede Projektion Sekunden statt Minuten dauert:
 *
 *   A  origin.ts, nur formatNormOriginBadge      → Identität ändert sich, Daten identisch
 *   B  diff-render.ts, reine Darstellung         → Identität unverändert, Daten identisch
 *   C  site.ts, nur targetLabels                 → Identität ändert sich, Daten identisch
 *   D  origin.ts, formatNormOriginKind           → Identität ändert sich, Daten verschieden (Suchfilter)
 *   E  search.ts, buildSearchDocument            → Identität ändert sich, Daten verschieden (Suchdokumente)
 *   G  Schema (neue Migration)                   → Identität ändert sich, Umfang immer full
 *
 * Jeder Fall wird in einem temporären Worktree mit dem Code des Arbeitsbaums plus genau einer
 * Änderung projiziert (Kindprozess mit dem Code des Worktrees) und gegen die unveränderte
 * Fixture-Projektion verglichen. Fall F (unsicherer Abschluss) steht in
 * tests/d1-projection-closure.test.mjs.
 */

const ROOT = process.cwd();
const FIXTURE = 'data/recht/runtime-fixture.json';
const CODE_PATHS = ['scripts', 'packages', 'data/recht/d1', 'tests/helpers', 'package.json', 'package-lock.json'];

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function overlayWorkingTreeCode(tree) {
  for (const path of CODE_PATHS) {
    await rm(join(tree, path), { recursive: true, force: true });
    await cp(join(ROOT, path), join(tree, path), { recursive: true });
  }
}

async function buildFixtureProjection(tree, out) {
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/d1-runtime-seed.mjs', 'build', '--fixture', FIXTURE, '--out', out], { cwd: tree, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, OSTRECHT_D1_FIXTURE: '' } });
  return out;
}

async function patch(tree, file, from, to, { occurrence = 'all' } = {}) {
  const path = join(tree, file);
  const source = await readFile(path, 'utf8');
  assert.ok(source.includes(from), `${file}: Muster „${from.slice(0, 40)}“ nicht gefunden`);
  const patched = occurrence === 'first' ? source.replace(from, to) : source.replaceAll(from, to);
  await writeFile(path, patched, 'utf8');
}

test('Abnahmefälle A–E und G: nur Code, den die Projektion erreicht, ändert die Identität; nur Code, den sie ausführt, ändert die Daten', { timeout: 20 * 60 * 1000 }, async () => {
  const tree = await realpath(await mkdtemp(join(tmpdir(), 'd1-equivalence-')));
  await rm(tree, { recursive: true, force: true });
  git(ROOT, 'worktree', 'add', '--detach', tree, 'HEAD');
  const outDir = await mkdtemp(join(tmpdir(), 'd1-equivalence-out-'));
  try {
    await linkNodeModules(ROOT, tree);
    await overlayWorkingTreeCode(tree);
    const baseline = await projectionIdentity({ root: tree, scope: FULL_SCOPE });
    assert.equal(baseline.closureUncertain, false, baseline.closureReasons.join('; '));
    const basePath = await buildFixtureProjection(tree, join(outDir, 'base.sqlite'));
    const logicPaths = new Set(baseline.logicFiles);

    const cases = [
      { name: 'A origin.ts nur formatNormOriginBadge', file: 'packages/shared/src/lib/norms/origin.ts', from: "return 'Übernommen · geändert';", to: "return 'Übernommen · geändert (Abnahme A)';", identityChanges: true, dataChanges: false },
      { name: 'B diff-render.ts reine Darstellung', file: 'packages/shared/src/lib/norms/diff-render.ts', from: 'function escapeHtml(', to: "export const ABNAHME_B = 'Darstellung';\nfunction escapeHtml(", identityChanges: false, dataChanges: false },
      { name: 'C site.ts nur targetLabels', file: 'packages/shared/src/config/site.ts', from: "search: 'Rechtssuche',", to: "search: 'Rechtssuche (Abnahme C)',", identityChanges: true, dataChanges: false },
      { name: 'D origin.ts formatNormOriginKind', file: 'packages/shared/src/lib/norms/origin.ts', from: "return 'Übernommen und ostdeutsch geändert';", to: "return 'Übernommen und ostdeutsch geändert (Abnahme D)';", identityChanges: true, dataChanges: true, tables: ['law_runtime_meta'] },
      { name: 'E search.ts buildSearchDocument', file: 'packages/recht-search/src/search.ts', from: 'title: toDisplayText(identity.title),', to: "title: `${toDisplayText(identity.title)} (Abnahme E)`,", occurrence: 'first', identityChanges: true, dataChanges: true, tables: ['law_search_documents'] },
      { name: 'G Schema', file: 'data/recht/d1/0008_abnahme_g.sql', create: 'ALTER TABLE law_norms ADD COLUMN abnahme_g TEXT;\n', identityChanges: true, dataChanges: true, full: true },
    ];
    for (const entry of cases) {
      // Worktree auf den unveränderten Stand zurücksetzen (Code des Arbeitsbaums), dann genau eine Änderung.
      await overlayWorkingTreeCode(tree);
      if (entry.create) await writeFile(join(tree, entry.file), entry.create, 'utf8');
      else await patch(tree, entry.file, entry.from, entry.to, { occurrence: entry.occurrence });
      const identity = await projectionIdentity({ root: tree, scope: FULL_SCOPE });
      assert.equal(identity.closureUncertain, false, `${entry.name}: ${identity.closureReasons.join('; ')}`);
      assert.equal(identity.fingerprint !== baseline.fingerprint, entry.identityChanges, `${entry.name}: Identität ${entry.identityChanges ? 'muss' : 'darf nicht'} sich ändern`);
      const scope = scopeFromChangedPaths([entry.file], { existingSlugs: new Set(), logicPaths: new Set([...logicPaths, ...identity.logicFiles]) });
      assert.equal(scope.mode, entry.full ? 'full' : (entry.identityChanges ? 'full' : 'incremental'), `${entry.name}: Umfang ohne Nachweis`);
      if (entry.full) {
        for (const logicChange of ['narrow', 'ignore']) assert.equal(scopeFromChangedPaths([entry.file], { existingSlugs: new Set(), logicPaths, logicChange }).mode, 'full', `${entry.name}: Schema bleibt full (${logicChange})`);
      }
      const candidate = await buildFixtureProjection(tree, join(outDir, `${entry.name.slice(0, 1)}.sqlite`));
      const comparison = await compareProjections(basePath, candidate, { root: ROOT });
      assert.equal(!comparison.identical, entry.dataChanges, `${entry.name}: Daten ${entry.dataChanges ? 'müssen' : 'dürfen nicht'} abweichen\n${formatComparison(comparison)}`);
      if (entry.tables) for (const table of entry.tables) assert.ok(comparison.differingTables.includes(table), `${entry.name}: ${table} muss abweichen (${comparison.differingTables.join(', ')})`);
      if (!entry.dataChanges) assert.deepEqual(comparison.differingTables, []);
    }
  } finally {
    try {
      git(ROOT, 'worktree', 'remove', '--force', tree);
    } catch {
      await rm(tree, { recursive: true, force: true });
    }
    await rm(outDir, { recursive: true, force: true });
  }
});

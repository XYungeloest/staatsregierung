import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const sourcePath = new URL('../knowledge/holding-positions.json', import.meta.url);
const publicPath = new URL('../content/regierung/beteiligungsinventar.json', import.meta.url);
const allowedPositionFields = new Set([
  'key', 'name', 'origin', 'level', 'parent', 'parentKey', 'relation', 'stakePercent',
  'effectivePublicPercent', 'currentStakePercent', 'consolidatedInheritedPercent',
  'currentConsolidatedPercent', 'consolidatedPosition', 'legalForm', 'legalFormGroup',
  'cutoffStatus', 'currentStatus', 'change2023To2026',
]);
const forbiddenFields = new Set([
  'confidence', 'cutoffMethod', 'detailsSource', 'inventorySource', 'locator', 'note',
  'notes', 'path', 'sourceId', 'sourceIds', 'sourceLocator', 'sourceRefs',
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('öffentliche Beteiligungsprojektion ist deterministisch und vollständig', async () => {
  const run = spawnSync(process.execPath, ['scripts/build-public-holdings.mjs', '--check'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const [source, publicInventory] = await Promise.all([readJson(sourcePath), readJson(publicPath)]);
  const sourceCount = source.portfolios.reduce((sum, portfolio) => sum + portfolio.positions.length, 0);
  assert.equal(publicInventory.positions.length, sourceCount);
  assert.equal(publicInventory.positions.length, publicInventory.totals.positionRows);
  assert.equal(publicInventory.totals.directRows + publicInventory.totals.indirectAndSecondDegreeRows, sourceCount);
});

test('öffentliche Positionen enthalten ausschließlich freigegebene Felder und gültige Verweise', async () => {
  const publicInventory = await readJson(publicPath);
  const keys = new Set(publicInventory.positions.map((position) => position.key));

  for (const position of publicInventory.positions) {
    assert.deepEqual(new Set(Object.keys(position)), allowedPositionFields);
    for (const key of Object.keys(position)) assert.equal(forbiddenFields.has(key), false, key);
    if (position.parentKey !== null) assert.equal(keys.has(position.parentKey), true, position.parentKey);
    for (const key of ['stakePercent', 'effectivePublicPercent', 'currentStakePercent', 'consolidatedInheritedPercent', 'currentConsolidatedPercent']) {
      assert.equal(position[key] === null || (typeof position[key] === 'number' && position[key] >= 0 && position[key] <= 100), true, `${position.key}.${key}`);
    }
  }

  const serialized = JSON.stringify(publicInventory);
  assert.equal(serialized.includes('knowledge/'), false);
  assert.equal(serialized.includes('sourceLocator'), false);
  assert.equal(serialized.includes('/Users/'), false);
  assert.equal(serialized.includes('confidence'), false);
});

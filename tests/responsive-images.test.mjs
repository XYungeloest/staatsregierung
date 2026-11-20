import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { responsiveImages } from '../scripts/generate-responsive-images.mjs';
import { classifyChangeScope } from '../scripts/classify-change-scope.mjs';

test('Einzelmotiv erzeugen, lesend prüfen und gezielt reparieren', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'responsive-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifestPath = join(root, 'index.json');
  for (const group of ['regierung', 'ministerien', 'jobs', 'ui', 'social']) await mkdir(join(root, group));
  const preview = join(root, 'social/portal-preview.png');
  await writeFile(preview, 'redaktionelles Bild');
  await writeFile(manifestPath, '{}\n');
  const source = 'regierung/motiv.png';
  const original = (background) => sharp({ create: { width: 16, height: 16, channels: 3, background } }).png().toBuffer();
  await writeFile(join(root, source), await original('green'));
  const run = (options = {}) => responsiveImages({ manifestPath, imageRoot: root, ...options });
  assert.equal((await run({ check: true })).problems.length, 9);
  assert.equal((await run({ source })).written, 9);
  const manifest = await readFile(manifestPath, 'utf8');
  assert.deepEqual(await run(), { written: 0, problems: [] });
  const damaged = join(root, 'generated/regierung/motiv-240.jpg');
  await writeFile(damaged, 'defekt');
  assert.equal((await run({ check: true })).problems.length, 1);
  assert.equal(await readFile(damaged, 'utf8'), 'defekt');
  assert.equal((await run()).written, 1);
  assert.equal(await readFile(manifestPath, 'utf8'), manifest);
  await writeFile(join(root, source), await original('blue'));
  assert.equal((await run({ source, check: true })).problems.length, 9);
  assert.equal((await run()).written, 9);
  assert.deepEqual((await run({ check: true })).problems, []);
  await assert.rejects(run({ source: '../fremd' }), /Unbekanntes Original/);
  assert.equal(await readFile(preview, 'utf8'), 'redaktionelles Bild');
  await rm(join(root, source));
  assert.ok((await run({ check: true })).problems.some((message) => message.includes('Verwaiste Variante')));
});

test('Bildprüfung läuft auch für eine einzeln geänderte Variante oder Prüfsummendatei', () => {
  for (const [path, targets] of [
    ['data/responsive-images.json', []], ['public/images/generated/jobs/a-480.avif', ['portal']],
    ['public/images/ui/ost-flagge.png', ['portal', 'law']],
  ]) {
    const scope = classifyChangeScope([path]);
    assert.deepEqual(scope.deployTargets, targets);
    assert.equal(scope.runContentCheck, true);
    assert.equal(scope.runD1Sync, false);
  }
});

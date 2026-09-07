import assert from 'node:assert/strict';
import test from 'node:test';

import * as sync from '../../scripts/sync-recht-d1.mjs';

const ROOT = process.cwd();

/**
 * Der Äquivalenznachweis muss dieselben Projektionseingaben laden wie der echte Sync und der
 * Vollseed. Diese Prüfung liest den ganzen Bestand und steht deshalb bei den Korpus-Tests; die
 * Regel selbst (fail-closed ohne Register) prüft `tests/d1-projection-inputs.test.mjs`.
 */
test('loadProjectionInputs liefert dieselben vier Eingaben wie Sync und Vollseed', async () => {
  const { loadProjectionInputs } = await import('../../scripts/lib/d1-projection-proof.mjs');
  const { loadKeywordRegister, registerKeywordsBySlug } = await import('@ostrecht/shared/lib/norms/register.ts');
  const inputs = await loadProjectionInputs(ROOT, { sync });
  assert.ok(inputs.register instanceof Map, 'register ist eine Map');
  const expected = registerKeywordsBySlug(await loadKeywordRegister());
  assert.deepEqual([...inputs.register.keys()].sort(), [...expected.keys()].sort());
  for (const [slug, keywords] of expected) assert.deepEqual(inputs.register.get(slug), keywords);
});

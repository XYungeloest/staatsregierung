import assert from 'node:assert/strict';
import test from 'node:test';
import { documentedNpmScripts } from '../scripts/check-docs.mjs';

test('Dokumentation prüft konkrete npm-Skripte auch mit nachfolgenden Argumenten', () => {
  const example = '`npm run docs:check`\nnpm run --silent demo:read -- --json\nAlternativen unter npm run demo:*';
  assert.deepEqual([...documentedNpmScripts(example)], ['docs:check', 'demo:read']);
});

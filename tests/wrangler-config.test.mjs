import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function parseJsonc(text) {
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, ''));
}

test('OstRecht-Staging bindet ausdrücklich eigene D1- und R2-Ressourcen', async () => {
  const config = parseJsonc(await readFile(new URL('../apps/recht/wrangler.jsonc', import.meta.url), 'utf8'));
  const production = { d1: config.d1_databases?.[0], r2: config.r2_buckets?.[0] };
  const staging = { d1: config.env?.staging?.d1_databases?.[0], r2: config.env?.staging?.r2_buckets?.[0] };

  assert.equal(production.d1?.binding, 'ostrecht_recht');
  assert.equal(production.d1?.database_name, 'ostrecht-recht');
  assert.equal(production.r2?.bucket_name, 'ostrecht-recht-quellen');

  // Wrangler-Environments erben Bindings nicht; ohne eigene Angaben hätte staging keine Datenbank.
  assert.ok(staging.d1, 'env.staging.d1_databases fehlt');
  assert.ok(staging.r2, 'env.staging.r2_buckets fehlt');
  assert.equal(staging.d1.binding, production.d1.binding);
  assert.equal(staging.r2.binding, production.r2.binding);
  assert.equal(staging.d1.database_name, 'ostrecht-recht-staging');
  assert.equal(staging.r2.bucket_name, 'ostrecht-recht-quellen-staging');
  assert.notEqual(staging.d1.database_id, production.d1.database_id, 'staging darf nicht die produktive Datenbank binden');
  assert.match(staging.d1.database_id, /^[0-9a-f-]{36}$/u);
  assert.equal(config.env.staging.vars?.APP_ENV, 'staging');
});

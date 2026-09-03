import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildStagingConfig, parseJsonc } from '../scripts/write-staging-wrangler-config.mjs';

const generated = {
  name: 'ostrecht-recht', main: 'entry.mjs', compatibility_date: '2026-04-15', compatibility_flags: [], rules: [{ type: 'ESModule', globs: ['**/*.js'] }],
  assets: { directory: '../client', not_found_handling: '404-page', binding: 'ASSETS' }, workers_dev: true, preview_urls: true,
  routes: [{ pattern: 'recht.freistaat-ostdeutschland.de', custom_domain: true }], vars: { APP_ENV: 'production' },
  d1_databases: [{ binding: 'ostrecht_recht', database_name: 'ostrecht-recht', database_id: 'prod-id', migrations_dir: '../../migrations' }],
  r2_buckets: [{ binding: 'ostrecht_recht_quellen', bucket_name: 'ostrecht-recht-quellen' }], definedEnvironments: ['staging'], topLevelName: 'ostrecht-recht',
};

test('die Staging-Konfiguration übernimmt Name, Variablen und Bindings von env.staging und keine produktiven Ressourcen', async () => {
  const source = parseJsonc(await readFile(new URL('../apps/recht/wrangler.jsonc', import.meta.url), 'utf8'));
  const staging = buildStagingConfig(generated, source);
  assert.equal(staging.name, 'ostrecht-recht-staging');
  assert.equal(staging.main, 'entry.mjs');
  assert.deepEqual(staging.vars, { APP_ENV: 'staging' });
  assert.equal(staging.routes, undefined, 'keine Custom-Domain-Route für staging');
  assert.equal(staging.definedEnvironments, undefined);
  assert.deepEqual(staging.d1_databases.map((entry) => entry.database_name), ['ostrecht-recht-staging']);
  assert.deepEqual(staging.r2_buckets.map((entry) => entry.bucket_name), ['ostrecht-recht-quellen-staging']);
  assert.equal(staging.d1_databases[0].binding, 'ostrecht_recht');
  assert.equal(staging.d1_databases[0].migrations_dir, '../../migrations');
  assert.ok(!JSON.stringify(staging).includes('prod-id'));
  assert.ok(!JSON.stringify(staging).includes('"ostrecht-recht-quellen"'));
  assert.equal(staging.assets.directory, '../client');
});

test('fehlender Staging-Abschnitt oder produktive Ressourcen in env.staging brechen ab', () => {
  const source = { name: 'ostrecht-recht', d1_databases: [{ database_name: 'ostrecht-recht', database_id: 'prod-id' }], r2_buckets: [{ bucket_name: 'ostrecht-recht-quellen' }] };
  assert.throws(() => buildStagingConfig(generated, source), /keinen Abschnitt env\.staging/u);
  assert.throws(() => buildStagingConfig(generated, { ...source, env: { staging: { name: 'ostrecht-recht', d1_databases: [{ database_name: 'x', database_id: 'y' }], r2_buckets: [{ bucket_name: 'z' }] } } }), /produktiven Worker/u);
  assert.throws(() => buildStagingConfig(generated, { ...source, env: { staging: { name: 's', d1_databases: [{ database_name: 'ostrecht-recht', database_id: 'other' }], r2_buckets: [{ bucket_name: 'z' }] } } }), /produktive Datenbank/u);
  assert.throws(() => buildStagingConfig(generated, { ...source, env: { staging: { name: 's', d1_databases: [{ database_name: 'x', database_id: 'y' }], r2_buckets: [{ bucket_name: 'ostrecht-recht-quellen' }] } } }), /produktiven Bucket/u);
  assert.throws(() => buildStagingConfig(generated, { ...source, env: { staging: { name: 's', d1_databases: [], r2_buckets: [] } } }), /keine eigene D1/u);
});

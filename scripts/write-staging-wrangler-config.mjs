#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Staging-Konfiguration für den gebauten OstRecht-Worker.
 *
 * Der Cloudflare-Adapter von Astro schreibt nach dem Build eine aufgelöste Konfiguration
 * (apps/recht/dist/server/wrangler.json) ohne `env`-Abschnitt. `wrangler deploy --env staging`
 * fällt damit stillschweigend auf die Top-Level-Konfiguration zurück – also auf den produktiven
 * Worker `ostrecht-recht` mit produktiver D1 und R2. Dieses Skript erzeugt deshalb aus der
 * gebauten Konfiguration und dem Abschnitt `env.staging` der Quellkonfiguration
 * (apps/recht/wrangler.jsonc) eine eigenständige Staging-Konfiguration
 * (dist/server/wrangler.staging.json): Name, Variablen, D1- und R2-Bindings von staging,
 * keine Custom-Domain-Routen. Fail-closed: fehlt der Staging-Abschnitt oder nennt er eine
 * produktive Ressource, bricht das Skript ab.
 */

export function parseJsonc(text) {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:"'\\])\/\/.*$/gmu, '$1');
  return JSON.parse(withoutComments.replace(/,(\s*[}\]])/gu, '$1'));
}

/** Erzeugt die Staging-Konfiguration; reine Funktion über beide Konfigurationen. */
export function buildStagingConfig(generated, source) {
  const staging = source.env?.staging;
  if (!staging) throw new Error('Quellkonfiguration hat keinen Abschnitt env.staging');
  const productionName = source.name;
  const productionDatabases = new Set((source.d1_databases ?? []).flatMap((entry) => [entry.database_name, entry.database_id]));
  const productionBuckets = new Set((source.r2_buckets ?? []).map((entry) => entry.bucket_name));
  if (!staging.name || staging.name === productionName) throw new Error(`env.staging.name fehlt oder entspricht dem produktiven Worker ${productionName}`);
  const databases = staging.d1_databases ?? [];
  const buckets = staging.r2_buckets ?? [];
  if (databases.length === 0 || buckets.length === 0) throw new Error('env.staging bindet keine eigene D1-Datenbank oder keinen eigenen R2-Bucket');
  for (const entry of databases) {
    if (productionDatabases.has(entry.database_name) || productionDatabases.has(entry.database_id)) throw new Error(`env.staging bindet die produktive Datenbank ${entry.database_name}`);
  }
  for (const entry of buckets) {
    if (productionBuckets.has(entry.bucket_name)) throw new Error(`env.staging bindet den produktiven Bucket ${entry.bucket_name}`);
  }
  const generatedDatabase = generated.d1_databases?.[0] ?? {};
  const { routes: _routes, definedEnvironments: _defined, topLevelName: _topLevel, ...base } = generated;
  return {
    ...base,
    name: staging.name,
    workers_dev: staging.workers_dev ?? true,
    preview_urls: staging.preview_urls ?? generated.preview_urls ?? false,
    vars: { ...(staging.vars ?? {}) },
    d1_databases: databases.map((entry) => ({ ...(generatedDatabase.migrations_dir ? { migrations_dir: generatedDatabase.migrations_dir } : {}), ...entry })),
    r2_buckets: buckets.map((entry) => ({ ...entry })),
  };
}

async function main() {
  const appRoot = resolve(process.argv[2] ?? join(dirname(new URL(import.meta.url).pathname), '..', 'apps', 'recht'));
  const generatedPath = join(appRoot, 'dist', 'server', 'wrangler.json');
  const sourcePath = join(appRoot, 'wrangler.jsonc');
  const [generated, source] = await Promise.all([
    readFile(generatedPath, 'utf8').then((text) => JSON.parse(text)),
    readFile(sourcePath, 'utf8').then(parseJsonc),
  ]);
  const staging = buildStagingConfig(generated, source);
  const outputPath = join(appRoot, 'dist', 'server', 'wrangler.staging.json');
  await writeFile(outputPath, `${JSON.stringify(staging, null, 2)}\n`, 'utf8');
  console.log(`Staging-Konfiguration geschrieben: ${outputPath.replace(`${process.cwd()}/`, '')} (Worker ${staging.name}, D1 ${staging.d1_databases.map((entry) => entry.database_name).join(', ')}, R2 ${staging.r2_buckets.map((entry) => entry.bucket_name).join(', ')})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

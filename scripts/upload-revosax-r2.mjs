#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function encodeObjectKeyPreservingSlashes(key) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function uploadObject({ accountId, apiToken, bucket }, objectKey, bytes, contentType) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodeObjectKeyPreservingSlashes(objectKey)}`;
  const form = new FormData();
  form.append('body', new Blob([bytes], { type: contentType }), basename(objectKey));
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${apiToken}`,
    },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success || payload.errors?.length) {
    throw new Error(`R2 Upload ${objectKey}: ${response.status} ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.result;
}

async function main() {
  const args = process.argv.slice(2);
  const reportPath = resolve(valueAfter(args, '--report') ?? '.cache/revosax-baseline/2023-11-01/report.json');
  const dryRun = args.includes('--dry-run');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const bucket = process.env.OSTRECHT_R2_BUCKET ?? 'ostrecht-recht-quellen';
  if (!dryRun && (!accountId || !apiToken)) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN sind für R2 erforderlich');
  }
  if (report.failed > 0) {
    throw new Error(`Staging-Bericht enthält ${report.failed} Fehler; R2-Archivierung erst nach bereinigtem Import durchführen`);
  }

  const uploaded = [];
  for (const [index, entry] of report.entries.entries()) {
    const sourceId = `${entry.revosaxLawId}${entry.versionSuffix ? `.${entry.versionSuffix}` : ''}`;
    const objectKey = `revosax/${report.baselineDate}/${sourceId}.html`;
    const bytes = await readFile(resolve(entry.rawCacheFile));
    if (bytes.length !== entry.byteLength) throw new Error(`${sourceId}: Cachegröße weicht vom Staging-Bericht ab`);
    let result = { key: objectKey, size: bytes.length, dryRun: true };
    if (!dryRun) result = await uploadObject({ accountId, apiToken, bucket }, objectKey, bytes, 'text/html; charset=utf-8');
    uploaded.push({
      revosaxLawId: entry.revosaxLawId,
      versionSuffix: entry.versionSuffix,
      sourceSha256: entry.sourceSha256,
      bucket,
      objectKey,
      size: Number(result.size ?? bytes.length),
      etag: result.etag ?? null,
    });
    console.log(`[${index + 1}/${report.entries.length}] ${objectKey}${dryRun ? ' geprüft' : ' hochgeladen'}`);
  }

  const manifestPath = reportPath.replace(/report\.json$/u, 'r2-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    bucket,
    generatedAt: new Date().toISOString(),
    dryRun,
    objects: uploaded,
  }, null, 2)}\n`, 'utf8');
  console.log(`${uploaded.length} R2-Objekte; Manifest: ${manifestPath}`);
}

await main();

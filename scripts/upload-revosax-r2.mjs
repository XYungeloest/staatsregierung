#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

/**
 * Archiviert die unveränderten REVOSax-Rohquellen eines Staginglaufs im
 * privaten R2-Bucket und führt das versionierte R2-Manifest
 * data/recht/revosax-r2-manifest.json fort. Das Manifest ist die lokale
 * Provenienzgrundlage für `availability: "r2-archived"`-Quellen: Objekt-
 * schlüssel, SHA-256, Größe, amtliche URL, Abrufzeitpunkt.
 *
 * Objektschlüssel: revosax/<Stichtag>/<lawId>[.<Fassung>].html – exakt die
 * Identität der tatsächlich abgerufenen amtlichen URL.
 *
 * Transport:
 *   --transport api       Cloudflare-REST-API (CLOUDFLARE_API_TOKEN mit R2-Schreibrecht)
 *   --transport wrangler  `wrangler r2 object put` mit der lokalen Wrangler-Anmeldung
 * Ohne Angabe wird die API verwendet, wenn ein Token gesetzt ist, sonst Wrangler.
 *
 * Integrität: Vor dem Upload wird der lokale SHA-256 gegen den Stagingbericht
 * geprüft. Nach dem Upload wird das Objekt erneut gelesen (`--verify`, Standard)
 * und sein SHA-256 verglichen; das Manifest wird nur für hashidentische Objekte
 * fortgeschrieben.
 */

const ROOT = resolve(process.cwd());
const MANIFEST_PATH = join(ROOT, 'data', 'recht', 'revosax-r2-manifest.json');
const DEFAULT_BUCKET = 'ostrecht-recht-quellen';
const DEFAULT_ACCOUNT_ID = '28871b9b1c6753235a331544f7c68460';
const execFileAsync = promisify(execFile);

const USAGE = `Verwendung: node scripts/upload-revosax-r2.mjs [Optionen]

Optionen:
  --report <Pfad>        Stagingbericht (Standard: .cache/revosax-baseline/2023-11-01/report.json)
  --transport <api|wrangler>
  --dry-run              nur prüfen und Manifest-Vorschau schreiben
  --no-verify            Objekte nach dem Upload nicht erneut lesen
  --limit <n>            nur die ersten n archivierbaren Einträge
  --law-id <id>          nur diese lawId (mehrfach möglich)
  --allow-failures       Stagingbericht mit Fehlern zulassen (nur erfolgreiche Einträge)
  --help                 Diese Hilfe`;

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function objectKeyFor(baselineDate, entry) {
  const sourceId = entry.sourceId ?? `${entry.revosaxLawId}${entry.versionSuffix ? `.${entry.versionSuffix}` : ''}`;
  return `revosax/${baselineDate}/${sourceId}.html`;
}

function encodeObjectKey(key) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonIfExists(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function apiTransport({ accountId, apiToken, bucket }) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects/`;
  return {
    name: 'api',
    async put(objectKey, bytes, contentType) {
      const response = await fetch(base + encodeObjectKey(objectKey), {
        method: 'PUT',
        headers: { authorization: `Bearer ${apiToken}`, 'content-type': contentType },
        body: bytes,
      });
      if (!response.ok) {
        const excerpt = (await response.text()).replace(/\s+/gu, ' ').slice(0, 300);
        throw new Error(`R2 PUT ${objectKey}: HTTP ${response.status} ${excerpt}`);
      }
      const payload = await response.json().catch(() => ({}));
      return { etag: payload?.result?.etag ?? response.headers.get('etag') ?? null };
    },
    async get(objectKey) {
      const response = await fetch(base + encodeObjectKey(objectKey), {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      if (!response.ok) throw new Error(`R2 GET ${objectKey}: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

function wranglerTransport({ bucket, cacheDir }) {
  const run = async (args) => {
    const { stdout, stderr } = await execFileAsync('npx', ['wrangler', ...args], {
      cwd: join(ROOT, 'apps', 'recht'),
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
    return `${stdout}\n${stderr}`;
  };
  return {
    name: 'wrangler',
    async put(objectKey, bytes, contentType) {
      const localPath = resolve(cacheDir, 'raw', basename(objectKey));
      const output = await run(['r2', 'object', 'put', `${bucket}/${objectKey}`, '--file', localPath, '--content-type', contentType, '--remote']);
      if (!/Upload complete|Creating object/u.test(output)) throw new Error(`wrangler r2 object put ${objectKey}: ${output.trim().slice(-300)}`);
      return { etag: null };
    },
    async get(objectKey) {
      const downloadPath = resolve(cacheDir, 'r2-verify', basename(objectKey));
      await mkdir(dirname(downloadPath), { recursive: true });
      await run(['r2', 'object', 'get', `${bucket}/${objectKey}`, '--file', downloadPath, '--remote']);
      return readFile(downloadPath);
    },
  };
}

function sortManifest(manifest) {
  return {
    ...manifest,
    objects: Object.fromEntries(Object.entries(manifest.objects).sort(([left], [right]) => left.localeCompare(right))),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const reportPath = resolve(valueAfter(args, '--report') ?? '.cache/revosax-baseline/2023-11-01/report.json');
  const dryRun = args.includes('--dry-run');
  const verify = !args.includes('--no-verify');
  const allowFailures = args.includes('--allow-failures');
  const limit = valueAfter(args, '--limit') ? Number.parseInt(valueAfter(args, '--limit'), 10) : null;
  const lawIds = valuesAfter(args, '--law-id');
  const report = await readJson(reportPath);
  const cacheDir = dirname(reportPath);
  const bucket = process.env.OSTRECHT_R2_BUCKET ?? DEFAULT_BUCKET;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const transportName = valueAfter(args, '--transport') ?? (apiToken ? 'api' : 'wrangler');
  if (!['api', 'wrangler'].includes(transportName)) throw new Error(`Unbekannter Transport ${transportName}`);
  if (!dryRun && transportName === 'api' && !apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN mit R2-Schreibrecht ist für --transport api erforderlich');
  }
  if (report.failed > 0 && !allowFailures) {
    throw new Error(`Staging-Bericht enthält ${report.failed} Fehler; R2-Archivierung erst nach bereinigtem Import durchführen`);
  }
  if (!report.baselineDate) throw new Error('Staging-Bericht ohne baselineDate');

  const transport = transportName === 'api'
    ? apiTransport({ accountId, apiToken, bucket })
    : wranglerTransport({ bucket, cacheDir });
  const manifest = (await readJsonIfExists(MANIFEST_PATH)) ?? {
    schemaVersion: 1,
    bucket,
    description: 'Unveränderte amtliche REVOSax-Rohquellen im privaten R2-Quellenarchiv; Provenienzgrundlage für r2-archived-Quellen.',
    objects: {},
  };
  if (manifest.bucket !== bucket) throw new Error(`R2-Manifest gehört zum Bucket ${manifest.bucket}, angefordert ist ${bucket}`);

  let candidates = report.entries.filter((entry) => !entry.skipReason);
  if (lawIds.length > 0) candidates = candidates.filter((entry) => lawIds.includes(String(entry.revosaxLawId)));
  if (limit !== null) candidates = candidates.slice(0, limit);
  if (candidates.length === 0) throw new Error('keine archivierbaren Einträge');

  const results = [];
  let uploaded = 0;
  let unchanged = 0;
  for (const [index, entry] of candidates.entries()) {
    const objectKey = objectKeyFor(report.baselineDate, entry);
    const bytes = await readFile(resolve(ROOT, entry.rawCacheFile));
    const localHash = sha256(bytes);
    if (bytes.length !== entry.byteLength || localHash !== entry.sourceSha256) {
      throw new Error(`${objectKey}: Rohquelle im Cache weicht vom Staging-Bericht ab (Größe/SHA-256)`);
    }
    const existing = manifest.objects[objectKey];
    if (existing && existing.sha256 === localHash && !dryRun) {
      unchanged += 1;
      results.push({ objectKey, status: 'bereits archiviert' });
      console.log(`[${index + 1}/${candidates.length}] ${objectKey}: bereits archiviert`);
      continue;
    }
    if (existing && existing.sha256 !== localHash) {
      throw new Error(`${objectKey}: im R2-Manifest ist bereits ein Objekt mit anderem SHA-256 verzeichnet; Rohquellen werden nie überschrieben`);
    }
    const record = {
      lawId: String(entry.revosaxLawId),
      versionSuffix: entry.versionSuffix ?? null,
      versionNumber: entry.versionNumber ?? null,
      url: entry.sourceUrl,
      canonicalVersionUrl: entry.canonicalVersionUrl ?? null,
      sha256: localHash,
      size: bytes.length,
      mediaType: 'text/html',
      retrievedAt: entry.retrievedAt,
      uploadedAt: null,
      etag: null,
      verified: false,
    };
    if (dryRun) {
      results.push({ objectKey, status: 'geprüft (dry-run)', ...record });
      console.log(`[${index + 1}/${candidates.length}] ${objectKey}: ${bytes.length} Byte geprüft`);
      continue;
    }
    const putResult = await transport.put(objectKey, bytes, 'text/html; charset=utf-8');
    record.uploadedAt = new Date().toISOString();
    record.etag = putResult.etag;
    if (verify) {
      const remote = await transport.get(objectKey);
      const remoteHash = sha256(remote);
      if (remoteHash !== localHash) {
        throw new Error(`${objectKey}: R2-Objekt ist nicht hashidentisch (lokal ${localHash}, R2 ${remoteHash})`);
      }
      record.verified = true;
    }
    manifest.objects[objectKey] = record;
    manifest.updatedAt = record.uploadedAt;
    uploaded += 1;
    results.push({ objectKey, status: 'hochgeladen', ...record });
    console.log(`[${index + 1}/${candidates.length}] ${objectKey}: hochgeladen${record.verified ? ' und verifiziert' : ''}`);
    // Manifest nach jedem Objekt fortschreiben, damit ein Abbruch keinen Fortschritt verliert.
    await writeFile(MANIFEST_PATH, `${JSON.stringify(sortManifest(manifest), null, 2)}\n`, 'utf8');
  }

  const runManifestPath = resolve(cacheDir, 'r2-manifest.json');
  await writeFile(runManifestPath, `${JSON.stringify({
    schemaVersion: 2,
    baselineDate: report.baselineDate,
    bucket,
    transport: transport.name,
    generatedAt: new Date().toISOString(),
    dryRun,
    uploaded,
    unchanged,
    objects: results,
  }, null, 2)}\n`, 'utf8');
  console.log(`${uploaded} Objekte hochgeladen, ${unchanged} bereits archiviert, ${results.length - uploaded - unchanged} nur geprüft. Laufprotokoll: ${runManifestPath}`);
  if (!dryRun) console.log(`R2-Manifest: ${MANIFEST_PATH.replace(`${ROOT}/`, '')}`);
}

await main();

#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { DEFAULT_ACCOUNT_ID, DEFAULT_BUCKET, apiTransport, sha256, wranglerTransport } from './lib/r2-transport.mjs';

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

const USAGE = `Verwendung: node scripts/upload-revosax-r2.mjs [Optionen]

Optionen:
  --report <Pfad>        Stagingbericht (Standard: .cache/revosax-baseline/2023-11-01/report.json)
  --transport <api|wrangler>
  --dry-run              nur prüfen und Manifest-Vorschau schreiben
  --no-verify            Objekte nach dem Upload nicht erneut lesen
  --limit <n>            nur die ersten n archivierbaren Einträge
  --law-id <id>          nur diese lawId (mehrfach möglich)
  --plan <Pfad>          nur Einträge mit Aktion CREATE oder MATCH des Materialisierungsplans
  --envelopes <Pfad>     zusätzlich die nachgeladenen Mantelvorschriften aus der Envelope-Klassifizierung
  --concurrency <n>      parallele Uploads (Standard: 1; Wrangler-Transport verträgt 4–6)
  --allow-failures       Stagingbericht mit Fehlern zulassen (nur erfolgreiche Einträge)
  --help                 Diese Hilfe`;

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
}

export function objectKeyFor(baselineDate, entry) {
  const sourceId = entry.sourceId ?? `${entry.revosaxLawId}${entry.versionSuffix ? `.${entry.versionSuffix}` : ''}`;
  return `revosax/${baselineDate}/${sourceId}.html`;
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
  const planPath = valueAfter(args, '--plan');
  if (planPath) {
    const plan = await readJson(resolve(planPath));
    if (plan.baselineDate !== report.baselineDate) throw new Error('Plan und Stagingbericht gehören zu verschiedenen Stichtagen');
    const wanted = new Set(plan.entries.filter((entry) => ['CREATE', 'MATCH'].includes(entry.action)).map((entry) => entry.sourceId));
    // Mantelvorschriften, aus deren Artikeln neue Normen entstehen, sind ebenfalls Quellen –
    // auch wenn sie selbst geschützt (PROTECT) oder nur Alias sind.
    for (const entry of plan.entries) {
      if (entry.action === 'CREATE' && entry.envelope?.envelopeSourceId && !entry.envelope.envelopeSourceId.startsWith('envelope-')) wanted.add(entry.envelope.envelopeSourceId);
    }
    // Komponentenseiten von Mantelvorschriften tragen im Staging einen skipReason,
    // werden über den Plan (CREATE/MATCH) aber zu eigenen Normen und damit zu Quellen.
    candidates = report.entries.filter((entry) => wanted.has(entry.sourceId) && entry.rawCacheFile && entry.sourceSha256);
  }
  const envelopesPath = valueAfter(args, '--envelopes');
  if (envelopesPath) {
    const envelopes = await readJson(resolve(envelopesPath));
    for (const source of envelopes.fetchedEnvelopes ?? []) {
      candidates.push({
        revosaxLawId: source.lawId,
        versionSuffix: null,
        sourceId: source.sourceId,
        sourceUrl: source.url,
        canonicalVersionUrl: null,
        versionNumber: null,
        retrievedAt: source.retrievedAt,
        sourceSha256: source.sha256,
        byteLength: source.byteLength,
        rawCacheFile: source.rawCacheFile,
      });
    }
  }
  if (lawIds.length > 0) candidates = candidates.filter((entry) => lawIds.includes(String(entry.revosaxLawId)));
  if (limit !== null) candidates = candidates.slice(0, limit);
  if (candidates.length === 0) throw new Error('keine archivierbaren Einträge');
  const concurrency = Math.max(1, Number.parseInt(valueAfter(args, '--concurrency') ?? '1', 10) || 1);

  const results = [];
  let uploaded = 0;
  let unchanged = 0;
  let manifestDirty = false;
  const persistManifest = async () => {
    if (!manifestDirty) return;
    manifestDirty = false;
    await writeFile(MANIFEST_PATH, `${JSON.stringify(sortManifest(manifest), null, 2)}\n`, 'utf8');
  };

  const processEntry = async (entry, index) => {
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
      return;
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
      return;
    }
    const putResult = await transport.put(objectKey, bytes, 'text/html; charset=utf-8', resolve(ROOT, entry.rawCacheFile));
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
    manifestDirty = true;
    uploaded += 1;
    results.push({ objectKey, status: 'hochgeladen', ...record });
    if ((index + 1) % 25 === 0 || index === candidates.length - 1) {
      console.log(`[${index + 1}/${candidates.length}] ${objectKey}: hochgeladen${record.verified ? ' und verifiziert' : ''} (${uploaded} neu, ${unchanged} vorhanden)`);
      // Manifest regelmäßig fortschreiben, damit ein Abbruch keinen Fortschritt verliert.
      await persistManifest();
    }
  };

  let nextIndex = 0;
  let failure = null;
  const worker = async () => {
    while (nextIndex < candidates.length && !failure) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        await processEntry(candidates[index], index);
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()));
  await persistManifest();
  if (failure) throw failure;

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

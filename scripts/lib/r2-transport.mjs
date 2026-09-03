import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

/**
 * R2-Transporte für das unveränderliche Quellenarchiv (Rohquellen und Anlagen).
 *   api       Cloudflare-REST-API mit CLOUDFLARE_API_TOKEN (R2-Schreibrecht)
 *   wrangler  `wrangler r2 object put/get --remote` mit der lokalen Wrangler-Anmeldung
 * Beide liefern put(objectKey, bytes, contentType, localPath) und get(objectKey).
 */

const ROOT = resolve(process.cwd());
export const DEFAULT_BUCKET = 'ostrecht-recht-quellen';
export const DEFAULT_ACCOUNT_ID = '28871b9b1c6753235a331544f7c68460';
const execFileAsync = promisify(execFile);

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function encodeObjectKey(key) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/');
}

export function apiTransport({ accountId, apiToken, bucket }) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects/`;
  return {
    name: 'api',
    async put(objectKey, bytes, contentType, _localPath) {
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

export function wranglerTransport({ bucket, cacheDir }) {
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
    async put(objectKey, bytes, contentType, localPath) {
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


/** Wählt den Transport: API bei gesetztem Token, sonst Wrangler; --transport erzwingt. */
export function createR2Transport({ transportName, bucket = process.env.OSTRECHT_R2_BUCKET ?? DEFAULT_BUCKET, cacheDir }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const name = transportName ?? (apiToken ? 'api' : 'wrangler');
  if (!['api', 'wrangler'].includes(name)) throw new Error(`Unbekannter Transport ${name}`);
  if (name === 'api' && !apiToken) throw new Error('CLOUDFLARE_API_TOKEN mit R2-Schreibrecht ist für --transport api erforderlich');
  return name === 'api' ? apiTransport({ accountId, apiToken, bucket }) : wranglerTransport({ bucket, cacheDir });
}

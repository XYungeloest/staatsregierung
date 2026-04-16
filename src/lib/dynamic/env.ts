import { env } from 'cloudflare:workers';

export interface RuntimeBindingState {
  environment: string;
  hasDatabase: boolean;
  hasMediaBucket: boolean;
}

function isLocalRuntimeHost(hostname?: string): boolean {
  if (!hostname) {
    return false;
  }

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/u.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/u.test(hostname)
  );
}

export function getRuntimeEnvironmentName(url?: URL): string {
  if (url && isLocalRuntimeHost(url.hostname)) {
    return 'local';
  }

  return env.APP_ENV?.trim() || 'production';
}

export function getRuntimeBindingState(url?: URL): RuntimeBindingState {
  return {
    environment: getRuntimeEnvironmentName(url),
    hasDatabase: Boolean(env.DB),
    hasMediaBucket: Boolean(env.MEDIA),
  };
}

export function getDatabase(): D1Database {
  const database = env.DB;

  if (!database) {
    throw new Error(
      `Cloudflare-D1-Binding "DB" ist nicht verfügbar (Umgebung: ${getRuntimeEnvironmentName()}).`,
    );
  }

  return database;
}

export function getMediaBucket(): R2Bucket {
  const bucket = env.MEDIA;

  if (!bucket) {
    throw new Error(
      `Cloudflare-R2-Binding "MEDIA" ist nicht verfügbar (Umgebung: ${getRuntimeEnvironmentName()}).`,
    );
  }

  return bucket;
}

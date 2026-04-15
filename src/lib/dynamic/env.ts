import { env } from 'cloudflare:workers';

export function getDatabase(): D1Database {
  const database = env.DB;

  if (!database) {
    throw new Error('Cloudflare-D1-Binding "DB" ist nicht verfügbar.');
  }

  return database;
}

export function getMediaBucket(): R2Bucket {
  const bucket = env.MEDIA;

  if (!bucket) {
    throw new Error('Cloudflare-R2-Binding "MEDIA" ist nicht verfügbar.');
  }

  return bucket;
}

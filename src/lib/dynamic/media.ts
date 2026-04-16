import { withBase } from '../portal/routes.ts';

export interface StoredMediaReference {
  mediaKey?: string | null;
  mediaUrl?: string | null;
  fallbackUrl?: string | null;
}

function normalizeMediaKey(value: string): string {
  return value
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildMediaPath(mediaKey: string): string {
  return `/media/${normalizeMediaKey(mediaKey)}`;
}

export function buildMediaUrl(mediaKey: string): string {
  return withBase(buildMediaPath(mediaKey));
}

export function resolveStoredMediaUrl(reference: StoredMediaReference): string | undefined {
  const mediaUrl = reference.mediaUrl?.trim();

  if (mediaUrl) {
    return mediaUrl;
  }

  const mediaKey = reference.mediaKey?.trim();
  if (mediaKey) {
    return buildMediaUrl(mediaKey);
  }

  const fallbackUrl = reference.fallbackUrl?.trim();
  return fallbackUrl || undefined;
}

export function decodeMediaKey(rawValue: string | undefined): string {
  if (!rawValue) {
    return '';
  }

  return rawValue
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

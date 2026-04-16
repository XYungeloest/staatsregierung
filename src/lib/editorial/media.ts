function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/gu, '-');
}

export function buildEditorialMediaKey(filename: string): string {
  const cleaned = filename.trim() || 'upload.bin';
  const extensionMatch = cleaned.match(/(\.[a-z0-9]+)$/iu);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? '';
  const basename = extension ? cleaned.slice(0, -extension.length) : cleaned;
  const normalizedBase = sanitizeSegment(basename) || 'medium';
  const datePrefix = new Date().toISOString().slice(0, 10);
  const randomPart = crypto.randomUUID().slice(0, 8);

  return `editorial/${datePrefix}/${normalizedBase}-${randomPart}${extension}`;
}

export function inferMediaTitle(filename: string): string {
  const basename = filename.replace(/\.[^.]+$/u, '');
  const normalized = basename
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized || 'Unbenanntes Medium';
}

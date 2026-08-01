export interface EditorialSecurityEnv {
  APP_ENV: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  EDITORIAL_ORIGIN?: string;
}

export interface EditorialIdentity {
  email: string;
  subject: string;
  expiresAt: number;
}

export class EditorialSecurityError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'EditorialSecurityError';
    this.status = status;
  }
}

interface AccessClaims {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
}

interface JsonWebKeySet {
  keys: JsonWebKey[];
}

const encoder = new TextEncoder();
let cachedKeys: { url: string; expiresAt: number; keys: JsonWebKey[] } | undefined;

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new EditorialSecurityError('Die Access-Sitzung ist ungültig.');
  }
}

function normalizeTeamDomain(value: string): string {
  return value.replace(/^https?:\/\//u, '').replace(/\/$/u, '');
}

async function loadAccessKeys(url: string, fetcher: typeof fetch): Promise<JsonWebKey[]> {
  if (cachedKeys?.url === url && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetcher(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new EditorialSecurityError('Cloudflare Access konnte nicht geprüft werden.', 503);
  const body = await response.json() as JsonWebKeySet;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new EditorialSecurityError('Cloudflare Access lieferte keine Signaturschlüssel.', 503);
  }
  cachedKeys = { url, keys: body.keys, expiresAt: Date.now() + 5 * 60_000 };
  return body.keys;
}

export async function verifyAccessRequest(
  request: Request,
  env: EditorialSecurityEnv,
  fetcher: typeof fetch = fetch,
): Promise<EditorialIdentity> {
  const localMode = env.APP_ENV === 'local' || env.APP_ENV === 'test';
  if (localMode) {
    return { email: 'lokale-redaktion@localhost', subject: 'local-editor', expiresAt: Math.floor(Date.now() / 1000) + 3600 };
  }

  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    throw new EditorialSecurityError('Das Redaktionsstudio ist nicht vollständig durch Cloudflare Access konfiguriert.', 503);
  }
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new EditorialSecurityError('Cloudflare-Access-Identität fehlt.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new EditorialSecurityError('Die Access-Sitzung ist ungültig.');
  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodeJson<AccessClaims>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new EditorialSecurityError('Die Access-Signatur verwendet ein unzulässiges Verfahren.');

  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const expectedIssuer = `https://${teamDomain}`;
  const audience = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== expectedIssuer || !audience.includes(env.CF_ACCESS_AUD)) {
    throw new EditorialSecurityError('Die Access-Sitzung gehört nicht zu dieser Anwendung.');
  }
  if (!claims.exp || claims.exp <= now || (claims.nbf !== undefined && claims.nbf > now + 30)) {
    throw new EditorialSecurityError('Die Access-Sitzung ist abgelaufen oder noch nicht gültig.');
  }

  const keys = await loadAccessKeys(`${expectedIssuer}/cdn-cgi/access/certs`, fetcher);
  const jwk = keys.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) throw new EditorialSecurityError('Für die Access-Sitzung wurde kein Signaturschlüssel gefunden.');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    decodeBase64Url(parts[2]).buffer as ArrayBuffer,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new EditorialSecurityError('Die Access-Signatur ist ungültig.');
  if (!claims.email || !claims.sub) throw new EditorialSecurityError('Die Access-Identität enthält keine eindeutige Person.');
  return { email: claims.email, subject: claims.sub, expiresAt: claims.exp };
}

function parseCookies(header: string | null): Map<string, string> {
  return new Map((header ?? '').split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return [];
    return [[part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]];
  }));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function createCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createCsrfCookie(token: string, local = false): string {
  const name = local ? 'redaktion_csrf' : '__Host-redaktion_csrf';
  return `${name}=${encodeURIComponent(token)}; Path=/; SameSite=Strict${local ? '' : '; Secure'}`;
}

export function validateMutationRequest(
  request: Request,
  env: EditorialSecurityEnv,
  options: { methods?: string[]; maxBytes?: number; contentTypes?: string[] } = {},
): void {
  const methods = options.methods ?? ['POST'];
  if (!methods.includes(request.method)) throw new EditorialSecurityError('Diese HTTP-Methode ist nicht zulässig.', 405);
  const url = new URL(request.url);
  const localMode = env.APP_ENV === 'local' || env.APP_ENV === 'test';
  const expectedOrigin = localMode ? url.origin : env.EDITORIAL_ORIGIN ?? url.origin;
  if (request.headers.get('origin') !== expectedOrigin) {
    throw new EditorialSecurityError('Die Anfrage stammt nicht aus dem Redaktionsstudio.', 403);
  }
  const maxBytes = options.maxBytes ?? 1_000_000;
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > maxBytes) throw new EditorialSecurityError('Die Anfrage ist zu groß.', 413);
  const allowedContentTypes = options.contentTypes ?? ['application/json'];
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim() ?? '';
  if (!allowedContentTypes.includes(contentType)) throw new EditorialSecurityError('Der Inhaltstyp ist nicht zulässig.', 415);
  const cookies = parseCookies(request.headers.get('cookie'));
  const cookieToken = cookies.get('__Host-redaktion_csrf') ?? cookies.get('redaktion_csrf');
  const headerToken = request.headers.get('x-editorial-csrf');
  if (!cookieToken || !headerToken || !constantTimeEqual(cookieToken, headerToken)) {
    throw new EditorialSecurityError('Der CSRF-Schutz konnte nicht bestätigt werden.', 403);
  }
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const mimeExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

function hasPrefix(bytes: Uint8Array, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[index] === byte);
}

export async function validateImageUploadBytes(file: File, altText: string): Promise<{ path: string; bytes: Uint8Array; mediaType: string }> {
  if (!altText.trim()) throw new EditorialSecurityError('Für neue Bilder ist ein Alternativtext erforderlich.', 422);
  const extension = mimeExtensions.get(file.type);
  if (!extension) throw new EditorialSecurityError('Zulässig sind JPEG-, PNG-, WebP- und AVIF-Bilder.', 415);
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new EditorialSecurityError('Das Bild ist leer oder größer als 5 MB.', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatures: Record<string, boolean> = {
    'image/jpeg': hasPrefix(bytes, [0xff, 0xd8, 0xff]),
    'image/png': hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'image/webp': hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP',
    'image/avif': new TextDecoder().decode(bytes.slice(4, 12)).includes('ftypavif') || new TextDecoder().decode(bytes.slice(4, 16)).includes('ftypavis'),
  };
  if (!signatures[file.type]) throw new EditorialSecurityError('Dateiendung und tatsächlicher Bildtyp stimmen nicht überein.', 415);
  const stem = file.name.replace(/\.[^.]+$/u, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 80) || 'bild';
  return { path: `public/images/editorial/${stem}.${extension}`, bytes, mediaType: file.type };
}

export function securityHeaders(): HeadersInit {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
}

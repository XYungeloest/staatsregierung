import { env } from 'cloudflare:workers';
import { getRuntimeEnvironmentName } from '../dynamic/env.ts';
import { withBase } from '../portal/routes.ts';
import { isLocalEditorialHost } from './access.ts';

const EDITORIAL_SESSION_COOKIE = 'editorial_session';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 4;
const encoder = new TextEncoder();

interface EditorialSessionPayload {
  v: 1;
  exp: number;
  aud: string;
  env: string;
  email?: string;
}

export interface EditorialCookieState {
  active: boolean;
  reason:
    | 'valid'
    | 'missing'
    | 'invalid'
    | 'expired'
    | 'wrong_host'
    | 'wrong_env'
    | 'missing_secret';
  payload?: EditorialSessionPayload;
}

function getSessionSecret(url?: URL): string | undefined {
  const configuredSecret = env.EDITORIAL_SESSION_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (url && isLocalEditorialHost(url.hostname)) {
    return 'local-editorial-session-secret';
  }

  return undefined;
}

function getSessionTtlSeconds(): number {
  const configured = Number.parseInt(env.EDITORIAL_SESSION_TTL_SECONDS ?? '', 10);

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_SESSION_TTL_SECONDS;
}

function readCookieValue(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');

    if (rawName === name) {
      return rawValue.join('=');
    }
  }

  return undefined;
}

function toBase64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/gu, '+').replace(/_/gu, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function createSignature(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function buildCookieAttributes(url: URL, maxAge: number): string {
  const attributes = [
    `Path=/`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (!isLocalEditorialHost(url.hostname)) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function getEditorialSessionBootstrapHref(returnTo: string): string {
  const search = new URLSearchParams({ returnTo });
  return withBase(`/redaktion/session?${search.toString()}`);
}

export function getEditorialSessionLogoutHref(returnTo: string): string {
  const search = new URLSearchParams({ returnTo, mode: 'logout' });
  return withBase(`/redaktion/session?${search.toString()}`);
}

export async function createEditorialSessionCookie(
  url: URL,
  options: {
    email?: string;
  },
): Promise<string> {
  const secret = getSessionSecret(url);

  if (!secret) {
    throw new Error(
      `EDITORIAL_SESSION_SECRET fehlt für die Umgebung ${getRuntimeEnvironmentName(url)}.`,
    );
  }

  const ttl = getSessionTtlSeconds();
  const payload: EditorialSessionPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + ttl,
    aud: url.hostname,
    env: getRuntimeEnvironmentName(url),
    email: options.email,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await createSignature(encodedPayload, secret);
  const value = `${encodedPayload}.${signature}`;

  return `${EDITORIAL_SESSION_COOKIE}=${value}; ${buildCookieAttributes(url, ttl)}`;
}

export function createClearedEditorialSessionCookie(url: URL): string {
  return `${EDITORIAL_SESSION_COOKIE}=; ${buildCookieAttributes(url, 0)}`;
}

export async function readEditorialSessionCookie(
  request: Request,
  url: URL,
): Promise<EditorialCookieState> {
  const cookieValue = readCookieValue(request, EDITORIAL_SESSION_COOKIE);

  if (!cookieValue) {
    return {
      active: false,
      reason: 'missing',
    };
  }

  const secret = getSessionSecret(url);

  if (!secret) {
    return {
      active: false,
      reason: 'missing_secret',
    };
  }

  const [encodedPayload, providedSignature] = cookieValue.split('.');

  if (!encodedPayload || !providedSignature) {
    return {
      active: false,
      reason: 'invalid',
    };
  }

  const expectedSignature = await createSignature(encodedPayload, secret);

  if (expectedSignature !== providedSignature) {
    return {
      active: false,
      reason: 'invalid',
    };
  }

  let payload: EditorialSessionPayload | undefined;

  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as EditorialSessionPayload;
  } catch {
    return {
      active: false,
      reason: 'invalid',
    };
  }

  if (!payload || payload.v !== 1) {
    return {
      active: false,
      reason: 'invalid',
    };
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return {
      active: false,
      reason: 'expired',
      payload,
    };
  }

  if (payload.aud !== url.hostname) {
    return {
      active: false,
      reason: 'wrong_host',
      payload,
    };
  }

  if (payload.env !== getRuntimeEnvironmentName(url)) {
    return {
      active: false,
      reason: 'wrong_env',
      payload,
    };
  }

  return {
    active: true,
    reason: 'valid',
    payload,
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCsrfCookie,
  createCsrfToken,
  EditorialSecurityError,
  MAX_UPLOAD_BYTES,
  validateImageUploadBytes,
  validateMutationRequest,
  verifyAccessRequest,
} from '../apps/redaktion/src/security.ts';

test('eine frei gesetzte E-Mail ersetzt keine Cloudflare-Access-Identität', async () => {
  const request = new Request('https://redaktion.example/redaktion/', {
    headers: { 'cf-access-authenticated-user-email': 'angreifer@example.test' },
  });
  await assert.rejects(
    () => verifyAccessRequest(request, { APP_ENV: 'production', CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', CF_ACCESS_AUD: 'audience' }),
    (error: unknown) => error instanceof EditorialSecurityError && error.status === 401,
  );
});

test('Produktion schließt bei fehlender Access-Konfiguration sicher', async () => {
  await assert.rejects(
    () => verifyAccessRequest(new Request('https://redaktion.example/redaktion/'), { APP_ENV: 'production' }),
    (error: unknown) => error instanceof EditorialSecurityError && error.status === 503,
  );
});

test('Methoden-, Origin- und CSRF-Prüfung schützen Schreibzugriffe', () => {
  const token = createCsrfToken();
  assert.equal(token.length, 64);
  assert.match(createCsrfCookie(token), /SameSite=Strict; Secure/u);
  const valid = new Request('https://redaktion.example/redaktion/api/preview', {
    method: 'POST',
    headers: {
      origin: 'https://redaktion.example',
      'content-type': 'application/json',
      cookie: `__Host-redaktion_csrf=${token}`,
      'x-editorial-csrf': token,
    },
    body: '{}',
  });
  assert.doesNotThrow(() => validateMutationRequest(valid, { APP_ENV: 'production' }));

  const wrongMethod = new Request('https://redaktion.example/redaktion/api/preview', { method: 'PUT', headers: { origin: 'https://redaktion.example', 'content-type': 'application/json' } });
  assert.throws(() => validateMutationRequest(wrongMethod, { APP_ENV: 'production' }), (error: unknown) => error instanceof EditorialSecurityError && error.status === 405);
  const wrongOrigin = new Request('https://redaktion.example/redaktion/api/preview', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json', cookie: `__Host-redaktion_csrf=${token}`, 'x-editorial-csrf': token }, body: '{}' });
  assert.throws(() => validateMutationRequest(wrongOrigin, { APP_ENV: 'production' }), (error: unknown) => error instanceof EditorialSecurityError && error.status === 403);
  const missingCsrf = new Request('https://redaktion.example/redaktion/api/preview', { method: 'POST', headers: { origin: 'https://redaktion.example', 'content-type': 'application/json' }, body: '{}' });
  assert.throws(() => validateMutationRequest(missingCsrf, { APP_ENV: 'production' }), (error: unknown) => error instanceof EditorialSecurityError && error.status === 403);
});

test('Uploads prüfen Alternativtext, Typ, Signatur und Größe', async () => {
  const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], 'Mein Bild.JPG', { type: 'image/jpeg' });
  const result = await validateImageUploadBytes(jpeg, 'Sachlicher Alternativtext');
  assert.equal(result.path, 'public/images/editorial/mein-bild.jpg');
  await assert.rejects(() => validateImageUploadBytes(jpeg, ''), /Alternativtext/u);
  await assert.rejects(() => validateImageUploadBytes(new File(['Text'], 'bild.svg', { type: 'image/svg+xml' }), 'Alt'), (error: unknown) => error instanceof EditorialSecurityError && error.status === 415);
  await assert.rejects(() => validateImageUploadBytes(new File(['kein jpeg'], 'bild.jpg', { type: 'image/jpeg' }), 'Alt'), /tatsächlicher Bildtyp/u);
  const tooLarge = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'gross.png', { type: 'image/png' });
  await assert.rejects(() => validateImageUploadBytes(tooLarge, 'Alt'), (error: unknown) => error instanceof EditorialSecurityError && error.status === 413);
});

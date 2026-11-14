import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { hasReviewAccess, loadReview, getReviewImage, createReviewImage, reviewImageKey } from '../apps/portal/src/lib/fresswuerfel/review.ts';
import { purgeExpired } from '../apps/portal/src/lib/fresswuerfel/retention.ts';
import type { CampaignEnv } from '../apps/portal/src/lib/fresswuerfel/server.ts';

const token = 'test-sichtungslink-0000000000000000000000000000000000000000';
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../data/fresswuerfel/schema.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../data/fresswuerfel/002-skizzen.sql', import.meta.url), 'utf8'));
  const statement = (query: string, values: any[] = []): any => ({
    bind: (...args: any[]) => statement(query, args),
    first: async () => sql.prepare(query).get(...values) ?? null,
    all: async () => ({ results: sql.prepare(query).all(...values) }),
    run: async () => { sql.prepare(query).run(...values); return { success: true }; },
    execute: () => sql.prepare(query).run(...values),
  });
  const objects = new Map<string, Uint8Array>();
  const env: CampaignEnv = {
    FRESSWUERFEL_REVIEW_TOKEN: token,
    FRESSWUERFEL_DB: { prepare: statement, batch: async statements => statements.map((s: any) => { s.execute(); return { success: true }; }) },
    FRESSWUERFEL_SKETCHES: {
      get: async key => { const bytes = objects.get(key); if (!bytes) return null; return { body: new Blob([new Uint8Array(bytes)]).stream(), arrayBuffer: async () => new Uint8Array(bytes).buffer }; },
      put: async (key, bytes) => { objects.set(key, bytes); },
      delete: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
    },
  };
  function seed(name = 'Würfelchen', image = true, expiry = Date.now() + 86400000) {
    const id = crypto.randomUUID(); const number = `FW-${id}`;
    sql.prepare('INSERT INTO submissions (request_id, request_hash, number, name, description, email, created_at, expires_at, sketch_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, 'PRIVATE-HASH', number, name, 'Eine eigenständige Figur mit Würfelhut.', 'kontakt-bleibt-intern@example.org', Date.now(), expiry, image ? `originals/${id}` : null);
    return number;
  }
  return { env, sql, objects, seed };
}
test('Freigabelink ist zwingend, auch für Bilder; fehlende und falsche Tokens fragen keine Daten ab', async () => {
  const { env } = fixture();
  for (const value of [undefined, '', 'kurz', 'x'.repeat(token.length)]) assert.equal(hasReviewAccess(value, env), false);
  assert.equal(hasReviewAccess(token, { ...env, APP_ENV: 'preview' }), false);
  assert.equal(hasReviewAccess(token, {}), false); assert.equal(hasReviewAccess(token, env), true);
  env.FRESSWUERFEL_DB!.prepare = () => { throw new Error('Darf bei fehlender Freigabe nicht abgefragt werden'); };
  const result = await getReviewImage(new Request('https://example.org/bild.webp'), 'x'.repeat(token.length), `FW-${crypto.randomUUID()}`, env);
  assert.equal(result.status, 404); assert.match(result.headers.get('X-Robots-Tag')!, /noindex/);
});
test('Übersicht enthält nur Anzeigefelder, sortiert und paginiert; abgelaufene Daten bleiben unsichtbar', async () => {
  const { env, seed } = fixture();
  for (let i = 0; i < 25; i++) seed(`Figur ${String(i).padStart(2, '0')}`, i % 2 === 0);
  seed('ABGELAUFEN', true, 1);
  const result = await loadReview(env, new URL('https://example.org/?sort=name&seite=1'));
  assert.equal(result.total, 25); assert.equal(result.withImages, 13); assert.equal(result.pages, 2); assert.equal(result.entries.length, 24); assert.equal(result.entries[0].name, 'Figur 00');
  assert.deepEqual(Object.keys(result.entries[0]).sort(), ['created_at', 'description', 'has_image', 'name', 'number']);
  assert.ok(!JSON.stringify(result).includes('kontakt-bleibt-intern')); assert.ok(!JSON.stringify(result).includes('originals/')); assert.ok(!JSON.stringify(result).includes('ABGELAUFEN'));
  const second = await loadReview(env, new URL('https://example.org/?sort=name&seite=999'));
  assert.equal(second.page, 2); assert.equal(second.entries.length, 1);
  assert.equal((await loadReview(env, new URL('https://example.org/?sort=beliebiges-SQL&seite=NaN'))).sort, 'neu');
});
test('PNG, JPEG und WebP werden metadatenfrei als WebP angezeigt; EXIF-Ausrichtung bleibt erhalten', async () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const original = await sharp({ create: { width: 40, height: 20, channels: 3, background: 'yellow' } }).withMetadata({ exif: { IFD0: { Artist: 'PRIVATE-EXIF' } } }).toFormat(format).toBuffer();
    const image = await createReviewImage(original);
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 40); assert.equal(metadata.height, 20); assert.equal(metadata.exif, undefined); assert.equal(metadata.xmp, undefined); assert.equal(metadata.icc, undefined);
  }
  const portrait = await sharp({ create: { width: 40, height: 20, channels: 3, background: 'red' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const rotated = await sharp(await createReviewImage(portrait)).metadata();
  assert.equal(rotated.width, 20); assert.equal(rotated.height, 40);
});
test('Bildzugriff prüft Einreichung und Ablauf auch bei vorhandener Vorschau; Löschung umfasst Vorschau und Original', async () => {
  const { env, seed, objects, sql } = fixture();
  const number = seed();
  const key = sql.prepare('SELECT sketch_key FROM submissions WHERE number = ?').get(number)!.sketch_key as string;
  objects.set(key, await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).png().toBuffer());
  const request = new Request('https://example.org/bild.webp');
  const response = await getReviewImage(request, token, number, env);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/webp'); assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer'); assert.match(response.headers.get('Cache-Control')!, /no-store/);
  assert.ok(objects.has(reviewImageKey(number)));
  assert.equal((await getReviewImage(request, token, `FW-${crypto.randomUUID()}`, env)).status, 404);
  sql.exec('UPDATE submissions SET expires_at = 1');
  assert.equal((await getReviewImage(request, token, number, env)).status, 404);
  await purgeExpired(env.FRESSWUERFEL_DB!, env.FRESSWUERFEL_SKETCHES!);
  assert.equal(objects.size, 0);
});

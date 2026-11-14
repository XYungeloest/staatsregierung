import sharp from 'sharp';
import { purgeExpired } from '../apps/portal/src/lib/fresswuerfel/retention.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { submitIdea, runtimeCampaign, type CampaignEnv, type CampaignDB } from '../apps/portal/src/lib/fresswuerfel/server.ts';
import { campaign, isSubmissionPhase, showTeaser, validateCampaign, formatCampaignDate } from '../apps/portal/src/lib/fresswuerfel/config.ts';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../data/fresswuerfel/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../data/fresswuerfel/002-skizzen.sql', import.meta.url), 'utf8'));
  function statement(sql: string, values: unknown[] = []): any {
    return { bind: (...args: unknown[]) => statement(sql, args), first: async () => db.prepare(sql).get(...values as any[]) ?? null, all: async () => ({ results: db.prepare(sql).all(...values as any[]) }), run: async () => { db.prepare(sql).run(...values as any[]); return { success: true }; }, execute: () => db.prepare(sql).run(...values as any[]) };
  }
  const adapter = { prepare: statement, batch: async (statements: any[]) => {
    db.exec('BEGIN');
    try { const results = statements.map(s => { s.execute(); return { success: true }; }); db.exec('COMMIT'); return results; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  } } as CampaignDB;
  const env: CampaignEnv = { APP_ENV: 'local', FRESSWUERFEL_DB: adapter, FRESSWUERFEL_ENABLED: 'true', FRESSWUERFEL_RATE_SALT: 'a'.repeat(32), FRESSWUERFEL_PREVIEW_PHASE: 'einreichung' };
  const objects = new Map<string, Uint8Array>();
  env.FRESSWUERFEL_UPLOADS_ENABLED = 'true';
  env.FRESSWUERFEL_SKETCHES = { put: async (key, bytes) => { objects.set(key, bytes); }, delete: async key => { for (const k of Array.isArray(key) ? key : [key]) objects.delete(k); } };
  return { db, env, objects };
}
const idea = () => ({ requestId: crypto.randomUUID(), name: 'Probe', description: 'Eine frei erfundene Figur mit einem würfelförmigen Hut.', email: 'intern@example.org', consent: true, website: '' });
const request = (body: unknown, origin = 'https://portal.example') => new Request('https://portal.example/api/fresswuerfel/einreichungen', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });

test('Speicherung, Idempotenz, getrennte öffentliche Antwort und Konflikt', async () => {
  const { db, env } = fixture(); const body = idea();
  const response = await submitIdea(request(body), env);
  assert.equal(response.status, 201);
  const payload = await response.json(); assert.deepEqual(Object.keys(payload), ['number']); assert.match(payload.number, /^FW-/);
  assert.equal((await (await submitIdea(request(body), env)).json()).number, payload.number);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 1);
  assert.equal(db.prepare('SELECT email FROM submissions').get()!.email, body.email);
  assert.equal((await submitIdea(request({ ...body, description: 'Eine abweichende Idee mit genug Beschreibung.' }), env)).status, 409);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('Validierung, geschlossene Phase, fehlende Anbindung, Origin und Upload-Ablehnung', async () => {
  const { db, env } = fixture();
  for (const body of [{ ...idea(), description: 'kurz' }, { ...idea(), email: 'falsch' }, { ...idea(), consent: false }, { ...idea(), sketch: 'private.png' }, { ...idea(), description: 42 }, { ...idea(), requestId: 'kaputt' }]) assert.equal((await submitIdea(request(body), env)).status, 422);
  assert.equal((await submitIdea(request(idea(), 'https://fremd.example'), env)).status, 403);
  for (const phase of ['vorbereitet', 'sichtung', 'ergebnis']) assert.equal((await submitIdea(request(idea()), { ...env, FRESSWUERFEL_PREVIEW_PHASE: phase })).status, 409);
  assert.equal((await submitIdea(request(idea()), { ...env, FRESSWUERFEL_DB: undefined })).status, 503);
  assert.equal((await submitIdea(request(idea()), { ...env, FRESSWUERFEL_ENABLED: undefined })).status, 503);
  assert.equal((await submitIdea(request({ ...idea(), description: 'x'.repeat(25000) }), env)).status, 413);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 0);
});
test('Rate-Limit lässt fünf Ideen zu und speichert die sechste nicht', async () => {
  const { db, env } = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await submitIdea(request(idea()), env)).status, 201);
  assert.equal((await submitIdea(request(idea()), env)).status, 429);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 5);
});
test('Speicherfehler darf keinen Erfolg melden', async () => {
  const { env } = fixture();
  env.FRESSWUERFEL_DB = { prepare() { throw new Error('offline'); } } as any;
  assert.equal((await submitIdea(request(idea()), env)).status, 503);
});
test('Phasen, Terminränder, Freigaben und Vorschau bleiben getrennt', () => {
  const c = { ...campaign, phase: 'einreichung' as const, startsAt: '2026-11-14T10:00:00+01:00', endsAt: '2026-11-15T10:00:00+01:00', teaserFrom: '2026-11-14T10:00:00+01:00', teaserUntil: '2026-11-15T10:00:00+01:00' };
  assert.equal(isSubmissionPhase(c, Date.parse(c.startsAt) - 1), false); assert.equal(isSubmissionPhase(c, Date.parse(c.startsAt)), true); assert.equal(isSubmissionPhase(c, Date.parse(c.endsAt)), false);
  assert.equal(showTeaser(c, Date.parse(c.startsAt)), true); assert.equal(showTeaser({ ...campaign, phase: 'vorbereitet' }, Date.now()), false);
  assert.match(formatCampaignDate('2026-07-01T10:00:00Z'), /12:00/);
  assert.equal(runtimeCampaign({ APP_ENV: 'production', FRESSWUERFEL_PREVIEW_PHASE: 'ergebnis' }).phase, campaign.phase);
  assert.equal(runtimeCampaign({ APP_ENV: 'local', FRESSWUERFEL_PREVIEW_PHASE: 'ergebnis' }).result!.title, 'Lokales Prüfergebnis');
  assert.throws(() => validateCampaign({ ...campaign, phase: 'abstimmung' }));
  assert.throws(() => validateCampaign({ ...campaign, candidates: [{ slug: 'privat', title: 'Test', description: 'Test', email: 'privat@example.org' }] }));
});

test('Gleichzeitige identische Anfragen speichern nur einmal; Multipart wird abgelehnt', async () => {
  const { db, env } = fixture(); const body = idea();
  const responses = await Promise.all([submitIdea(request(body), env), submitIdea(request(body), env)]);
  const numbers = await Promise.all(responses.map(async r => { assert.ok(r.ok); return (await r.json()).number; }));
  assert.equal(numbers[0], numbers[1]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 1);
  const upload = new Request('https://portal.example/api/fresswuerfel/einreichungen', { method: 'POST', headers: { Origin: 'https://portal.example', 'Content-Type': 'multipart/form-data; boundary=x' }, body: 'x' });
  assert.equal((await submitIdea(upload, env)).status, 400);
});

function imageRequest(bytes: Uint8Array, mime: string, requestId = crypto.randomUUID()) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...idea(), requestId, consent: 'on' })) data.set(key, String(value));
  data.set('sketch', new File([new Uint8Array(bytes)], 'bild', { type: mime }));
  return new Request('https://portal.example/api/fresswuerfel/einreichungen', { method: 'POST', headers: { Origin: 'https://portal.example' }, body: data });
}
test('JPEG, PNG und WebP werden tatsächlich decodiert und bleiben privat; Wiederholung speichert nur einmal', async () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const { db, env, objects } = fixture();
    const bytes = await sharp({ create: { width: 12, height: 10, channels: 3, background: 'yellow' } }).toFormat(format).toBuffer();
    const id = crypto.randomUUID();
    const response = await submitIdea(imageRequest(bytes, `image/${format}`, id), env);
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    const payload = await response.json(); assert.deepEqual(Object.keys(payload), ['number']);
    assert.equal(objects.size, 1); assert.equal(db.prepare('SELECT sketch_size FROM submissions').get()!.sketch_size, bytes.length);
    assert.equal((await (await submitIdea(imageRequest(bytes, `image/${format}`, id), env)).json()).number, payload.number);
    assert.equal(objects.size, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 1);
  }
});
test('Defekte, falsch deklarierte, übergroße Bilder und fehlender Privatspeicher werden abgelehnt', async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
  const huge = await sharp({ create: { width: 4096, height: 4096, channels: 3, background: 'red' } }).png().toBuffer();
  for (const [bytes, mime] of [[png, 'image/jpeg'], [Buffer.from('<svg></svg>'), 'image/png'], [png.subarray(0, 40), 'image/png'], [huge, 'image/png'], [new Uint8Array(5 * 1024 * 1024 + 1), 'image/png']] as const) {
    const { db, env, objects } = fixture();
    assert.equal((await submitIdea(imageRequest(bytes, mime), env)).status, 422);
    assert.equal(objects.size, 0); assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 0);
  }
  const { env } = fixture(); env.FRESSWUERFEL_SKETCHES = undefined;
  assert.equal((await submitIdea(imageRequest(png, 'image/png'), env)).status, 422);
});
test('R2-Fehler bestätigt keine Einreichung; tägliche Löschung entfernt Original und Kontaktdaten', async () => {
  const { db, env, objects } = fixture();
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  const originalStore = env.FRESSWUERFEL_SKETCHES!;
  env.FRESSWUERFEL_SKETCHES = { ...originalStore, put: async () => { throw new Error('R2 offline'); } };
  assert.equal((await submitIdea(imageRequest(bytes, 'image/png'), env)).status, 503);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 0);
  env.FRESSWUERFEL_SKETCHES = originalStore;
  assert.equal((await submitIdea(imageRequest(bytes, 'image/png'), env)).status, 201);
  assert.equal(objects.size, 1);
  db.exec('UPDATE submissions SET expires_at = 1');
  assert.equal(await purgeExpired(env.FRESSWUERFEL_DB!, originalStore), 1);
  assert.equal(objects.size, 0); assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get()!.n, 0);
});

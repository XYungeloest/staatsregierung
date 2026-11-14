import { campaign, validateCampaign, isSubmissionPhase, type Campaign, type Phase } from './config.ts';
import { MAX_SKETCH_BYTES, validateSketch } from './images.ts';

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}
export interface CampaignDB {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Array<{ success: boolean }>>;
}
export interface PrivateSketches {
  put(key: string, value: Uint8Array, options?: object): Promise<unknown>;
  delete(key: string | string[]): Promise<void>;
}
export interface CampaignEnv {
  APP_ENV?: string;
  FRESSWUERFEL_DB?: CampaignDB;
  FRESSWUERFEL_SKETCHES?: PrivateSketches;
  FRESSWUERFEL_UPLOADS_ENABLED?: string;
  FRESSWUERFEL_ENABLED?: string;
  FRESSWUERFEL_RATE_SALT?: string;
  FRESSWUERFEL_PREVIEW_PHASE?: string;
  FRESSWUERFEL_PREVIEW_PUBLIC_JSON?: string;
}
export async function getCampaignEnv(): Promise<CampaignEnv> {
  try { return (await import(/* @vite-ignore */ 'cloudflare:workers')).env as CampaignEnv; }
  catch { return {}; }
}
export function runtimeCampaign(env: CampaignEnv): Campaign {
  if (env.APP_ENV !== 'local' || !env.FRESSWUERFEL_PREVIEW_PHASE) return campaign;
  const phase = env.FRESSWUERFEL_PREVIEW_PHASE as Phase;
  if (!['vorbereitet', 'einreichung', 'sichtung', 'ergebnis'].includes(phase)) return campaign;
  const approved = env.FRESSWUERFEL_PREVIEW_PUBLIC_JSON ? validateCampaign(JSON.parse(env.FRESSWUERFEL_PREVIEW_PUBLIC_JSON)) : null;
  return { ...campaign, phase, startsAt: null, endsAt: null, privacyContact: 'Lokale Vorschau – keine echten Kontaktdaten einreichen.', retentionDays: 90,
    candidates: phase === 'sichtung' ? approved?.candidates ?? [{ slug: 'lokale-probe', title: 'Lokale Probekandidatur', description: 'Ausschließlich synthetische Testdaten zur Prüfung der Freigabeansicht.' }] : [],
    result: phase === 'ergebnis' ? { title: 'Lokales Prüfergebnis', description: 'Ausschließlich synthetische Testdaten zur Prüfung der Ergebnisansicht.' } : null };
}
export function isConnected(env: CampaignEnv, c: Campaign): boolean {
  return env.FRESSWUERFEL_ENABLED === 'true' && Boolean(env.FRESSWUERFEL_DB && env.FRESSWUERFEL_RATE_SALT && env.FRESSWUERFEL_RATE_SALT.length >= 32 && c.privacyContact && c.retentionDays);
}
export function uploadsConnected(env: CampaignEnv): boolean {
  return env.FRESSWUERFEL_UPLOADS_ENABLED === 'true' && Boolean(env.FRESSWUERFEL_SKETCHES);
}
export function reply(status: number, body: object): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
async function digest(value: string | Uint8Array) {
  const bytes = await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
interface Saved { number: string; request_hash: string; sketch_key: string | null }
export async function submitIdea(request: Request, env: CampaignEnv, now = Date.now()): Promise<Response> {
  const c = runtimeCampaign(env);
  if (!isSubmissionPhase(c, now)) return reply(409, { error: 'Die Einreichungsphase ist derzeit geschlossen.' });
  if (!isConnected(env, c)) return reply(503, { error: 'Die Einreichung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.' });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply(403, { error: 'Bitte reichen Sie Ihre Idee über diese Portalseite ein.' });
  const contentType = request.headers.get('Content-Type') ?? '';
  const multipart = contentType.startsWith('multipart/form-data;');
  if (!multipart && !contentType.startsWith('application/json')) return reply(415, { error: 'Bitte verwenden Sie das Einreichungsformular.' });
  const limit = multipart ? MAX_SKETCH_BYTES + 24000 : 24000;
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { error: 'Die Beschreibung fehlt.' });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return reply(413, { error: multipart ? 'Bitte wählen Sie ein Bild bis 5 MB aus und kürzen Sie gegebenenfalls den Text.' : 'Die Einreichung ist zu lang. Bitte kürzen Sie den Text.' }); }
      chunks.push(value);
    }
  } catch { return reply(400, { error: 'Die Übertragung wurde unterbrochen. Bitte versuchen Sie es erneut.' }); }
  let data: Record<string, unknown>;
  let file: File | null = null;
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (multipart) {
      const form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
      data = {};
      const seen = new Set<string>();
      for (const [key, value] of form.entries()) {
        if (seen.has(key)) throw new Error();
        seen.add(key);
        if (key === 'sketch') {
          if (value === '') continue; // workerd liefert bei nicht gewähltem Bild einen leeren String.
          if (typeof value === 'string') throw new Error();
          if (value.size) file = value;
        } else {
          if (typeof value !== 'string') throw new Error();
          data[key] = value;
        }
      }
      data.consent = data.consent === 'on';
    } else {
      data = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    }
  } catch { return reply(400, { error: 'Die Einreichung konnte nicht gelesen werden.' }); }
  const errors: Record<string, string> = {};
  const read = (key: string, max: number) => {
    if (data[key] !== undefined && typeof data[key] !== 'string') { errors[key] = 'Bitte geben Sie Text ein.'; return ''; }
    const value = String(data[key] ?? '').trim();
    if (value.length > max) errors[key] = `Bitte höchstens ${max} Zeichen eingeben.`;
    return value;
  };
  const name = read('name', 100), description = read('description', 4000), email = read('email', 254);
  if (description.length < 20) errors.description = 'Bitte beschreiben Sie Ihre Idee mit mindestens 20 Zeichen.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Bitte geben Sie eine gültige E-Mail-Adresse ein oder lassen Sie das Feld frei.';
  if (data.consent !== true) errors.consent = 'Bitte bestätigen Sie die Teilnahmehinweise.';
  if (Object.keys(data).some(k => !['name', 'description', 'email', 'consent', 'requestId', 'website'].includes(k))) errors.description = 'Die Einreichung enthält unbekannte Angaben. Bitte verwenden Sie das Formular.';
  if (typeof data.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) errors.requestId = 'Bitte laden Sie die Seite neu und versuchen Sie es erneut.';
  if (file && !uploadsConnected(env)) errors.sketch = 'Bilder können derzeit nicht angenommen werden. Bitte reichen Sie Ihre Idee in Worten ein.';
  if (file && file.size > MAX_SKETCH_BYTES) errors.sketch = 'Bitte wählen Sie ein Bild bis 5 MB aus.';
  if (data.website) return reply(400, { error: 'Die Einreichung konnte nicht angenommen werden.' });
  if (Object.keys(errors).length) return reply(422, { error: 'Bitte prüfen Sie Ihre Angaben.', errors });
  const db = env.FRESSWUERFEL_DB!;
  const fileBytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
  const hash = await digest(JSON.stringify([name, description, email, fileBytes ? await digest(fileBytes) : null]));
  try {
    const existing = await db.prepare('SELECT number, request_hash, sketch_key FROM submissions WHERE request_id = ? AND expires_at > ?').bind(data.requestId, now).first<Saved>();
    if (existing) return existing.request_hash === hash ? reply(200, { number: existing.number }) : reply(409, { error: 'Diese Anfrage wurde bereits mit anderen Angaben gespeichert. Bitte laden Sie die Seite für eine neue Idee neu.' });
    const ip = env.APP_ENV === 'local' ? 'local' : request.headers.get('CF-Connecting-IP');
    if (!ip) return reply(503, { error: 'Die Einreichung ist derzeit nicht verfügbar.' });
    const bucket = `${Math.floor(now / 3600000)}:${await digest(`${env.FRESSWUERFEL_RATE_SALT}:${ip}`)}`;
    const rate = await db.prepare('INSERT INTO rate_limits (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count').bind(bucket, now + 86400000).first<{ count: number }>();
    if (!rate || rate.count > 5) return reply(429, { error: 'Zu viele Einreichungen. Bitte versuchen Sie es in einer Stunde erneut.' });
    let mime: string | null = null;
    if (fileBytes) {
      try { mime = await validateSketch(fileBytes, file!.type); }
      catch (error) { return reply(422, { error: 'Bitte prüfen Sie Ihre Skizze.', errors: { sketch: error instanceof Error ? error.message : 'Das Bild konnte nicht gelesen werden.' } }); }
    }
    const number = `FW-${crypto.randomUUID()}`;
    // Eigener Schlüssel pro Speicherversuch: parallele Wiederholungen überschreiben sich nicht.
    const sketchKey = fileBytes ? `originals/${crypto.randomUUID()}` : null;
    if (sketchKey) await env.FRESSWUERFEL_SKETCHES!.put(sketchKey, fileBytes!, { httpMetadata: { contentType: 'application/octet-stream' }, customMetadata: { verifiedType: mime! } });
    await db.prepare('INSERT INTO submissions (request_id, request_hash, number, name, description, email, created_at, expires_at, sketch_key, sketch_type, sketch_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING').bind(data.requestId, hash, number, name, description, email, now, now + c.retentionDays! * 86400000, sketchKey, mime, fileBytes?.length ?? null).run();
    const saved = await db.prepare('SELECT number, request_hash, sketch_key FROM submissions WHERE request_id = ?').bind(data.requestId).first<Saved>();
    if (!saved) throw new Error('Speicherung nicht bestätigt');
    if (sketchKey && saved.sketch_key !== sketchKey) await env.FRESSWUERFEL_SKETCHES!.delete(sketchKey);
    if (saved.request_hash !== hash) return reply(409, { error: 'Diese Anfrage wurde bereits mit anderen Angaben gespeichert.' });
    return reply(201, { number: saved.number });
  } catch {
    // Bei unklarem D1-Ergebnis bleibt ein eventuell gespeichertes Original privat erhalten;
    // der R2-Lebenszyklus entfernt auch verwaiste Objekte. Keine bestätigte Einreichung beschädigen.
    return reply(503, { error: 'Ihre Einreichung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut; dieselbe Anfrage wird nur einmal gespeichert.' });
  }
}

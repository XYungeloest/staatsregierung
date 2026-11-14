import type { CampaignDB, PrivateSketches } from './server.ts';
export async function purgeExpired(db: CampaignDB, sketches: PrivateSketches, now = Date.now()): Promise<number> {
  let deleted = 0;
  for (;;) {
    const batch = await db.prepare('SELECT request_id, sketch_key FROM submissions WHERE expires_at <= ? LIMIT 100').bind(now).all<{ request_id: string; sketch_key: string | null }>();
    if (!batch.results.length) break;
    const keys = batch.results.flatMap(row => row.sketch_key ? [row.sketch_key] : []);
    if (keys.length) await sketches.delete(keys);
    // Erst nach erfolgreicher Objektlöschung die Referenz entfernen: Wiederholung bleibt möglich.
    await db.batch(batch.results.map(row => db.prepare('DELETE FROM submissions WHERE request_id = ? AND expires_at <= ?').bind(row.request_id, now)));
    deleted += batch.results.length;
  }
  await db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now).run();
  return deleted;
}

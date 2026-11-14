import { purgeExpired } from '../lib/fresswuerfel/retention.ts';
import type { CampaignEnv } from '../lib/fresswuerfel/server.ts';
export default {
  fetch() { return new Response('Nicht gefunden', { status: 404 }); },
  async scheduled(_event: unknown, env: CampaignEnv) {
    if (!env.FRESSWUERFEL_DB || !env.FRESSWUERFEL_SKETCHES) throw new Error('Kampagnenspeicher fehlt');
    await purgeExpired(env.FRESSWUERFEL_DB, env.FRESSWUERFEL_SKETCHES);
  },
};

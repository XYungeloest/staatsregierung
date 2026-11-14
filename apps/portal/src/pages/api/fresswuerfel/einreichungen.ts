import type { APIRoute } from 'astro';
import { getCampaignEnv, submitIdea, reply } from '../../../lib/fresswuerfel/server.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => submitIdea(request, await getCampaignEnv());
export const ALL: APIRoute = () => reply(405, { error: 'Diese Schnittstelle nimmt ausschließlich Einreichungen entgegen.' });

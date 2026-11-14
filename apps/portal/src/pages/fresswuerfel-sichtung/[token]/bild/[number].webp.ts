import type { APIRoute } from 'astro';
import { getCampaignEnv } from '../../../../lib/fresswuerfel/server.ts';
import { getReviewImage } from '../../../../lib/fresswuerfel/review.ts';
export const prerender = false;
export const GET: APIRoute = async ({ request, params }) => getReviewImage(request, params.token, params.number, await getCampaignEnv());
export const HEAD = GET;

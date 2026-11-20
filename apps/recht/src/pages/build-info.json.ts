import type { APIRoute } from 'astro';

export const prerender = true;
export const GET: APIRoute = () => Response.json(import.meta.env.PORTAL_BUILD_INFO);

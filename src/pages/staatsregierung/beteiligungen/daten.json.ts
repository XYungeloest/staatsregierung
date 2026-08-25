import { loadBeteiligungsInventar } from '../../../lib/portal/content.ts';

export const prerender = true;

export async function GET(): Promise<Response> {
  const inventory = await loadBeteiligungsInventar();
  return new Response(`${JSON.stringify(inventory)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

import type { APIRoute } from 'astro';
import { actionPlanItems } from '../../data/dashboard/action-plan.ts';

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      count: actionPlanItems.length,
      items: actionPlanItems,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
};

import { defineMiddleware } from 'astro:middleware';

/**
 * Antworten des Workers tragen dieselbe Buildkennung wie die statischen Assets
 * (dort über _headers gesetzt), damit Deployment-Prüfungen beide Auslieferungswege
 * demselben Commit zuordnen können.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const commit = import.meta.env.PORTAL_BUILD_COMMIT;
  if (commit && !response.headers.has('X-Portal-Commit')) {
    response.headers.set('X-Portal-Commit', commit);
  }
  return response;
});

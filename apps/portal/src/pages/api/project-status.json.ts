import type { APIRoute } from 'astro';
import { loadAllNormMetas } from '@ostrecht/shared/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { loadTopics } from '@ostrecht/shared/lib/portal/content.ts';
import { PORTAL_REFERENCE_DATE } from '@ostrecht/shared/lib/portal/dates.ts';
import { loadLegislativeProcedures } from '@ostrecht/shared/lib/portal/legislation.ts';
import { actionPlanItems } from '../../data/dashboard/action-plan.ts';
import { projectPublicStatus, publicLegalSources } from '../../lib/project-status.ts';

export const GET: APIRoute = async () => {
  const [topics, procedures, norms, publications] = await Promise.all([
    loadTopics(), loadLegislativeProcedures(), loadAllNormMetas(), loadAllVerkuendungen(),
  ]);
  const items = projectPublicStatus(actionPlanItems, topics, procedures, publicLegalSources(norms, publications));
  return Response.json({ count: items.length, items, referenceDate: PORTAL_REFERENCE_DATE }, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

import { getKreisreformUrl, getTopicUrl } from '../../lib/portal/routes.ts';
import { loadLegislativeProcedures } from '../../lib/portal/legislation.ts';
import { loadMinistries, loadTopics } from '../../lib/portal/content.ts';
import type { LegislativeTrackerItem } from '../../lib/portal/modules.ts';

export async function loadLegislationTrackerItems(): Promise<LegislativeTrackerItem[]> {
  const [procedures, ministries, topics] = await Promise.all([
    loadLegislativeProcedures(),
    loadMinistries(),
    loadTopics(),
  ]);
  const ministryNames = new Map(ministries.map((ministry) => [ministry.slug, ministry.kurzname]));
  const topicNames = new Map(topics.map((topic) => [topic.slug, topic.title]));
  return procedures.map((procedure) => ({
    id: procedure.slug,
    title: procedure.title,
    description: procedure.statusLabel,
    ressort: ministryNames.get(procedure.relatedMinistries[0] ?? '') ?? 'Staatsregierung',
    currentStage: procedure.stage,
    topic: topicNames.get(procedure.relatedTopics[0] ?? ''),
    href: procedure.slug === 'kreis-und-bezirksneuordnungsgesetz'
      ? getKreisreformUrl()
      : procedure.relatedTopics[0]
        ? getTopicUrl(procedure.relatedTopics[0])
        : undefined,
    documentNumber: procedure.documentNumber,
    nextScheduledReading: procedure.nextScheduledReading,
    recommendation: procedure.recommendation,
    proposedCommittee: procedure.proposedCommittee,
  }));
}

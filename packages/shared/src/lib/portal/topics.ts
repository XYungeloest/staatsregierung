import type { Themenseite, Themencluster, ThemenDatum } from '@ostrecht/shared/lib/portal/schema.ts';

export const TOPIC_CLUSTER_LABELS: Record<Themencluster, string> = {
  'staat-demokratie': 'Staat, Demokratie und Recht',
  'bildung-gesellschaft': 'Bildung, Gesundheit und Gesellschaft',
  'wirtschaft-arbeit': 'Wirtschaft und Arbeit',
  'infrastruktur-wohnen': 'Infrastruktur, Regionen und Wohnen',
  'umwelt-versorgung': 'Umwelt, Energie und Versorgung',
  'nachbarschaft-europa': 'Nachbarschaft und Europa',
};

export const TOPIC_CLUSTER_ORDER = Object.keys(TOPIC_CLUSTER_LABELS) as Themencluster[];

function compareTopicPriority(left: Themenseite, right: Themenseite): number {
  return right.priority - left.priority
    || right.updatedAt.localeCompare(left.updatedAt)
    || left.title.localeCompare(right.title, 'de');
}

export function isTopicHighlightActive(topic: Themenseite, referenceDate: string): boolean {
  if (!topic.highlightFrom || topic.highlightFrom > referenceDate) return false;
  return !topic.highlightUntil || topic.highlightUntil >= referenceDate;
}

export function getActiveTopicHighlights(
  topics: Themenseite[],
  referenceDate: string,
  limit?: number,
): Themenseite[] {
  const entries = topics
    .filter((topic) => isTopicHighlightActive(topic, referenceDate))
    .sort(compareTopicPriority);
  return typeof limit === 'number' ? entries.slice(0, limit) : entries;
}

export function getFeaturedTopics(topics: Themenseite[], limit?: number): Themenseite[] {
  const entries = topics.filter((topic) => topic.featured).sort(compareTopicPriority);
  return typeof limit === 'number' ? entries.slice(0, limit) : entries;
}

export function getNextTopicDate(topic: Themenseite, referenceDate: string): ThemenDatum | undefined {
  const timelineDates = topic.modules.flatMap((module) => module.type === 'timeline'
    ? module.items.map((entry) => ({
        date: entry.date,
        endDate: entry.endDate,
        label: entry.title,
        note: entry.text,
      }))
    : []);
  return [...topic.keyDates, ...timelineDates]
    .filter((entry) => entry.date > referenceDate || Boolean(entry.endDate && entry.endDate >= referenceDate))
    .sort((left, right) => left.date.localeCompare(right.date))[0];
}

export function groupTopicsByCluster(topics: Themenseite[]): Array<{
  id: Themencluster;
  label: string;
  topics: Themenseite[];
}> {
  return TOPIC_CLUSTER_ORDER.map((id) => ({
    id,
    label: TOPIC_CLUSTER_LABELS[id],
    topics: topics.filter((topic) => topic.cluster === id).sort(compareTopicPriority),
  })).filter((group) => group.topics.length > 0);
}

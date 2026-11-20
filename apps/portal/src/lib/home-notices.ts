import type { HomeContent } from '@ostrecht/shared/lib/portal/schema.ts';

type Notice = HomeContent['importantItems'][number];

export function selectHomeNotices(items: Notice[], date: string, currentGovernmentSlug: string): Notice[] {
  const available = (item: Notice) => item.enabled !== false && (!item.validFrom || item.validFrom <= date)
    && (!item.validUntil || date <= item.validUntil) && (!item.governmentSlug || item.governmentSlug === currentGovernmentSlug);
  const byPriority = (a: Notice, b: Notice) => (b.priority ?? 0) - (a.priority ?? 0);
  const replacements = items.filter((item) => item.replaces && available(item)).sort(byPriority);
  return items.filter((item) => !item.replaces).flatMap((item) => {
    if (available(item)) return [item];
    const replacement = replacements.find((other) => other.replaces === item.id);
    return replacement ? [replacement] : [];
  }).sort(byPriority);
}

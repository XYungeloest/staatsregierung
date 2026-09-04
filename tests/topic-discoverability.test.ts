import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateDiscoverability } from '../scripts/lib/topic-discoverability.mjs';
import { loadTopics } from '@ostrecht/shared/lib/portal/content.ts';
import { PORTAL_REFERENCE_DATE } from '@ostrecht/shared/lib/portal/dates.ts';

test('Discoverability-Regel ist datiert und verhindert einen unbemerkten leeren Übergang', async () => {
  const topics = await loadTopics();
  const coverage = JSON.parse(readFileSync('content/portal/topic-coverage.json', 'utf8')) as {
    discoverability: Record<string, unknown>;
  };

  const current = validateDiscoverability({
    topics,
    referenceDate: PORTAL_REFERENCE_DATE,
    policy: coverage.discoverability,
  });
  assert.deepEqual(current.problems, []);

  // Der erste Tag nach dem spätesten befristeten Hervorhebungsfenster wird aus den
  // Themendaten abgeleitet, damit neue Fenster den Test nicht stillschweigend entwerten.
  const windowEnds = topics
    .filter((topic) => topic.highlightFrom)
    .map((topic) => topic.highlightUntil ?? '9999-12-31')
    .sort();
  const lastWindowEnd = windowEnds.at(-1);
  assert.ok(lastWindowEnd && lastWindowEnd < '9999-12-31', 'alle Hervorhebungen sind befristet');
  const dayAfterAllWindows = new Date(Date.parse(`${lastWindowEnd}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const successorWindowEnd = new Date(Date.parse(`${dayAfterAllWindows}T00:00:00Z`) + 19 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const afterAllCurrentWindows = validateDiscoverability({
    topics,
    referenceDate: dayAfterAllWindows,
    policy: coverage.discoverability,
  });
  assert.match(afterAllCurrentWindows.problems.join(' '), /mindestens 1 aktuelle Vorhaben/u);

  const successorTopics = topics.map((topic) => topic.slug === 'bildungsreform'
    ? { ...topic, highlightFrom: dayAfterAllWindows, highlightUntil: successorWindowEnd }
    : topic);
  const withSuccessor = validateDiscoverability({
    topics: successorTopics,
    referenceDate: dayAfterAllWindows,
    policy: coverage.discoverability,
  });
  assert.deepEqual(withSuccessor.problems, []);
  assert.equal(withSuccessor.activeHighlights[0]?.slug, 'bildungsreform');
});

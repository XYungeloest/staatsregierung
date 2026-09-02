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

  const afterAllCurrentWindows = validateDiscoverability({
    topics,
    referenceDate: '2026-09-11',
    policy: coverage.discoverability,
  });
  assert.match(afterAllCurrentWindows.problems.join(' '), /mindestens 1 aktuelle Vorhaben/u);

  const successorTopics = topics.map((topic) => topic.slug === 'bildungsreform'
    ? { ...topic, highlightFrom: '2026-09-11', highlightUntil: '2026-09-30' }
    : topic);
  const withSuccessor = validateDiscoverability({
    topics: successorTopics,
    referenceDate: '2026-09-11',
    policy: coverage.discoverability,
  });
  assert.deepEqual(withSuccessor.problems, []);
  assert.equal(withSuccessor.activeHighlights[0]?.slug, 'bildungsreform');
});

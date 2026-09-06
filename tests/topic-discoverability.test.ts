import assert from 'node:assert/strict';
import test from 'node:test';

import { getActiveHighlights, validateDiscoverability } from '../scripts/lib/topic-discoverability.mjs';

/**
 * Discoverability-Regel auf synthetischen Themen: befristete Hervorhebungen, Mindestzahl aktueller
 * Vorhaben und redaktionelle Leitthemen werden zum Stichtag geprüft. Ob die realen Themen die
 * Regel erfüllen, prüft scripts/check-topic-coverage.mjs in content:check.
 */
function topic(slug: string, overrides: Record<string, unknown> = {}) {
  return { slug, title: slug, priority: 1, updatedAt: '2026-01-01', ...overrides };
}

const policy = { minimumActiveHighlights: 1, editorialLead: { topicSlug: 'leitthema', from: '2026-08-01', until: '2026-08-31' } };

test('aktive Hervorhebungen gelten nur innerhalb ihres Fensters und sind nach Priorität sortiert', () => {
  const topics = [
    topic('altes-thema', { highlightFrom: '2026-01-01', highlightUntil: '2026-06-30', priority: 9 }),
    topic('leitthema', { highlightFrom: '2026-08-01', highlightUntil: '2026-08-31', priority: 5 }),
    topic('nebenthema', { highlightFrom: '2026-07-01', highlightUntil: '2026-09-30', priority: 3, updatedAt: '2026-08-15' }),
    topic('ohne-fenster'),
  ];
  assert.deepEqual(getActiveHighlights(topics, '2026-08-15').map((entry) => entry.slug), ['leitthema', 'nebenthema']);
  assert.deepEqual(getActiveHighlights(topics, '2026-09-15').map((entry) => entry.slug), ['nebenthema']);
});

test('die Regel meldet einen leeren Übergang und ein verdrängtes Leitthema, nicht aber einen gültigen Stand', () => {
  const topics = [
    topic('leitthema', { highlightFrom: '2026-08-01', highlightUntil: '2026-08-31', priority: 5 }),
    topic('nebenthema', { highlightFrom: '2026-07-01', highlightUntil: '2026-09-30', priority: 3 }),
  ];
  assert.deepEqual(validateDiscoverability({ topics, referenceDate: '2026-08-15', policy }).problems, []);
  const afterAllWindows = validateDiscoverability({ topics, referenceDate: '2026-10-01', policy });
  assert.match(afterAllWindows.problems.join(' '), /mindestens 1 aktuelle Vorhaben/u);
  const displaced = validateDiscoverability({ topics: topics.map((entry) => (entry.slug === 'nebenthema' ? { ...entry, priority: 9 } : entry)), referenceDate: '2026-08-15', policy });
  assert.match(displaced.problems.join(' '), /leitthema muss im redaktionellen Zeitraum/u);
  const successor = validateDiscoverability({
    topics: topics.map((entry) => (entry.slug === 'leitthema' ? { ...entry, highlightFrom: '2026-10-01', highlightUntil: '2026-10-20' } : entry)),
    referenceDate: '2026-10-01',
    policy: { minimumActiveHighlights: 1 },
  });
  assert.deepEqual(successor.problems, []);
  assert.equal(successor.activeHighlights[0]?.slug, 'leitthema');
});

test('eine unbrauchbare Policy wird als Problem gemeldet', () => {
  const topics = [topic('leitthema', { highlightFrom: '2026-08-01', highlightUntil: '2026-08-31' })];
  assert.match(validateDiscoverability({ topics, referenceDate: '2026-08-15', policy: { minimumActiveHighlights: 0 } }).problems[0], /positive ganze Zahl/u);
  assert.match(validateDiscoverability({ topics, referenceDate: '2026-08-15', policy: { minimumActiveHighlights: 1, editorialLead: { topicSlug: 'unbekannt', from: '2026-08-01', until: '2026-08-31' } } }).problems[0], /unbekanntes Thema/u);
  assert.match(validateDiscoverability({ topics, referenceDate: '2026-08-15', policy: { minimumActiveHighlights: 1, editorialLead: { topicSlug: 'leitthema', from: '2026-09-01', until: '2026-08-01' } } }).problems[0], /aufsteigenden Datumszeitraum/u);
});

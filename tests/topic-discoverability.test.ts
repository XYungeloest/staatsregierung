import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loadTopics } from '../src/lib/portal/content.ts';
import { PORTAL_REFERENCE_DATE } from '../src/lib/portal/dates.ts';
import {
  getActiveTopicHighlights,
  getFeaturedTopics,
  getNextTopicDate,
  groupTopicsByCluster,
} from '../src/lib/portal/topics.ts';

test('aktuelle Themen werden einmal gepflegt und auf Start- und Themenübersicht gleich geordnet', async () => {
  const topics = await loadTopics();
  const active = getActiveTopicHighlights(topics, PORTAL_REFERENCE_DATE);

  assert.equal(active[0]?.slug, 'volksbefragung-2026');
  assert.deepEqual(active.slice(0, 3).map((topic) => topic.slug), [
    'volksbefragung-2026',
    'wohnen-und-vergesellschaftung',
    'kommunen-regionen-und-berlin',
  ]);
  assert.ok(getFeaturedTopics(topics).length > 0);
  assert.equal(groupTopicsByCluster(topics).flatMap((group) => group.topics).length, topics.length);

  const home = JSON.parse(readFileSync('content/portal/home.json', 'utf8')) as Record<string, unknown>;
  assert.equal('featuredTopicSlugs' in home, false);
});

test('Volksbefragung zeigt Termin, fünf Fragen und belegten Ablauf ohne Ergebnisvorwegnahme', async () => {
  const topic = (await loadTopics()).find((entry) => entry.slug === 'volksbefragung-2026');
  assert.ok(topic);
  assert.equal(getNextTopicDate(topic, PORTAL_REFERENCE_DATE)?.date, '2026-08-22');

  const questions = topic.modules.find((module) => module.type === 'questions');
  const timeline = topic.modules.find((module) => module.type === 'timeline');
  assert.ok(questions && questions.type === 'questions');
  assert.equal(questions.items.length, 5);
  assert.ok(timeline && timeline.type === 'timeline');
  assert.deepEqual(timeline.items.map((item) => item.date), [
    '2026-08-09',
    '2026-08-22',
    '2026-09-05',
    '2026-09-10',
  ]);
  assert.match(topic.faq.map((entry) => entry.answer).join(' '), /keine unmittelbare rechtliche Bindungswirkung/u);
  assert.doesNotMatch(JSON.stringify(topic), /stimmte (?:mit Ja|mit Nein)|Ergebnis:|Mehrheit von/u);
});

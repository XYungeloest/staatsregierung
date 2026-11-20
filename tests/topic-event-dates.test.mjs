import assert from 'node:assert/strict';
import test from 'node:test';
import { reportedEventProblems } from '../scripts/lib/topic-event-dates.mjs';

test('Nur ausdrücklich berichtete öffentliche Ereignisse begrenzen den Fachstand', () => {
  const dates = { press: new Map([['auswahl', '2026-03-10']]), 'campaign-result': new Map() };
  const topic = { updatedAt: '2026-03-09', keyDates: [{ date: '2027-01-01' }], naechsteSchritte: ['Ab 2027 vorgesehen.'] };
  assert.deepEqual(reportedEventProblems(topic, dates), []);
  const reported = { ...topic, reportedEvents: [{ kind: 'press', slug: 'auswahl' }] };
  assert.match(reportedEventProblems(reported, dates)[0], /2026-03-10.*2026-03-09/u);
  assert.deepEqual(reportedEventProblems({ ...reported, updatedAt: '2026-03-10' }, dates), []);
  assert.match(reportedEventProblems({ ...topic, reportedEvents: [{ kind: 'campaign-result', slug: 'auswahl' }] }, dates)[0], /kein veröffentlichtes Ereignisdatum/u);
});

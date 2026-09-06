import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSnippet, rankEntries, scoreEntry, toSearchTerms, type RankableEntry } from '../apps/portal/src/lib/search-ranking.ts';

/**
 * Die dauerhaften Rangregeln der Portalsuche laufen gegen synthetische Datensätze: eine
 * Portalseite, eine konkurrierende Vorschrift, ein reiner Volltexttreffer und eine Vorschrift
 * mit Abkürzung. So verändert eine redaktionelle Änderung unter `content/` das Ergebnis nicht;
 * gegen den echten Bestand wird während der Entwicklung gemessen, nicht in der Prüfung.
 */
const portalLanding: RankableEntry = {
  id: '/musterbereich/',
  title: 'Musterplan 2030/2031',
  aliases: ['Musterbereich'],
  description: 'Einstieg in den Musterbereich mit Eckwerten und Teilplänen.',
  url: '/musterbereich/',
  text: 'Musterbereich Eckwerte Teilpläne Ausgaben Einnahmen',
  typeLabel: 'Musterbereich',
  landing: true,
};

const portalDetail: RankableEntry = {
  id: '/musterbereich/teilplan/',
  title: 'Teilplan 04',
  description: 'Ansätze des Teilplans 04.',
  url: '/musterbereich/teilplan/',
  text: 'Teilplan Musterbereich Ansatz Kapitel',
  typeLabel: 'Musterbereich',
};

const portalFullTextOnly: RankableEntry = {
  id: '/service/hinweise/',
  title: 'Hinweise zur Nutzung',
  description: 'Kurze Hinweise zur Bedienung des Portals.',
  url: '/service/hinweise/',
  text: 'Die Seite erläutert den Musterbereich und nennt die zuständige Stelle. Ein Prüfwort steht hier: Wegmarkenbegriff.',
  typeLabel: 'Service',
};

const lawGeneric: RankableEntry = {
  id: '/norm/musterordnung/',
  title: 'Musterbereichsordnung des Musterlandes',
  aliases: ['MustBO'],
  description: '',
  url: '/norm/musterordnung/',
  text: 'Musterrecht Verwaltung',
  typeLabel: 'Recht',
};

const lawAbbreviated: RankableEntry = {
  id: '/norm/mustergesetz/',
  title: 'Gesetz über die Musterordnung im Musterland',
  aliases: ['MustG', 'Mustergesetz'],
  description: '',
  url: '/norm/mustergesetz/',
  text: 'Musterrecht Verwaltung Zuständigkeit',
  typeLabel: 'Recht',
};

const PORTAL = [portalLanding, portalDetail, portalFullTextOnly];
const LAW = [lawGeneric, lawAbbreviated];

test('Portalsuche: ein Bereichseinstieg steht vor gleichnamigen Vorschriften', () => {
  const hits = rankEntries(PORTAL, LAW, 'Musterbereich');
  assert.equal(hits[0]?.entry.id, portalLanding.id, `Reihenfolge: ${hits.map((hit) => hit.entry.id).join(', ')}`);
  assert.equal(hits[0]?.area, 'portal');
  assert.ok(hits.some((hit) => hit.area === 'law'), 'Vorschriften erscheinen weiterhin, nur später');
});

test('Portalsuche: eine exakt eingegebene Abkürzung führt zu ihrer Vorschrift', () => {
  const hits = rankEntries(PORTAL, LAW, 'MustG');
  assert.equal(hits[0]?.entry.id, lawAbbreviated.id, `Reihenfolge: ${hits.map((hit) => hit.entry.id).join(', ')}`);
  assert.equal(hits[0]?.area, 'law');
});

test('Portalsuche: ohne Rechtsbestand bleiben nur Portaltreffer', () => {
  const hits = rankEntries(PORTAL, [], 'Musterbereich');
  assert.ok(hits.length > 0);
  assert.ok(hits.every((hit) => hit.area === 'portal'));
});

test('Portalsuche: ein Begriff, der nur im Fließtext steht, wird gefunden', () => {
  const hits = rankEntries(PORTAL, LAW, 'Wegmarkenbegriff');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.entry.id, portalFullTextOnly.id);
  assert.equal(hits[0]?.matchedIn, 'text');
});

test('Portalsuche: der Ausschnitt eines Volltexttreffers enthält die Fundstelle', () => {
  const terms = toSearchTerms('Wegmarkenbegriff');
  const snippet = buildSnippet(portalFullTextOnly.text, terms);
  assert.ok(snippet, 'Ausschnitt vorhanden');
  assert.ok(snippet.text.includes('Wegmarkenbegriff'), snippet.text);
  assert.equal(snippet.marks.length, 1);
  assert.equal(snippet.text.slice(snippet.marks[0].start, snippet.marks[0].end), 'Wegmarkenbegriff');
  assert.ok(snippet.text.length <= 240, `Ausschnittlänge ${snippet.text.length}`);
});

test('Portalsuche: der Ausschnitt bleibt aus, wenn der Begriff nicht im Text steht', () => {
  assert.equal(buildSnippet(portalFullTextOnly.text, toSearchTerms('Fehlanzeige')), null);
});

test('Portalsuche: ohne Treffer wird nichts bewertet', () => {
  assert.equal(scoreEntry(portalDetail, 'portal', toSearchTerms('Unbekannt'), 'Unbekannt'), null);
  assert.equal(rankEntries(PORTAL, LAW, 'Unbekannt').length, 0);
});

test('Portalsuche: Sortierung nach Aktualität stellt das jüngste Datum voran', () => {
  const older: RankableEntry = { ...portalDetail, id: 'alt', date: '2024-01-01' };
  const newer: RankableEntry = { ...portalDetail, id: 'neu', date: '2026-01-01' };
  const hits = rankEntries([older, newer], [], 'Teilplan', { sort: 'latest' });
  assert.equal(hits[0]?.entry.id, 'neu');
});

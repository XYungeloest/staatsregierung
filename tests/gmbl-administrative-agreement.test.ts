import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '../src/lib/norms/publications.ts';
import { runNormSearch, type NormSearchState } from '../src/lib/norms/search-query.ts';
import { buildSearchIndexPayload } from '../src/lib/norms/search.ts';
import { buildPortalSearchEntries } from '../src/lib/portal/search.ts';

const agreementSlug = 'verwaltungsabkommen-kasernierte-grenzpolizei';

function searchState(q: string): NormSearchState {
  return {
    q,
    exclude: '',
    exact: '',
    scope: 'all',
    types: [],
    ministries: [],
    subjects: [],
    statuses: [],
    versionScope: 'current',
    includeAmendments: false,
    geltungstag: '',
    validFrom: '',
    validTo: '',
    citation: '',
    publicationSources: [],
    publicationYears: [],
    publicationIssue: '',
    publicationPage: '',
    sort: 'relevance',
  };
}

test('GMBl. 2026 Nr. 14 ist als Verkündung mit vollständiger Quellenhierarchie verknüpft', async () => {
  const publications = await loadAllVerkuendungen();
  const publication = publications.find((entry) => entry.slug === 'gmbl-2026-14');
  assert.ok(publication);
  assert.equal(publication.publication, 'GMBl.');
  assert.equal(publication.title, 'Gemeinsames Ministerialblatt 2026 Nr. 14');
  assert.equal(publication.date, '2026-07-29');
  assert.equal(publication.place, 'Bonn');
  assert.equal(publication.publisher, 'Bundesministerium des Innern und für Heimat');
  assert.equal(publication.entries[0].pages, '2–6');
  assert.equal(publication.entries[0].normSlug, agreementSlug);
  assert.deepEqual(
    publication.sourceReferences?.map((source) => [source.kind, source.localSource, source.sourceRole]),
    [
      ['structured-html-transcription', 'Gesetze/GMBl-14-2026.html', 'structure-bearing'],
      ['primary-pdf', 'Gesetze/GMBl-14-2026.pdf', 'visual-control'],
      ['supplementary-markdown-transcription', 'Gesetze/GMBl-14-2026.md', 'supplementary-transcription'],
    ],
  );
  assert.deepEqual(
    readFileSync('public/assets/recht/GMBl-14-2026.pdf'),
    readFileSync('Gesetze/GMBl-14-2026.pdf'),
  );
});

test('Verwaltungsabkommen besitzt korrekten Typ, Datierung, Parteien und Personenverknüpfung', async () => {
  const agreement = (await loadAllNorms()).find((entry) => entry.meta.slug === agreementSlug);
  assert.ok(agreement);
  assert.equal(agreement.meta.type, 'verwaltungsabkommen');
  assert.equal(agreement.meta.documentDate, '2026-07-28');
  assert.equal(agreement.meta.publicationDate, '2026-07-29');
  assert.equal(agreement.meta.effectiveDate, '2026-07-29');
  assert.equal(agreement.meta.agreementDetails?.signedAt, 'Leipzig');
  assert.deepEqual(
    agreement.meta.agreementDetails?.parties.map((party) => party.name),
    ['Bundesministerium des Innern und für Heimat', 'Ostdeutscher Staatsrat'],
  );
  assert.equal(
    agreement.meta.agreementDetails?.signatories.find((entry) => entry.name === 'Yannik Schmäle')?.personId,
    'person-yannik-schmaele',
  );
  assert.match(agreement.meta.agreementDetails?.legalBases[0].label ?? '', /§§ 2 und 61 BPolG/u);
  assert.deepEqual(agreement.meta.relatedNorms, [
    'kasernierte-grenzpolizei-errichtungsgesetz',
    'kasernierte-grenzpolizei-gesetz',
  ]);
});

test('alle sieben Paragraphen und § 7 werden vollständig ohne erfundene Klausel ausgegeben', async () => {
  const agreement = (await loadAllNorms()).find((entry) => entry.meta.slug === agreementSlug);
  assert.ok(agreement);
  const version = agreement.versions[0];
  const paragraphs = version.body.filter((block) => block.type === 'paragraph');
  assert.deepEqual(paragraphs.map((block) => block.label), ['§ 1', '§ 2', '§ 3', '§ 4', '§ 5', '§ 6', '§ 7']);
  const paragraphSeven = paragraphs.at(-1);
  assert.equal(paragraphSeven?.title, 'Inkrafttreten');
  assert.equal(paragraphSeven?.children?.length, 1);
  assert.equal(paragraphSeven?.children?.[0].type, 'paragraphText');
  assert.equal(
    paragraphSeven?.children?.[0].text,
    'Dieses Verwaltungsabkommen kann mit einer Frist von sechs Monaten zum Ablauf eines Kalenderjahres gekündigt werden.',
  );
  assert.doesNotMatch(JSON.stringify(version.body), /tritt\s+(?:am|mit)|29\. Juli 2026/u);
  assert.match(agreement.meta.dateNote ?? '', /keinen ausdrücklichen Inkrafttretenssatz/u);
  assert.match(version.sourceNotes?.[0].text ?? '', /kein konkretes Inkrafttretensdatum/u);
});

test('abweichende Amtsbezeichnungen bleiben als Quellenabweichungen dokumentiert', async () => {
  const agreement = (await loadAllNorms()).find((entry) => entry.meta.slug === agreementSlug);
  assert.ok(agreement);
  assert.deepEqual(
    agreement.meta.agreementDetails?.sourceDiscrepancies?.map((entry) => [entry.location, entry.originalText]),
    [
      ['Präambel', 'Staatsrat für Staats- und Grenzssicherheit'],
      ['Unterschriftszeile', 'Staatsrat für Staats- und Grenzschutz'],
    ],
  );
  assert.ok(agreement.meta.agreementDetails?.sourceDiscrepancies?.every(
    (entry) => entry.canonicalText === 'Staatsrat für Staats- und Grenzsicherheit',
  ));
  assert.match(JSON.stringify(agreement.versions[0].body), /Staatsrat für Staats- und Grenzssicherheit/u);
});

test('Rechts- und Portalsuche finden das Verwaltungsabkommen unter den geforderten Suchbegriffen', async () => {
  const searchIndex = await buildSearchIndexPayload();
  for (const query of [
    'Verwaltungsabkommen',
    'Grenzpolizei',
    'GMBl. 2026 Nr. 14',
    'Bundespolizei',
    'grenzpolizeilicher Einzeldienst',
  ]) {
    assert.ok(
      runNormSearch(searchIndex.documents, searchState(query))
        .some((result) => result.documentEntry.slug === agreementSlug),
      query,
    );
  }
  const portalEntries = await buildPortalSearchEntries();
  assert.ok(portalEntries.some((entry) =>
    entry.id === `law:${agreementSlug}` && /GMBl\. 2026 Nr\. 14/u.test(entry.text)));
});

test('aktuelle öffentliche Texte sind bereinigt, der überholte Wissensstand bleibt nachvollziehbar', () => {
  const topic = readFileSync('content/themen/demokratie-und-sicherheit.json', 'utf8');
  const legislation = readFileSync('content/gesetzgebung/kasernierte-grenzpolizei.json', 'utf8');
  const currentPublicCopy = `${topic}\n${legislation}`;
  assert.doesNotMatch(currentPublicCopy, /in Ausarbeitung|nicht unterzeichnet|nicht wirksam/u);
  assert.match(currentPublicCopy, /28\. Juli 2026/u);
  assert.match(currentPublicCopy, /29\. Juli 2026/u);
  assert.match(currentPublicCopy, new RegExp(agreementSlug, 'u'));

  const historicalClarification = readFileSync('knowledge/clarifications/2026-07-29.md', 'utf8');
  const supersededCandidate = readFileSync('knowledge/conversation-candidates.json', 'utf8');
  assert.match(historicalClarification, /in Ausarbeitung/u);
  assert.match(historicalClarification, /überholt/u);
  assert.match(supersededCandidate, /candidate-grenzpolizei-agreement-draft-status/u);
  assert.match(supersededCandidate, /superseded-by-primary-source/u);
});

test('bestehende Normtypen und Veröffentlichungsreihen bleiben neben GMBl. erhalten', async () => {
  const [norms, publications] = await Promise.all([loadAllNorms(), loadAllVerkuendungen()]);
  const normTypes = new Set<string>(norms.map((entry) => entry.meta.type));
  for (const type of ['gesetz', 'verordnung', 'verwaltungsvorschrift', 'staatsvertrag', 'verwaltungsabkommen']) {
    assert.ok(normTypes.has(type), type);
  }
  const publicationSeries = new Set(publications.map((entry) => entry.publication));
  for (const series of ['OGVBl.', 'OVertrBl.', 'OABl.', 'StAnzO.', 'GMBl.']) {
    assert.ok(publicationSeries.has(series), series);
  }
});

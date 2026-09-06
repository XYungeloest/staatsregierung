import assert from 'node:assert/strict';
import test from 'node:test';

import { getNormLastActivityDate, getNormLastChangeDate } from '@ostrecht/shared/lib/norms/versions.ts';

import { buildProvisionVersionDiff, buildStructuralVersionDiff, diffSentences, diffWords, summarizeNormDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import { renderNormDiffDocument } from '@ostrecht/shared/lib/norms/diff-render.ts';
import { formatChangedUnitCount, formatNormUnitKind, getNormUnitKind } from '@ostrecht/shared/lib/norms/units.ts';
import {
  LEGAL_BASELINE_DATE,
  getNormOriginInfo,
} from '@ostrecht/shared/lib/norms/origin.ts';
import { classifyNormOriginVersion } from '@ostrecht/shared/lib/norms/origin-presentation.ts';
import { buildNormRelations } from '@ostrecht/shared/lib/norms/relations.ts';
import { getLegacyBlockAnchorId, getNormTitleBlock, parseCitation } from '@ostrecht/shared/lib/norms/display.ts';
import { getBlockAnchorId } from '@ostrecht/shared/lib/norms/presentation.ts';
import {
  buildSearchCandidateParams,
  candidateTotalMatchesResults,
  getDefaultSearchSort,
  groupNormSearchResults,
  normalizeSearchText,
  parseNormSearchQuery,
  prepareSearchDocuments,
  runNormSearch,
  type NormSearchState,
} from '@ostrecht/recht-search/search-query.ts';
import { buildSearchIndexPayloadFrom } from '@ostrecht/recht-search/search-files.ts';
import { buildSearchSuggestions, isAmendmentRecord, type SearchIndexDocument } from '@ostrecht/recht-search/search.ts';
import {
  findPublicationByDesignation,
  getLatestPublication,
} from '@ostrecht/shared/lib/norms/publications.ts';
import {
  ContentValidationError,
  parseNormMeta,
  type NormRecord,
  type NormVersion,
} from '@ostrecht/shared/lib/norms/schema.ts';
import {
  classifyNormVersion,
  getApplicableVersion,
  getBerlinCalendarDate,
  isStrictlyFutureEffectiveDate,
  partitionDatedEntries,
  validateVersionIntervals,
} from '@ostrecht/shared/lib/norms/versions.ts';
import { getNormVersionIdentity, getPublicNormSummary } from '@ostrecht/shared/lib/norms/identity.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';

import { FIXTURE_REFERENCE_DATE, fixtureCorpus } from './helpers/fixture-corpus.ts';

function version(versionId: string, validFrom: string, validTo: string | null): NormVersion {
  return {
    versionId,
    validFrom,
    validTo,
    isCurrent: false,
    citation: `Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)`,
    changeNote: versionId,
    body: [
      {
        type: 'paragraph',
        label: '§ 1',
        title: 'Geltung',
        children: [{ type: 'paragraphText', text: versionId }],
      },
    ],
  };
}

function record(versions: NormVersion[], status: NormRecord['meta']['status'] = 'in-force'): NormRecord {
  return {
    meta: {
      id: 'test',
      slug: 'test-norm',
      title: 'Testnorm',
      shortTitle: 'Testnorm',
      type: 'gesetz',
      subjects: ['Verwaltungsrecht'],
      keywords: [],
      initialCitation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)',
      predecessor: null,
      successor: null,
      summary: 'Test',
      status,
    },
    history: { initialVersionId: versions[0]?.versionId ?? null, entries: [] },
    versions,
  };
}

test('Fassungen werden zum redaktionellen Stichtag zentral eingeordnet', () => {
  const historical = version('alt', '2026-01-01', '2026-06-30');
  const formerlyCurrent = version('bis-juli', '2026-07-01', '2026-07-31');
  const current = version('geltend', '2026-08-01', null);
  const norm = record([historical, formerlyCurrent, current]);

  assert.equal(classifyNormVersion(norm, historical), 'historical');
  assert.equal(classifyNormVersion(norm, formerlyCurrent), 'historical');
  assert.equal(classifyNormVersion(norm, current), 'current');
  assert.equal(getApplicableVersion(norm).versionId, 'geltend');
  assert.equal(classifyNormVersion(record([current], 'pending-effective'), current), 'unknown-effective');
  const historicalWithoutEnd = version('dokumentiert', '2025-01-01', null);
  assert.equal(classifyNormVersion(record([historicalWithoutEnd], 'historical'), historicalWithoutEnd), 'historical');
});

test('künftige Änderungen beginnen erst nach dem redaktionellen Kalendertag', () => {
  const referenceDate = '2026-09-01';
  assert.equal(getBerlinCalendarDate(new Date('2026-08-31T22:30:00.000Z')), referenceDate);
  assert.equal(isStrictlyFutureEffectiveDate('2026-08-31', referenceDate), false);
  assert.equal(isStrictlyFutureEffectiveDate('2026-09-01', referenceDate), false);
  assert.equal(isStrictlyFutureEffectiveDate('2026-09-02', referenceDate), true);

  const changes = partitionDatedEntries([
    { date: '2026-08-31', id: 'past' },
    { date: '2026-09-01', id: 'effective-today' },
    { date: '2026-09-02', id: 'future' },
  ], referenceDate);
  assert.deepEqual(changes.current.map((entry) => entry.id), ['past', 'effective-today']);
  assert.deepEqual(changes.future.map((entry) => entry.id), ['future']);
});

test('deutsche Umlaute werden im A–Z-Index einheitlich gruppiert', () => {
  assert.equal(getGermanIndexLetter('Änderungsgesetz'), 'A');
  assert.equal(getGermanIndexLetter('ÖPNV-Gesetz'), 'O');
  assert.equal(getGermanIndexLetter('Überleitungsverordnung'), 'U');
  assert.equal(getGermanIndexLetter('123. Bekanntmachung'), '#');
});

test('überlappende oder widersprüchliche Gültigkeitsintervalle werden abgewiesen', () => {
  assert.throws(
    () => validateVersionIntervals(record([
      version('a', '2026-01-01', '2026-08-01'),
      version('b', '2026-08-01', null),
    ])),
    /überlappen/u,
  );
  assert.throws(
    () => validateVersionIntervals(record([version('a', '2026-08-01', '2026-07-01')])),
    /validTo liegt vor validFrom/u,
  );
  assert.throws(
    () => validateVersionIntervals(record([
      version('a', '2026-01-01', '2026-06-29'),
      version('b', '2026-07-01', null),
    ])),
    /Gültigkeitslücke/u,
  );
});

test('semantische Anker bleiben unabhängig von der Blockposition und alte Anker bleiben ableitbar', () => {
  const block = { type: 'paragraph' as const, label: '§ 12a', title: 'Antrag', children: [] };
  assert.equal(getBlockAnchorId([8, 4], block), 'paragraph-12a');
  assert.equal(getBlockAnchorId([1, 2], block), 'paragraph-12a');
  assert.equal(getLegacyBlockAnchorId([8, 4], block), 'block-8-4-paragraph-12a');
});

test('struktureller Vergleich kennzeichnet geänderte, neue und entfernte Einheiten', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body.push({
    type: 'paragraph',
    label: '§ 2',
    title: 'Alt',
    children: [{ type: 'paragraphText', text: 'wird aufgehoben' }],
  });
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [{ type: 'paragraphText', text: 'geänderter Text' }];
  after.body.push({
    type: 'paragraph',
    label: '§ 3',
    title: 'Neu',
    children: [{ type: 'paragraphText', text: 'wird eingefügt' }],
  });

  const diff = buildStructuralVersionDiff(before, after);
  assert.equal(diff.find((entry) => entry.key.includes('paragraph:§ 1/paragraphText'))?.kind, 'changed');
  assert.equal(diff.find((entry) => entry.label === '§ 2')?.kind, 'removed');
  assert.equal(diff.find((entry) => entry.label === '§ 3')?.kind, 'added');
  assert.ok(diffWords('alte Regel', 'neue Regel').some((entry) => entry.kind === 'insert'));
});

test('vollständig ersetzte Sätze bleiben zusammenhängende Vergleichsblöcke', () => {
  const changes = diffSentences(
    'Die bisherige Regelung gilt uneingeschränkt.',
    'Die neue Regelung gilt nur auf Antrag.',
  );
  assert.deepEqual(changes, [{
    before: 'Die bisherige Regelung gilt uneingeschränkt.',
    after: 'Die neue Regelung gilt nur auf Antrag.',
    kind: 'changed',
  }]);
});

test('Fassungsvergleich bündelt Änderungen einmal je vollständigem Paragraphen', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [
    { type: 'paragraphText', label: '(1)', text: 'Die alte Regel gilt.' },
    { type: 'paragraphText', label: '(2)', text: 'Dieser Satz bleibt.' },
  ];
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [
    { type: 'paragraphText', label: '(1)', text: 'Die neue Regel gilt.' },
    { type: 'paragraphText', label: '(2)', text: 'Dieser Satz bleibt.' },
  ];

  const provisions = buildProvisionVersionDiff(before, after);
  assert.equal(provisions.length, 1);
  assert.match(provisions[0].beforeText ?? '', /§ 1 Geltung[\s\S]*\(1\) Die alte Regel gilt\.[\s\S]*\(2\) Dieser Satz bleibt\./);
  assert.match(provisions[0].afterText ?? '', /§ 1 Geltung[\s\S]*\(1\) Die neue Regel gilt\.[\s\S]*\(2\) Dieser Satz bleibt\./);
  assert.ok(provisions[0].textDiff?.some((chunk) => chunk.kind === 'insert'));
});

test('Fassungsvergleich markiert auch in langen Paragraphen nur die tatsächliche Änderung', () => {
  const unchangedText = 'Dieser unveränderte Regelungstext bleibt vollständig bestehen. '.repeat(45);
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [{ type: 'paragraphText', label: '(1)', text: `${unchangedText}Die Veröffentlichung erfolgt im Amtsblatt.` }];
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [{ type: 'paragraphText', label: '(1)', text: `${unchangedText}Die Veröffentlichung erfolgt im Amtsblatt und im Transparenzportal.` }];

  const [provision] = buildProvisionVersionDiff(before, after);
  assert.ok((provision.beforeText?.length ?? 0) > 2_000);
  assert.ok(provision.textDiff, 'Der Wortvergleich darf bei langen Paragraphen nicht verworfen werden.');
  assert.ok(provision.textDiff?.some((chunk) => chunk.kind === 'insert' && chunk.text.includes('Transparenzportal')));
  assert.ok(!provision.textDiff?.some((chunk) => chunk.kind === 'delete'));
});

test('Fassungsvergleich markiert auch vollständig geänderte Paragraphenüberschriften', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].title = 'Bisherige Voraussetzungen';
  const after = version('b', '2026-07-01', null);
  after.body[0].title = 'Neue Zuständigkeiten';

  const html = renderNormDiffDocument(buildProvisionVersionDiff(before, after), before.validFrom, after.validFrom);
  assert.match(html, /<del>Bisherige Voraussetzungen<\/del>/u);
  assert.match(html, /<ins>Neue Zuständigkeiten<\/ins>/u);
});

test('struktureller Fassungsvergleich erhält Absatzlabels und verschachtelte Listen', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [{
    type: 'subparagraph',
    label: '(1)',
    text: 'Die Behörde entscheidet.',
    children: [
      {
        type: 'item',
        label: '1.',
        text: 'erste Voraussetzung',
        children: [{ type: 'subitem', label: 'a)', text: 'Unterpunkt alt' }],
      },
      { type: 'item', label: '2.', text: 'zweite Voraussetzung' },
    ],
  }];
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [{
    type: 'subparagraph',
    label: '(1)',
    text: 'Die Behörde entscheidet verbindlich.',
    children: [
      {
        type: 'item',
        label: '1.',
        text: 'erste Voraussetzung',
        children: [{ type: 'subitem', label: 'a)', text: 'Unterpunkt neu' }],
      },
      { type: 'item', label: '2.', text: 'zweite Voraussetzung' },
      { type: 'item', label: '3.', text: 'dritte Voraussetzung' },
    ],
  }];

  const [provision] = buildProvisionVersionDiff(before, after);
  const html = renderNormDiffDocument([provision], before.validFrom, after.validFrom);
  assert.match(html, /norm-subparagraph__label[^>]*>\(1\)<\/span>/u);
  assert.match(html, /norm-amendment-list/u);
  assert.match(html, /norm-amendment-item__children/u);
  assert.match(html, /Unterpunkt <ins>neu<\/ins>/u);
  assert.match(html, /<ins>dritte Voraussetzung<\/ins>/u);
  assert.doesNotMatch(html, /<p>[^<]*\(1\)[\s\S]*1\. erste Voraussetzung, 2\./u);
});

test('Fassungsvergleich stellt neue und entfallene Paragraphen strukturiert dar', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [{ type: 'paragraphText', text: 'unverändert' }];
  before.body.push({
    type: 'paragraph',
    label: '§ 2',
    title: 'Entfallen',
    children: [{ type: 'paragraphText', label: '(1)', text: 'Alte Regelung.' }],
  });
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [{ type: 'paragraphText', text: 'unverändert' }];
  after.body.push({
    type: 'paragraph',
    label: '§ 3',
    title: 'Neu',
    children: [{ type: 'paragraphText', label: '(1)', text: 'Neue Regelung.' }],
  });

  const html = renderNormDiffDocument(buildProvisionVersionDiff(before, after), before.validFrom, after.validFrom);
  assert.match(html, /norm-diff__provision--removed/u);
  assert.match(html, /norm-diff__provision--added/u);
  assert.match(html, /<del>Alte Regelung\.<\/del>/u);
  assert.match(html, /<ins>Neue Regelung\.<\/ins>/u);
  assert.match(html, /norm-text__label[^>]*>[\s\S]*?\(1\)[\s\S]*?<\/span>/u);
});

test('Whitespace-only changes erzeugen keinen Vergleichsblock', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [{ type: 'paragraphText', label: '(1)', text: 'Eine Regel.' }];
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [{ type: 'paragraphText', label: '(1)', text: '  Eine   Regel. ' }];

  assert.deepEqual(buildProvisionVersionDiff(before, after), []);
});

/**
 * Absatzfolge ohne Gliederungszeichen vor der ersten Einheit, wie sie Präambeln und Vorsprüche
 * bilden: jeder Absatz ist im Vergleich eine eigene Änderungseinheit.
 */
function unlabeledParagraphs(target: NormVersion, texts: string[]): void {
  target.body = [
    ...texts.map((text) => ({ type: 'paragraphText', text }) as NormVersion['body'][number]),
    { type: 'paragraph', label: '§ 1', title: 'Geltung', children: [{ type: 'paragraphText', text: 'Diese Vorschrift gilt unverändert.' }] },
  ];
}

test('Fassungsvergleich paart eingefügte Absätze ohne Gliederungszeichen inhaltlich', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  unlabeledParagraphs(before, [
    'Erste Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Zweite Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Dritte Zeile des Vorspruchs nennt die maßgebliche Zuständigkeit der Behörde.',
    'Vierte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Fünfte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
  ]);
  const after = version('b', '2026-07-01', null);
  unlabeledParagraphs(after, [
    'Erste Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Eine neu eingefügte Zeile ergänzt den Vorspruch an zweiter Stelle.',
    'Zweite Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Dritte Zeile des Vorspruchs nennt die maßgebliche Zuständigkeit der obersten Behörde.',
    'Vierte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Eine weitere neu eingefügte Zeile schließt den Vorspruch ab.',
    'Fünfte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
  ]);

  const provisions = buildProvisionVersionDiff(before, after);
  assert.equal(provisions.filter((entry) => entry.kind === 'added').length, 2);
  assert.equal(provisions.filter((entry) => entry.kind === 'changed').length, 1);
  assert.equal(provisions.filter((entry) => entry.kind === 'removed').length, 0);
  const [changed] = provisions.filter((entry) => entry.kind === 'changed');
  assert.ok(changed.textDiff?.some((chunk) => chunk.kind === 'insert' && chunk.text.includes('obersten')));
});

test('Fassungsvergleich meldet neu formulierte Absätze ohne Gliederungszeichen als entfallen und neu', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  unlabeledParagraphs(before, [
    'Der erste Vorspruchabsatz beschreibt eine längst überholte Ausgangslage im Einzelnen.',
    'Der zweite Vorspruchabsatz zählt frühere Zuständigkeiten einzelner Stellen auf.',
    'Der dritte Vorspruchabsatz verweist auf eine aufgehobene Übergangsregelung.',
    'Vierte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Fünfte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Der sechste Vorspruchabsatz nennt den Willen der Bürgerinnen und Bürger des Landes.',
    'Der siebte Vorspruchabsatz beschreibt eine längst überholte Verfahrensweise.',
    'Achte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
  ]);
  const after = version('b', '2026-07-01', null);
  unlabeledParagraphs(after, [
    'Eine vollständig neu gefasste Eröffnung stellt die heutige Aufgabe voran.',
    'Vierte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Fünfte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
    'Der sechste Vorspruchabsatz nennt den Willen aller Bürgerinnen und Bürger des Landes.',
    'Achte Zeile des Vorspruchs bleibt vollständig unverändert bestehen.',
  ]);

  const provisions = buildProvisionVersionDiff(before, after);
  // Drei wortgleiche Zeilen bleiben unverändert und werden nicht gelistet; aus acht mal fünf
  // Absätzen werden sechs Einträge statt der positionsweisen fünf „Geändert“ und drei „Entfallen“.
  assert.equal(provisions.length, 6);
  assert.equal(provisions.filter((entry) => entry.kind === 'changed').length, 1);
  assert.equal(provisions.filter((entry) => entry.kind === 'added').length, 1);
  assert.equal(provisions.filter((entry) => entry.kind === 'removed').length, 4);
  // Kein Absatz erscheint zugleich als entfallen und als geändert.
  assert.equal(new Set(provisions.map((entry) => entry.beforeText ?? entry.afterText)).size, provisions.length);
  const [changed] = provisions.filter((entry) => entry.kind === 'changed');
  assert.ok(changed.beforeText?.includes('Willen der Bürgerinnen'));
  assert.ok(changed.afterText?.includes('Willen aller Bürgerinnen'));
});

test('umsortierte, wortgleiche Absätze erzeugen nicht mehr Einträge als Absätze', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  unlabeledParagraphs(before, [
    'Erste Aussage des Vorspruchs zur Zuständigkeit der obersten Landesbehörde.',
    'Zweite Aussage des Vorspruchs zur Beteiligung der kommunalen Ebene.',
    'Dritte Aussage des Vorspruchs bleibt an ihrer Stelle unverändert bestehen.',
  ]);
  const after = version('b', '2026-07-01', null);
  unlabeledParagraphs(after, [
    'Zweite Aussage des Vorspruchs zur Beteiligung der kommunalen Ebene.',
    'Erste Aussage des Vorspruchs zur Zuständigkeit der obersten Landesbehörde.',
    'Dritte Aussage des Vorspruchs bleibt an ihrer Stelle unverändert bestehen.',
  ]);

  const provisions = buildProvisionVersionDiff(before, after);
  assert.ok(provisions.length <= 3, `höchstens drei Einträge, gemeldet ${provisions.length}`);
  assert.ok(provisions.every((entry) => entry.kind !== 'unchanged'));
});

test('Einheitenart einer Vorschrift folgt dem Normkörper und wird richtig gebeugt', () => {
  const article = { type: 'article', label: 'Artikel 1', title: 'Grundsatz', children: [{ type: 'paragraphText', text: 'Text' }] } as const;
  const paragraph = { type: 'paragraph', label: '§ 1', title: 'Geltung', children: [{ type: 'paragraphText', text: 'Text' }] } as const;
  const quoted = { type: 'quotedProvision', children: [paragraph] } as const;

  assert.equal(getNormUnitKind([article]), 'article');
  assert.equal(getNormUnitKind([paragraph]), 'paragraph');
  assert.equal(getNormUnitKind([article, paragraph]), 'mixed');
  assert.equal(getNormUnitKind([{ type: 'paragraphText', text: 'Nur ein Absatz.' }]), 'none');
  // Wiedergegebener fremder Text bestimmt die Einheitenart der Vorschrift nicht.
  assert.equal(getNormUnitKind([article, quoted]), 'article');
  // Einheiten in einer Gliederungsebene zählen mit.
  assert.equal(getNormUnitKind([{ type: 'section', label: 'Abschnitt 1', children: [paragraph] }]), 'paragraph');

  assert.equal(formatNormUnitKind('article', 'all'), 'Artikel');
  assert.equal(formatNormUnitKind('paragraph', 'all'), 'Paragraphen');
  assert.equal(formatNormUnitKind('none', 'all'), 'Textstellen');
  assert.equal(formatChangedUnitCount(132, 'article'), '132 geänderte Artikel');
  assert.equal(formatChangedUnitCount(1, 'article'), '1 geänderter Artikel');
  assert.equal(formatChangedUnitCount(1, 'paragraph'), '1 geänderter Paragraph');
  assert.equal(formatChangedUnitCount(2, 'paragraph'), '2 geänderte Paragraphen');
  assert.equal(formatChangedUnitCount(1, 'none'), '1 geänderte Textstelle');
  assert.equal(formatChangedUnitCount(3), '3 geänderte Textstellen');
});

test('Vergleichszähler nennt die Einheitenart, bleibt aber mit drei Argumenten gültig', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body = [{ type: 'article', label: 'Artikel 1', title: 'Grundsatz', children: [{ type: 'paragraphText', text: 'Die alte Regel gilt.' }] }];
  const after = version('b', '2026-07-01', null);
  after.body = [{ type: 'article', label: 'Artikel 1', title: 'Grundsatz', children: [{ type: 'paragraphText', text: 'Die neue Regel gilt.' }] }];
  const provisions = buildProvisionVersionDiff(before, after);

  assert.match(renderNormDiffDocument(provisions, before.validFrom, after.validFrom, 'article'), /1 geänderter Artikel/u);
  assert.match(renderNormDiffDocument(provisions, before.validFrom, after.validFrom), /1 geänderte Textstelle/u);
});

test('Tabellen bleiben im strukturierten Vergleich als Tabellen erhalten', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [{
    type: 'table',
    title: 'Grenzwerte',
    children: [{
      type: 'tableRow',
      children: [
        { type: 'tableHeaderCell', text: 'Bezeichnung', scope: 'col' },
        { type: 'tableCell', text: 'alt' },
      ],
    }],
  }];
  const after = version('b', '2026-07-01', null);
  after.body[0].children = [{
    type: 'table',
    title: 'Grenzwerte',
    children: [{
      type: 'tableRow',
      children: [
        { type: 'tableHeaderCell', text: 'Bezeichnung', scope: 'col' },
        { type: 'tableCell', text: 'neu' },
      ],
    }],
  }];

  const html = renderNormDiffDocument(buildProvisionVersionDiff(before, after), before.validFrom, after.validFrom);
  assert.match(html, /<table class="norm-table">/u);
  assert.match(html, /<th scope="col">Bezeichnung<\/th>/u);
  assert.match(html, /<td><del>alt<\/del><\/td>/u);
  assert.match(html, /<td><ins>neu<\/ins><\/td>/u);
});

test('Diff-Zusammenfassung zählt dieselben strukturellen Einheiten wie der Vergleich', () => {
  const before = version('a', '2026-01-01', '2026-06-30');
  before.body[0].children = [{ type: 'paragraphText', text: 'Die alte Regel gilt.' }];
  const after = version('b', '2026-07-01', null);
  after.body[0].title = 'Neue Überschrift';
  after.body[0].children = [
    { type: 'paragraphText', text: 'Die neue Regel gilt.' },
    { type: 'item', label: '1.', text: 'Neue Nummer' },
  ];
  const diff = buildStructuralVersionDiff(before, after);
  const summary = summarizeNormDiff(diff);

  assert.equal(Object.values(summary).reduce((sum, value) => sum + value, 0), diff.length);
  assert.ok(summary.changed >= 1);
  assert.ok(summary.added >= 1);
  assert.ok(diff.some((unit) => unit.textDiff?.some((chunk) => chunk.kind === 'insert')));
  const changedParagraphText = diff.find((unit) => unit.type === 'paragraphText' && unit.kind === 'changed');
  assert.match(changedParagraphText?.beforeProvisionText ?? '', /§ 1 Geltung[\s\S]*Die alte Regel gilt\./);
  assert.match(changedParagraphText?.afterProvisionText ?? '', /§ 1 Neue Überschrift[\s\S]*Die neue Regel gilt\.[\s\S]*1\. Neue Nummer/);

  const reversed = buildStructuralVersionDiff(after, before);
  assert.equal(summarizeNormDiff(reversed).removed, summary.added);
});

test('Rechtsherkunft trennt neue, unveränderte, geänderte und ungeklärte Normen', () => {
  const baseline = version(LEGAL_BASELINE_DATE, LEGAL_BASELINE_DATE, null);
  baseline.citation = 'Sächsisches Ausgangsrecht';
  baseline.sourceReferences = [{
    kind: 'revosax-snapshot',
    label: 'Amtliche REVOSax-Fassung',
    availability: 'versioned',
    localSource: 'data/recht/sources/revosax/test/1.html',
    url: 'https://www.revosax.sachsen.de/vorschrift/1',
    sourceValidFrom: '2023-01-01',
  }];
  const inherited = record([baseline]);
  inherited.meta.slug = 'uebernommene-norm';
  inherited.meta.id = inherited.meta.slug;
  inherited.meta.initialCitation = 'Sächsisches Ausgangsrecht';
  inherited.history = {
    initialVersionId: baseline.versionId,
    entries: [{
      date: LEGAL_BASELINE_DATE,
      type: 'initial',
      title: 'Ausgangsfassung',
      citation: 'Sächsisches Ausgangsrecht',
      affectingVersionId: baseline.versionId,
    }],
  };

  const laterSaxon = version('2023-12-31', '2023-12-31', null);
  laterSaxon.citation = 'Späterer ausdrücklich übernommener sächsischer Zwischenstand';
  laterSaxon.sourceReferences = [{
    ...baseline.sourceReferences[0],
    localSource: 'data/recht/sources/revosax/test/2.html',
    sourceValidFrom: '2023-12-31',
  }];
  const inheritedWithIntermediate = {
    ...inherited,
    versions: [baseline, laterSaxon],
  };

  const amendmentAct = record([version('2026-01-01', '2026-01-01', null)]);
  amendmentAct.meta.slug = 'ostdeutsches-aenderungsgesetz';
  amendmentAct.meta.id = amendmentAct.meta.slug;
  amendmentAct.meta.initialCitation = 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)';
  const amended = structuredClone(inherited);
  amended.meta.slug = 'geaenderte-norm';
  amended.meta.id = amended.meta.slug;
  amended.history.entries.push({
    date: '2026-01-02',
    type: 'amendment',
    title: 'Geändert',
    citation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)',
    affectingVersionId: baseline.versionId,
    relatedNorm: amendmentAct.meta.slug,
  });

  const original = record([version('2024-10-15', '2024-10-15', null)]);
  original.meta.slug = 'neue-ostdeutsche-norm';
  original.meta.id = original.meta.slug;
  original.history.entries = [{
    date: '2024-10-15',
    type: 'initial',
    title: 'Ursprungsfassung',
    citation: 'Gesetz vom 15. Oktober 2024 (OGVBl. 2024 Nr. II)',
    affectingVersionId: '2024-10-15',
  }];

  const unresolved = record([version('ungeklaert', '2026-01-01', null)]);
  unresolved.meta.slug = 'ungeklaerte-norm';
  unresolved.meta.id = unresolved.meta.slug;
  unresolved.meta.initialCitation = 'Ausgangsquelle nicht belegt';
  unresolved.versions[0].citation = 'Ausgangsquelle nicht belegt';
  unresolved.history.entries = [];

  // Ein älteres Übereinkommen, das erst durch ein ostdeutsches Zustimmungsgesetz gilt: keine
  // sächsische Quelle, Verkündung im Ostdeutschen Vertragsblatt, Geltungsbeginn nach dem
  // Stichtag – die Herkunft ist belegt, obwohl der erste Historieneintrag vor dem Stichtag liegt.
  const treaty = record([version('1992-07-14', '2026-01-27', null)]);
  treaty.meta.slug = 'altes-uebereinkommen';
  treaty.meta.id = treaty.meta.slug;
  treaty.meta.type = 'staatsvertrag';
  treaty.meta.initialCitation = 'Übereinkommen vom 9. April 1992 (OVertrBl. 2026 Nr. 1)';
  treaty.meta.effectiveDate = '2026-01-27';
  treaty.versions[0].citation = 'Übereinkommen vom 9. April 1992 (OVertrBl. 2026 Nr. 1)';
  treaty.history.initialVersionId = '1992-07-14';
  treaty.history.entries = [{
    date: '1992-07-14',
    type: 'initial',
    title: 'Übereinkommen',
    citation: 'Übereinkommen vom 9. April 1992 (OVertrBl. 2026 Nr. 1)',
    affectingVersionId: '1992-07-14',
  }];
  // Dieselbe Norm ohne eigenes Verkündungsorgan bleibt ungeklärt; eine vor dem Stichtag
  // geltende Fassung ebenfalls.
  const treatyWithoutEvidence = structuredClone(treaty);
  treatyWithoutEvidence.meta.initialCitation = 'Übereinkommen vom 9. April 1992';
  treatyWithoutEvidence.versions[0].citation = 'Übereinkommen vom 9. April 1992';
  treatyWithoutEvidence.history.entries[0].citation = 'Übereinkommen vom 9. April 1992';
  const treatyBeforeBaseline = structuredClone(treaty);
  treatyBeforeBaseline.versions[0].validFrom = '1994-01-01';
  treatyBeforeBaseline.meta.effectiveDate = '1994-01-01';

  assert.equal(getNormOriginInfo(original, [original]).kind, 'ostdeutsch-original');
  assert.equal(getNormOriginInfo(treaty, [treaty]).kind, 'ostdeutsch-original');
  assert.equal(getNormOriginInfo(treatyWithoutEvidence, [treatyWithoutEvidence]).kind, 'origin-unresolved');
  assert.equal(getNormOriginInfo(treatyBeforeBaseline, [treatyBeforeBaseline]).kind, 'origin-unresolved');
  assert.equal(getNormOriginInfo(inherited, [inherited]).kind, 'inherited-unchanged');
  assert.equal(getNormOriginInfo(amended, [amended, amendmentAct]).kind, 'inherited-amended');
  assert.equal(getNormOriginInfo(unresolved, [unresolved]).kind, 'origin-unresolved');
  const intermediateOrigin = getNormOriginInfo(inheritedWithIntermediate, [inheritedWithIntermediate]);
  assert.equal(intermediateOrigin.kind, 'inherited-unchanged');
  assert.equal(classifyNormOriginVersion(intermediateOrigin, laterSaxon), 'inherited-intermediate');
});

test('gerichtete Normrelationen werden aus einer Richtung und mehreren Historieneinträgen abgeleitet', () => {
  const target = record([version('2026-07-21', '2026-07-21', null)]);
  target.meta.slug = 'stammnorm';
  target.meta.id = target.meta.slug;
  const first = record([version('erstes', '2026-07-20', null)]);
  first.meta.slug = 'erstes-aenderungsgesetz';
  first.meta.id = first.meta.slug;
  first.meta.affectedNorms = [target.meta.slug];
  const second = record([version('zweites', '2026-07-20', null)]);
  second.meta.slug = 'zweites-aenderungsgesetz';
  second.meta.id = second.meta.slug;
  target.history.entries = [first, second].map((act) => ({
    date: '2026-07-21',
    type: 'amendment' as const,
    title: `${act.meta.shortTitle} berücksichtigt`,
    citation: 'Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 53)',
    affectingVersionId: '2026-07-21',
    relatedNorm: act.meta.slug,
  }));

  const relations = buildNormRelations([target, first, second]);
  assert.equal(relations.get(target.meta.slug)?.filter((entry) => entry.kind === 'amended-by').length, 2);
  assert.equal(relations.get(second.meta.slug)?.filter((entry) => entry.kind === 'amends').length, 1);
  assert.equal(relations.get(second.meta.slug)?.find((entry) => entry.kind === 'amends')?.resultingVersionId, '2026-07-21');
});

function searchDocument(overrides: Partial<SearchIndexDocument> = {}): SearchIndexDocument {
  return {
    id: 'test:1',
    slug: 'test',
    versionId: '1',
    url: '/recht/norm/test/',
    currentUrl: '/recht/norm/test/',
    isCurrent: true,
    versionKind: 'current',
    isAmendment: false,
    origin: 'ostdeutsch-original',
    title: 'Straßen- und Krankenhausgesetz',
    shortTitle: 'Straßengesetz',
    abbr: 'StrG',
    type: 'gesetz',
    typeLabel: 'Gesetz',
    ministry: 'Staatssekretariat für Gesundheit',
    subjects: ['Gesundheit und Soziales'],
    keywords: ['Krankenhaus'],
    status: 'in-force',
    statusLabel: 'in Kraft',
    summary: 'Regelt die Versorgung.',
    initialCitation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)',
    citation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1 S. 3)',
    publication: 'OGVBl. 2026 Nr. 1',
    publicationSource: 'OGVBl.',
    publicationYear: '2026',
    publicationIssue: '1',
    publicationPage: '3',
    changeNote: 'Stammfassung',
    validFrom: '2026-01-01',
    validTo: null,
    bodySupplement: '',
    hitUnits: [{
      type: 'paragraph',
      label: '§ 1',
      title: 'Versorgung',
      text: 'Die Straße dient der Krankenhausversorgung.',
      anchor: 'paragraf-1',
    }],
    ...overrides,
  };
}

function searchState(overrides: Partial<NormSearchState> = {}): NormSearchState {
  return {
    q: '',
    exclude: '',
    exact: '',
    scope: 'all',
    types: [],
    ministries: [],
    subjects: [],
    statuses: [],
    origins: [],
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
    ...overrides,
  };
}

test('Suche behandelt Umlaute, ß, Wortfolge, Ausschluss und Präfix-Platzhalter', () => {
  const documents = [searchDocument()];
  assert.equal(normalizeSearchText('Straße'), 'strasse');
  assert.equal(runNormSearch(documents, searchState({ q: 'Straße' })).length, 1);
  assert.equal(runNormSearch(documents, searchState({ q: 'Kranken*' })).length, 1);
  assert.equal(runNormSearch(documents, searchState({ exact: 'Krankenhausversorgung' })).length, 1);
  assert.equal(runNormSearch(documents, searchState({ q: 'Straße', exclude: 'Krankenhaus' })).length, 0);
});

test('Suche verknüpft Facetten mit UND und mehrere Werte derselben Facette mit ODER', () => {
  const documents = [
    searchDocument(),
    searchDocument({ id: 'vo:1', slug: 'vo', type: 'verordnung', typeLabel: 'Verordnung' }),
    searchDocument({ id: 'alt:1', slug: 'alt', versionKind: 'historical', isCurrent: false }),
    searchDocument({ id: 'aend:1', slug: 'aend', isAmendment: true }),
  ];
  assert.equal(runNormSearch(documents, searchState({ types: ['gesetz', 'verordnung'] })).length, 2);
  assert.equal(runNormSearch(documents, searchState({ types: ['gesetz'], publicationYears: ['2025'] })).length, 0);
  assert.equal(runNormSearch(documents, searchState({ versionScope: 'historical' })).length, 1);
  assert.equal(runNormSearch(documents, searchState({ origins: ['inherited-amended'] })).length, 0);
  assert.equal(runNormSearch(documents, searchState()).some((entry) => entry.documentEntry.isAmendment), false);
  assert.equal(runNormSearch(documents, searchState({ includeAmendments: true })).length, 3);
});

test('Standardsortierung richtet sich nach Suchkontext und respektiert eine ausdrückliche Auswahl', () => {
  const olderAlphabetical = searchDocument({
    id: 'alt:1', slug: 'alt', title: 'Allgemeinverfügung', publicationDate: '2026-01-01', validFrom: '2026-01-01',
  });
  const newer = searchDocument({
    id: 'neu:1', slug: 'neu', title: 'Zukunftsgesetz', publicationDate: '2026-08-20', validFrom: '2026-08-20',
  });
  // Ohne Suchbegriff (auch mit Filtern) zählt das jüngste Rechtsereignis, nicht Titel oder Ausgangsfassung.
  assert.equal(getDefaultSearchSort(searchState()), 'activity');
  assert.equal(getDefaultSearchSort(searchState({ types: ['gesetz'], origins: ['inherited-amended'] })), 'activity');
  assert.equal(getDefaultSearchSort(searchState({ q: 'Allgemeinverfügung' })), 'relevance');
  assert.equal(getDefaultSearchSort(searchState({ citation: 'OVertrBl. 2026 Nr. 4' })), 'relevance');
  const browseResults = runNormSearch([olderAlphabetical, newer], searchState({ sort: 'activity', sortExplicit: false }));
  assert.deepEqual(browseResults.map((entry) => entry.documentEntry.slug), ['neu', 'alt']);
  const explicitPublication = runNormSearch([olderAlphabetical, newer], searchState({ sort: 'publication', sortExplicit: true }));
  assert.deepEqual(explicitPublication.map((entry) => entry.documentEntry.slug), ['neu', 'alt']);
  const explicitResults = runNormSearch([olderAlphabetical, newer], searchState({
    q: 'verfügung', sort: 'publication', sortExplicit: true,
  }));
  assert.equal(explicitResults[0]?.documentEntry.slug, 'alt');
});

test('Sortierung nach jüngster Rechtsänderung: neues Gesetz 2026 und 2026 geänderte Übernahme vor unverändert übernommenem Recht, künftige Ereignisse zählen nicht', () => {
  const inheritedUnchanged = searchDocument({
    id: 'alt:1', slug: 'altes-testgesetz', title: 'Altes Testgesetz', publicationDate: '1993-05-17', validFrom: '2023-11-01', lastChangeDate: '2023-11-01',
  });
  const amendedInherited = searchDocument({
    id: 'geaendert:1', slug: 'geaendertes-testgesetz', title: 'Geändertes Testgesetz', publicationDate: '2018-03-09', validFrom: '2026-08-01', lastChangeDate: '2026-08-01',
  });
  const newLaw = searchDocument({
    id: 'neu:1', slug: 'neues-testgesetz', title: 'Neues Testgesetz', publicationDate: '2026-09-02', validFrom: '2026-09-02', lastChangeDate: '2026-09-02',
  });
  // Ältere Suchdokumente ohne das Feld ordnen sich über den Fassungsbeginn ein (Expand/Contract).
  const legacyDocument = searchDocument({ id: 'legacy:1', slug: 'legacy', title: 'Ältere Projektion', validFrom: '2024-01-01' });
  delete (legacyDocument as Partial<SearchIndexDocument>).lastChangeDate;
  const results = runNormSearch([inheritedUnchanged, legacyDocument, amendedInherited, newLaw], searchState({ sort: 'activity', sortExplicit: false }));
  assert.deepEqual(results.map((entry) => entry.documentEntry.slug), ['neues-testgesetz', 'geaendertes-testgesetz', 'legacy', 'altes-testgesetz']);
  // Gleichstand: Titel, dann Slug – deterministisch.
  const tieA = searchDocument({ id: 'a:1', slug: 'b-slug', title: 'Alpha', validFrom: '2026-01-01', lastChangeDate: '2026-05-01' });
  const tieB = searchDocument({ id: 'b:1', slug: 'a-slug', title: 'Alpha', validFrom: '2026-01-01', lastChangeDate: '2026-05-01' });
  assert.deepEqual(runNormSearch([tieA, tieB], searchState({ sort: 'activity', sortExplicit: false })).map((entry) => entry.documentEntry.slug), ['a-slug', 'b-slug']);
});

test('Kandidatenanfrage trägt jeden serverseitig ausdrückbaren Filter; nur dann darf die Überschrift eine Gesamtzahl nennen', () => {
  // Stöbern: alles serverseitig ausdrückbar, die Gesamtzahl der API beschreibt dieselbe Menge.
  const browse = searchState({ types: ['gesetz'], subjects: ['Bildung und Schule'], statuses: ['in-force'], versionScope: 'current' });
  assert.equal(candidateTotalMatchesResults(browse), true);
  const browseParams = buildSearchCandidateParams(browse);
  assert.deepEqual(browseParams.types, ['gesetz']);
  assert.deepEqual(browseParams.subjects, ['Bildung und Schule']);
  assert.equal(browseParams.versionScope, 'current');
  assert.equal(browseParams.includeAmendments, false, 'ohne Suchbegriff verengt der Server auch die Änderungsvorschriften');

  // Freitext: die Kandidaten sind großzügig, die Bewertung läuft im Browser – keine Gesamtzahl.
  for (const state of [searchState({ q: 'Testkindergeld' }), searchState({ exact: 'Testkindergeld' }), searchState({ citation: 'OGVBl. 2026 Nr. 16' }), searchState({ exclude: 'Änderung' })]) {
    assert.equal(candidateTotalMatchesResults(state), false);
    assert.equal(buildSearchCandidateParams(state).includeAmendments, true, 'mit Suchbegriff bleiben Änderungsvorschriften Kandidaten');
    assert.equal(buildSearchCandidateParams(state).versionScope, 'all', 'eine Fundstellensuche darf Fassungen nicht vorab ausschließen');
  }
  // Ausdrücklich gewählte Fassungsart bleibt auch mit Suchbegriff erhalten.
  assert.equal(buildSearchCandidateParams(searchState({ q: 'Testkindergeld', versionScope: 'historical', versionScopeExplicit: true })).versionScope, 'historical');
  // Ausdrücklich gefilterte Änderungsvorschriften bleiben Kandidaten (amendmentExplicitlyRequested).
  assert.equal(buildSearchCandidateParams(searchState({ types: ['aenderungsvorschrift'] })).includeAmendments, true);

  // Geltungstag und Gültigkeitszeitraum trägt die Projektion je Fassung: sie gehen serverseitig mit.
  const dated = searchState({ geltungstag: '2026-01-01', validFrom: '2026-01-01', validTo: '2026-12-31' });
  assert.equal(candidateTotalMatchesResults(dated), true);
  assert.deepEqual(
    [buildSearchCandidateParams(dated).geltungstag, buildSearchCandidateParams(dated).validFrom, buildSearchCandidateParams(dated).validTo],
    ['2026-01-01', '2026-01-01', '2026-12-31'],
  );

  // Ausgabennummer und Seite vergleichen normalisierten Text und bleiben im Browser.
  for (const state of [searchState({ publicationIssue: '16' }), searchState({ publicationPage: '12' })]) {
    assert.equal(candidateTotalMatchesResults(state), false);
  }
});

test('Rechtsänderung und Aktivität sind getrennt: ein bloßer Hinweis zählt nur als Aktivität', () => {
  const norm = record([version('2024-05-01', '2024-05-01', null)]);
  norm.history.entries = [
    { type: 'initial', date: '2024-05-01', title: 'Stammfassung', citation: 'Verordnung vom 1. Mai 2024 (OGVBl. 2024 Nr. 12)', affectingVersionId: '2024-05-01' },
    { type: 'notice', date: '2026-08-27', title: 'Berichtigungshinweis', citation: 'Hinweis vom 27. August 2026 (OGVBl. 2026 Nr. 70)' },
  ] as typeof norm.history.entries;
  assert.equal(getNormLastChangeDate(norm, '2026-09-04'), '2024-05-01', 'ein Hinweis ist keine Rechtsänderung');
  assert.equal(getNormLastActivityDate(norm, '2026-09-04'), '2026-08-27', 'als Aktivität zählt er weiterhin');

  // Sortierung: die Norm mit der jüngeren echten Änderung steht vor der nur hinweisberührten.
  const noticeOnly = searchDocument({ id: 'hinweis:1', slug: 'hinweis-norm', title: 'Hinweisnorm', validFrom: '2024-05-01', lastChangeDate: '2024-05-01' });
  const reallyChanged = searchDocument({ id: 'echt:1', slug: 'geaenderte-norm', title: 'Geänderte Norm', validFrom: '2026-08-01', lastChangeDate: '2026-08-01' });
  const order = runNormSearch([noticeOnly, reallyChanged], searchState({ sort: 'activity', sortExplicit: false }));
  assert.deepEqual(order.map((entry) => entry.documentEntry.slug), ['geaenderte-norm', 'hinweis-norm']);
});

test('jüngste Aktivität einer Norm: Erlass zählt, künftige Fassungen und Ereignisse nicht', () => {
  const norm = record([version('2026-01-01', '2026-01-01', '2026-09-30'), version('2026-10-01', '2026-10-01', null)]);
  norm.history.entries = [
    { type: 'initial', date: '2026-01-01', title: 'Stammfassung', citation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)', affectingVersionId: '2026-01-01' },
    { type: 'amendment', date: '2026-10-01', title: 'Künftige Änderung', citation: 'Gesetz vom 1. Oktober 2026 (OGVBl. 2026 Nr. 80)', affectingVersionId: '2026-10-01' },
  ] as typeof norm.history.entries;
  assert.equal(getNormLastActivityDate(norm, '2026-09-04'), '2026-01-01');
  assert.equal(getNormLastActivityDate(norm, '2026-10-01'), '2026-10-01');
  const untouched = record([version('2023-11-01', '2023-11-01', null)]);
  untouched.history.entries = [];
  assert.equal(getNormLastActivityDate(untouched, '2026-09-04'), '2023-11-01');
  const onlyFuture = record([version('2027-01-01', '2027-01-01', null)]);
  onlyFuture.history.entries = [];
  assert.equal(getNormLastActivityDate(onlyFuture, '2026-09-04'), null);
});

test('eine Fundstellensuche zeigt auch Änderungsvorschriften der zitierten Ausgabe, ohne den Standardfilter zu berühren', () => {
  const treatyAmendment = searchDocument({
    id: 'ndr:1', slug: 'staatsvertrag-ndr-aenderung', title: 'Staatsvertrag zur Änderung des Staatsvertrages über den Norddeutschen Rundfunk',
    shortTitle: 'NDR-Änderungsstaatsvertrag', abbr: '', isAmendment: true, type: 'staatsvertrag', typeLabel: 'Staatsvertrag',
    citation: 'Staatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4 S. 2)', publication: 'OVertrBl. 2026 Nr. 4', publicationSlug: 'overtrbl-2026-04',
    publicationTitle: 'Ostdeutsches Vertragsblatt 2026 Nr. 4', publicationSource: 'OVertrBl.', publicationYear: '2026', publicationIssue: '4', publicationPage: '2',
  });
  const other = searchDocument({ id: 'other:1', slug: 'other', publicationSlug: 'ogvbl-2026-01' });
  const byCitation = runNormSearch([treatyAmendment, other], searchState({ q: 'OVertrBl. 2026 Nr. 4' }));
  assert.deepEqual(byCitation.map((entry) => entry.documentEntry.slug), ['staatsvertrag-ndr-aenderung']);
  assert.equal(byCitation[0]?.matchKind, 'publication');
  // Ohne Fundstelle bleibt die Änderungsvorschrift beim Stöbern ausgeblendet.
  assert.deepEqual(runNormSearch([treatyAmendment, other], searchState()).map((entry) => entry.documentEntry.slug), ['other']);
});

test('Fundstellen des Ostdeutschen Vertragsblatts werden wie die anderen Verkündungsorgane erkannt', () => {
  for (const query of ['OVertrBl. 2026 Nr. 4', 'OVertrBl 2026 Nr 4', 'Staatsvertrag OVertrBl. 2026 Nr. 4 S. 2', 'OGVBl. 2026 Nr. 1', 'StAnzO. 2026 Nr. 39']) {
    const parsed = parseNormSearchQuery(query);
    assert.equal(parsed.hasPublicationReference, true, query);
  }
  for (const query of ['Vertragsblatt 2026', 'OVertrBl.', 'Nr. 4', 'Ostdeutsches Vertragsblatt Nr. 4', 'ABC 2026 Nr. 4']) {
    assert.equal(parseNormSearchQuery(query).hasPublicationReference, false, query);
  }
});

test('Änderungsvorschriften werden auch bei historisch grobem Normtyp erkannt', () => {
  const amendment = record([version('a', '2026-01-01', null)]);
  amendment.meta.title = 'Elftes Gesetz zur Änderung des Bestattungsgesetzes';
  assert.equal(amendment.meta.type, 'gesetz');
  assert.equal(isAmendmentRecord(amendment), true);

  const standalone = record([version('b', '2026-01-01', null)]);
  standalone.meta.title = 'Gesetz über die Krankenhausversorgung';
  assert.equal(isAmendmentRecord(standalone), false);
});

test('ein primäres Sachgebiet muss Teil der belegten Mehrfachzuordnung sein', () => {
  const meta = record([version('a', '2026-01-01', null)]).meta;
  assert.equal(parseNormMeta({ ...meta, primarySubject: 'Verwaltungsrecht' }).primarySubject, 'Verwaltungsrecht');
  assert.throws(
    () => parseNormMeta({ ...meta, primarySubject: 'Nicht zugeordnet' }),
    (error: unknown) => error instanceof ContentValidationError
      && /primarySubject: muss zugleich in subjects enthalten sein/u.test(error.message),
  );
});

test('Fundstellenparser erhält Nummern- und Seitenbereiche vollständig', () => {
  const citations = [
    {
      citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–14)',
      expected: { source: 'OGVBl.', year: '2025', issue: '1–7', page: '7–14' },
    },
    {
      citation: 'Bundesrecht (BGBl. 2026 I Nr. 64–74)',
      expected: { source: 'BGBl.', year: '2026', part: 'I', issue: '64–74' },
    },
    {
      citation: 'Verwaltungsabkommen vom 28. Juli 2026 (GMBl. 2026 Nr. 14 S. 2)',
      expected: { source: 'GMBl.', year: '2026', issue: '14', page: '2' },
    },
    {
      citation: 'Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 50 S. 2)',
      expected: { source: 'OGVBl.', year: '2026', issue: '50', page: '2' },
    },
  ];

  for (const { citation, expected } of citations) {
    assert.deepEqual(parseCitation(citation), expected, citation);
  }
});

test('Fundstellenparser unterstützt Bindestrich, Gedankenstriche und Schrägstrich', () => {
  for (const separator of ['-', '–', '—', '/']) {
    assert.deepEqual(
      parseCitation(`Gesetz (OGVBl. 2025 Nr. 1${separator}7 S. 7${separator}14)`),
      {
        source: 'OGVBl.',
        year: '2025',
        issue: `1${separator}7`,
        page: `7${separator}14`,
      },
    );
  }
});

const fixture = fixtureCorpus();
const fixtureNorm = (slug: string): NormRecord => {
  const record = fixture.norms.find((entry) => entry.meta.slug === slug);
  assert.ok(record, slug);
  return record;
};
const fixtureSearchIndex = buildSearchIndexPayloadFrom({ records: fixture.norms, publications: fixture.publications });

test('jede Fassung trägt ihre eigene öffentliche Bezeichnung', () => {
  const law = fixtureNorm('testgesetz');
  const [historical, current] = law.versions;
  assert.equal(getNormVersionIdentity(law, historical).title, 'Ostdeutsches Testgesetz');
  assert.equal(getNormVersionIdentity(law, current).title, 'Testgesetz für den Ostdeutschen Freistaat');
  assert.equal(getNormVersionIdentity(law, current).abbr, 'OstTestG');
  const regulation = fixtureNorm('testverordnung');
  assert.equal(getNormVersionIdentity(regulation, regulation.versions[0]).title, regulation.meta.title, 'ohne Fassungstitel gilt die Stammbezeichnung');
});

test('Rechtsherkunft des Fixture-Bestands folgt Quellen und Historie', () => {
  const origin = (slug: string) => getNormOriginInfo(fixtureNorm(slug), fixture.norms);
  assert.equal(origin('neues-ostgesetz').kind, 'ostdeutsch-original');
  assert.equal(origin('neues-ostgesetz').baselineVersionId, undefined);
  assert.equal(origin('testverordnung').kind, 'inherited-unchanged');
  const amended = origin('testgesetz');
  assert.equal(amended.kind, 'inherited-amended');
  assert.equal(amended.baselineVersionId, LEGAL_BASELINE_DATE);
  assert.equal(amended.ownAmendmentCount, 1);
  assert.equal(origin('aufgehobene-verordnung').kind, 'inherited-amended', 'eine ostdeutsche Aufhebung ist eine eigene Änderung');
});

test('Rechtsübersichten und Suchindex verwenden dieselbe höchste Verkündung', () => {
  const latest = getLatestPublication(fixture.publications);
  assert.ok(latest);
  assert.deepEqual(fixtureSearchIndex.latestPublication, {
    slug: latest.slug,
    date: latest.date,
    publication: latest.publication,
    year: latest.year,
    issue: latest.issue,
  });
});

test('historische Verkündungsbezeichnung bleibt ein Such- und Lookupalias', () => {
  for (const designation of ['OABl. 2026 Nr. 2', 'StAnzO. 2026 Nr. 2', 'OABl 2026 Nr 2']) {
    assert.equal(findPublicationByDesignation(fixture.publications, designation)?.slug, 'stanzo-2026-02', designation);
    const results = runNormSearch(fixtureSearchIndex.documents, searchState({ q: designation }));
    assert.ok(results.length > 0, designation);
    assert.deepEqual([...new Set(results.map(({ documentEntry }) => documentEntry.publicationSlug))], ['stanzo-2026-02'], designation);
  }
  assert.equal(findPublicationByDesignation(fixture.publications, 'OABl. 2025 Nr. 2'), undefined);
});

test('feldbewusste Rechtssuche priorisiert Identitäten, Normtypen, Vorschriften und Fundstellen', () => {
  const documents = prepareSearchDocuments(fixtureSearchIndex.documents);
  const search = (q: string, overrides: Partial<NormSearchState> = {}) => runNormSearch(documents, searchState({
    q,
    sort: 'relevance',
    sortExplicit: false,
    ...overrides,
  }));
  const fundingSlug = 'foerderrichtlinie-testkindergeld';
  const cases: Array<{ q: string; slug: string; assertion?: (results: ReturnType<typeof search>) => void }> = [
    { q: 'Förderrichtlinie', slug: fundingSlug, assertion: (results) => assert.ok(results.every((result) => result.documentEntry.type === 'foerderrichtlinie')) },
    { q: 'Foerderrichtlinie', slug: fundingSlug, assertion: (results) => assert.ok(results.every((result) => result.documentEntry.type === 'foerderrichtlinie')) },
    { q: 'FRL Testkindergeld', slug: fundingSlug },
    { q: 'Testkindergeld', slug: fundingSlug },
    { q: 'OstTestG', slug: 'testgesetz' },
    { q: 'Testgesetz § 2a', slug: 'testgesetz', assertion: (results) => assert.equal(results[0]?.bestHitUnit?.label, '§ 2a') },
    {
      q: 'Testgesetz §§ 2, 2a',
      slug: 'testgesetz',
      assertion: (results) => {
        assert.equal(results[0]?.bestHitUnit?.label, '§ 2');
        assert.equal(results[0]?.matchLabel, 'Treffer in §§ 2, 2a');
      },
    },
    {
      q: 'Testgesetz § 2a Abs. 1',
      slug: 'testgesetz',
      assertion: (results) => {
        assert.equal(results[0]?.bestHitUnit?.label, '§ 2a');
        assert.equal(results[0]?.bestHitUnit?.references?.paragraph, '2a');
        assert.ok(results[0]?.bestHitUnit?.references?.subsections?.includes('1'));
      },
    },
    { q: 'OGVBl. 2026 Nr. 70', slug: 'neues-ostgesetz', assertion: (results) => assert.ok(results.every((result) => result.documentEntry.publicationSlug === 'ogvbl-2026-70')) },
  ];
  for (const { q, slug, assertion } of cases) {
    const results = search(q);
    assert.equal(results[0]?.documentEntry.slug, slug, q);
    assertion?.(results);
  }

  // Ein starker Titeltreffer holt eine Änderungsvorschrift auch ohne Volltextfilter nach vorn.
  const amendmentTitle = 'Gesetz zur Änderung des Testgesetzes';
  assert.equal(search(amendmentTitle)[0]?.documentEntry.slug, 'aenderungsgesetz-testgesetz');
  assert.ok(search('Gesetz zur Änderung').some((result) => result.documentEntry.slug === 'aenderungsgesetz-testgesetz'));

  const amendmentIntentResults = search('Änderungsvorschrift');
  assert.ok(amendmentIntentResults.length > 0);
  assert.ok(amendmentIntentResults.every((result) => result.documentEntry.type === 'aenderungsvorschrift'));
  const amendmentFacetResults = search('', { types: ['aenderungsvorschrift'] });
  assert.ok(amendmentFacetResults.length > 0);
  assert.ok(amendmentFacetResults.every((result) => result.documentEntry.type === 'aenderungsvorschrift'));
  const genericLawResults = search('Gesetz');
  assert.ok(genericLawResults.length > 0);
  assert.ok(genericLawResults.every((result) => !result.documentEntry.isAmendment));
  const typedLawResults = search('Gesetz', { types: ['gesetz'] });
  assert.ok(typedLawResults.length > 0);
  assert.ok(typedLawResults.every((result) => result.documentEntry.type === 'gesetz' && !result.documentEntry.isAmendment));

  // Der übergeleitete historische Titel ist zugleich die geltende Kurzbezeichnung: die Gruppe
  // führt die geltende Fassung an und enthält die historische Fassung unter ihrem Titel.
  const historicalTitleState = searchState({ q: 'Ostdeutsches Testgesetz', versionScope: 'all', sort: 'relevance', sortExplicit: false });
  const historicalTitleResults = runNormSearch(documents, historicalTitleState);
  const group = groupNormSearchResults(historicalTitleResults, historicalTitleState).find((entry) => entry.slug === 'testgesetz');
  assert.ok(group);
  assert.ok(['Ostdeutsches Testgesetz', 'Testgesetz für den Ostdeutschen Freistaat'].includes(group.entries[0]?.documentEntry.title ?? ''));
  assert.ok(group.entries.some((entry) => entry.documentEntry.title === 'Ostdeutsches Testgesetz' && entry.documentEntry.versionKind === 'historical'));

  const consentResults = search('Zustimmungsgesetz');
  assert.equal(parseNormSearchQuery('Zustimmungsgesetz').typeIntent?.type, 'zustimmungsgesetz');
  assert.ok(consentResults.length > 0);
  assert.ok(consentResults.every((result) => result.documentEntry.type === 'zustimmungsgesetz'));

  const phrase = 'öffentliche Sicherheit';
  const phraseResults = search(`"${phrase}"`);
  assert.deepEqual(parseNormSearchQuery(`"${phrase}"`).phrases, [phrase]);
  assert.ok(phraseResults.length > 0);
  assert.ok(phraseResults.every(({ documentEntry }) => normalizeSearchText([
    documentEntry.title,
    documentEntry.shortTitle,
    documentEntry.summary,
    documentEntry.bodySupplement,
    ...documentEntry.hitUnits.flatMap((unit) => [unit.label, unit.title, unit.text]),
  ].join(' ')).includes(normalizeSearchText(phrase))));
});

test('Autocomplete enthält eine kanonische Suggestion je geltender Norm', () => {
  const suggestions = buildSearchSuggestions(fixture.norms, FIXTURE_REFERENCE_DATE);
  assert.equal(new Set(suggestions.map((suggestion) => suggestion.slug)).size, suggestions.length);
  const funding = suggestions.find((suggestion) => suggestion.slug === 'foerderrichtlinie-testkindergeld');
  assert.ok(funding);
  assert.equal(funding.abbr, 'FRL Testkindergeld');
  assert.ok(funding.title.includes('Testkindergeld'));
  const amended = suggestions.find((suggestion) => suggestion.slug === 'testgesetz');
  // Aliasse sind Bezeichnungen anderer Fassungen, die von der geltenden Identität abweichen.
  assert.ok(amended?.aliases.includes('Ostdeutsches Testgesetz'));
  assert.equal(amended?.url.endsWith('/norm/testgesetz/'), true);
  assert.ok(!suggestions.some((suggestion) => suggestion.slug === 'kuenftiges-gesetz'), 'ohne geltende Fassung kein Vorschlag');
  assert.ok(!suggestions.some((suggestion) => suggestion.slug === 'aufgehobene-verordnung'), 'aufgehobene Normen werden nicht vorgeschlagen');
});
test('der Titelblock zeigt die Kurzbezeichnung als Überschrift und den Langtitel darunter', () => {
  assert.deepEqual(
    getNormTitleBlock({ title: 'Gesetz über die Prüfung von Testfällen', shortTitle: 'Ostdeutsches Testprüfgesetz', abbr: 'TestPrG' }),
    { heading: 'Ostdeutsches Testprüfgesetz', longTitle: 'Gesetz über die Prüfung von Testfällen', abbr: 'TestPrG' },
  );
  assert.deepEqual(
    getNormTitleBlock({ title: 'Ostdeutsches Testprüfgesetz' }),
    { heading: 'Ostdeutsches Testprüfgesetz' },
    'ohne Kurzbezeichnung bleibt der Titel allein stehen',
  );
  assert.deepEqual(
    getNormTitleBlock({ title: 'Ostdeutsches Testprüfgesetz', shortTitle: 'Ostdeutsches Testprüfgesetz', abbr: 'Ostdeutsches Testprüfgesetz' }),
    { heading: 'Ostdeutsches Testprüfgesetz' },
    'Wiederholungen erzeugen weder eine zweite Zeile noch eine Abkürzung',
  );
});

test('die Identität einer Fassung kommt ohne Kurzbezeichnung der Norm aus', () => {
  const norm = record([version('geltend', '2026-01-01', null)]);
  const meta = { ...norm.meta, shortTitle: undefined, summary: 'Regelt die Prüfung von Testfällen.' };
  const identity = getNormVersionIdentity({ meta }, norm.versions[0]);
  assert.equal(identity.title, 'Testnorm');
  assert.equal(identity.shortTitle, 'Testnorm', 'ohne Kurzbezeichnung tritt der Titel an ihre Stelle');
  assert.equal(getNormTitleBlock(identity).longTitle, undefined);
});

test('abgeleitete Zusammenfassungen bleiben unveröffentlicht, redaktionelle nicht', () => {
  const base = record([version('geltend', '2026-01-01', null)]);
  const derived = {
    meta: { ...base.meta, summary: 'Enthält die Regelungen der am 1. November 2023 übernommenen Ausgangsfassung „Testnorm“.', summarySource: 'derived' as const },
  };
  assert.equal(getPublicNormSummary(getNormVersionIdentity(derived, base.versions[0])), undefined);
  const editorial = { meta: { ...base.meta, summary: 'Regelt die Prüfung von Testfällen und das Verfahren der Prüfstellen.' } };
  assert.equal(
    getPublicNormSummary(getNormVersionIdentity(editorial, base.versions[0])),
    'Regelt die Prüfung von Testfällen und das Verfahren der Prüfstellen.',
  );
  const overridden = { ...base.versions[0], summary: 'Beschreibt die Fassung dieser Vorschrift im Einzelnen.' };
  assert.equal(
    getPublicNormSummary(getNormVersionIdentity(derived, overridden)),
    'Beschreibt die Fassung dieser Vorschrift im Einzelnen.',
    'eine fassungseigene Zusammenfassung gilt als redaktionell',
  );
});

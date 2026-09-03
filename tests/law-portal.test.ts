import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildProvisionVersionDiff, buildStructuralVersionDiff, diffSentences, diffWords, summarizeNormDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import { renderNormDiffDocument } from '@ostrecht/shared/lib/norms/diff-render.ts';
import {
  LEGAL_BASELINE_DATE,
  classifyNormOriginVersion,
  getNormOriginInfo,
} from '@ostrecht/shared/lib/norms/origin.ts';
import { buildNormRelations } from '@ostrecht/shared/lib/norms/relations.ts';
import {
  getBlockAnchorId,
  getLegacyBlockAnchorId,
  parseCitation,
} from '@ostrecht/shared/lib/norms/presentation.ts';
import {
  getDefaultSearchSort,
  groupNormSearchResults,
  normalizeSearchText,
  parseNormSearchQuery,
  prepareSearchDocuments,
  runNormSearch,
  type NormSearchState,
} from '@ostrecht/recht-search/search-query.ts';
import { buildSearchSuggestionPayload, loadSearchIndexPayloadOnce } from '@ostrecht/recht-search/search-files.ts';
import { isAmendmentRecord, type SearchIndexDocument } from '@ostrecht/recht-search/search.ts';
import {
  findPublicationByDesignation,
  getLatestPublication,
  loadAllVerkuendungen,
} from '@ostrecht/shared/lib/norms/publications.ts';
import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
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
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';

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

test('historische und geltende Fassungen behalten ihre jeweilige öffentliche Bezeichnung', async () => {
  const norms = await loadAllNorms();
  const municipality = norms.find((norm) => norm.meta.slug === 'saechsische-gemeindeordnung');
  assert.ok(municipality);
  const historical = municipality.versions.find((version) => version.versionId === '2023-11-01');
  const current = municipality.versions.find((version) => version.versionId === '2026-08-01');
  assert.ok(historical);
  assert.ok(current);
  assert.equal(getNormVersionIdentity(municipality, historical).title, 'Sächsische Gemeindeordnung');
  assert.equal(getNormVersionIdentity(municipality, current).title, 'Gemeindeordnung für den Ostdeutschen Freistaat');
  assert.equal(historical.validTo, '2023-12-30');
  assert.equal(current.validFrom, '2026-08-01');
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

  assert.equal(getNormOriginInfo(original, [original]).kind, 'ostdeutsch-original');
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

test('Verfassung und Gemeindeordnung erfüllen die realen Herkunftsregressionen', async () => {
  const norms = await loadAllNorms();
  const constitution = norms.find((entry) => entry.meta.slug === 'staatsverfassung-des-freistaates-ostdeutschland');
  const municipality = norms.find((entry) => entry.meta.slug === 'saechsische-gemeindeordnung');
  assert.ok(constitution);
  assert.ok(municipality);

  const constitutionOrigin = getNormOriginInfo(constitution, norms);
  const municipalityOrigin = getNormOriginInfo(municipality, norms);
  assert.equal(constitutionOrigin.kind, 'ostdeutsch-original');
  assert.equal(constitutionOrigin.baselineVersionId, undefined);
  assert.equal(municipalityOrigin.kind, 'inherited-amended');
  assert.equal(municipalityOrigin.baselineVersionId, '2023-11-01');
  assert.equal(municipalityOrigin.ownAmendmentCount, 3);
  assert.ok(municipality.versions.some((entry) => entry.versionId === '2023-12-31'));
});

test('amtlich berichtigte Wortlaute und verbleibende Quellenkonflikte sind vollständig dokumentiert', () => {
  const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
  const archiveMeta = read('content/normen/archivgesetz/meta.json');
  const archiveBaseline = read('content/normen/archivgesetz/versions/2023-11-01.json');
  const archiveParagraphs = archiveBaseline.body.flatMap(function flatten(block: any): any[] {
    return [block, ...(block.children ?? []).flatMap(flatten)];
  }).filter((block: any) => block.type === 'paragraph');
  assert.deepEqual(
    archiveParagraphs.filter((block: any) => /^§ (?:1[7-9])$/u.test(block.label)).map((block: any) => [block.label, block.title]),
    [
      ['§ 17', 'Besondere Kategorien personenbezogener Daten'],
      ['§ 18', 'Einschränkung eines Grundrechts'],
      ['§ 19', 'Inkrafttreten'],
    ],
  );
  assert.equal(archiveParagraphs.filter((block: any) => block.label === '§ 17').length, 1);
  assert.equal(archiveMeta.editorialResolutions[0].status, 'resolved-source-conflict');

  const countyMeta = read('content/normen/saechsische-landkreisordnung/meta.json');
  const county2025 = read('content/normen/saechsische-landkreisordnung/versions/2025-03-12.json');
  const countyText = JSON.stringify(county2025.body);
  assert.match(countyText, /§ 65/u);
  assert.match(countyText, /der jeweilige Bezirk/u);
  assert.doesNotMatch(countyText, /§ 75/u);
  assert.equal(countyMeta.editorialResolutions, undefined);
  assert.ok(countyMeta.sourceReferences.some((reference: any) =>
    reference.localSource === 'Gesetze/OGVBl.2026Nr.68.html' && reference.sourceRole === 'amendment-evidence'
  ));

  const policeMeta = read('content/normen/ostdeutsches-polizeivollzugsdienstgesetz/meta.json');
  const police2026 = read('content/normen/ostdeutsches-polizeivollzugsdienstgesetz/versions/2026-03-24.json');
  const policeParagraphs = police2026.body.flatMap(function flatten(block: any): any[] {
    return [block, ...(block.children ?? []).flatMap(flatten)];
  }).filter((block: any) => block.type === 'paragraph');
  const labels = policeParagraphs.map((block: any) => block.label);
  assert.equal(labels.indexOf('§ 41a'), labels.indexOf('§ 41') + 1);
  assert.equal(labels[labels.indexOf('§ 41a') + 1], '§ 42');
  assert.equal(labels.includes('§ 32a'), false);
  assert.equal(policeMeta.editorialResolutions, undefined);
  assert.ok(policeMeta.sourceReferences.some((reference: any) =>
    reference.localSource === 'Gesetze/OGVBl.2026Nr.68.html' && reference.sourceRole === 'amendment-evidence'
  ));

  const districtMeta = read('content/normen/ostdeutsche-bezirksordnung/meta.json');
  assert.equal(districtMeta.editorialResolutions, undefined);
  assert.ok(districtMeta.sourceReferences.some((reference: any) =>
    reference.localSource === 'Gesetze/OGVBl.2026Nr.68.html' && reference.sourceRole === 'amendment-evidence'
  ));
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
    originLabel: 'Eigenständig neu geschaffen',
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
    resultLabel: 'Geltende Fassung',
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
  assert.equal(getDefaultSearchSort(searchState()), 'publication');
  assert.equal(getDefaultSearchSort(searchState({ q: 'Allgemeinverfügung' })), 'relevance');
  const browseResults = runNormSearch([olderAlphabetical, newer], searchState({ sort: 'publication', sortExplicit: false }));
  assert.deepEqual(browseResults.map((entry) => entry.documentEntry.slug), ['neu', 'alt']);
  const explicitResults = runNormSearch([olderAlphabetical, newer], searchState({
    q: 'verfügung', sort: 'publication', sortExplicit: true,
  }));
  assert.equal(explicitResults[0]?.documentEntry.slug, 'alt');
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

test('Rechtsübersichten und Suchindex verwenden dieselbe höchste Verkündung', async () => {
  const publications = await loadAllVerkuendungen();
  const latest = getLatestPublication(publications);
  const searchIndex = await loadSearchIndexPayloadOnce();
  assert.ok(latest);
  assert.deepEqual(searchIndex.latestPublication, {
    slug: latest.slug,
    date: latest.date,
    publication: latest.publication,
    year: latest.year,
    issue: latest.issue,
  });
  assert.ok(
    Buffer.byteLength(JSON.stringify(searchIndex)) < 20 * 1024 * 1024,
    'Der Suchindex muss ausreichend Abstand zur Cloudflare-Grenze von 25 MiB halten.',
  );
});

test('historische Verkündungsbezeichnung bleibt ein Such- und Lookupalias', async () => {
  const publications = await loadAllVerkuendungen();
  const searchIndex = await loadSearchIndexPayloadOnce();

  for (const designation of ['OABl. 2026 Nr. 2', 'StAnzO. 2026 Nr. 2']) {
    assert.equal(findPublicationByDesignation(publications, designation)?.slug, 'stanzo-2026-02');
    const results = runNormSearch(searchIndex.documents, searchState({ q: designation }));
    assert.equal(new Set(results.map(({ documentEntry }) => documentEntry.publicationSlug)).size, 1);
    assert.equal(results[0]?.documentEntry.publicationSlug, 'stanzo-2026-02');
  }

  assert.equal(findPublicationByDesignation(publications, 'OABl. 2025 Nr. 2')?.slug, 'oabl-2025-02');
});

test('feldbewusste Rechtssuche priorisiert reale Identitäten, Normtypen, Vorschriften und Fundstellen', async () => {
  const searchIndex = await loadSearchIndexPayloadOnce();
  const documents = prepareSearchDocuments(searchIndex.documents);
  const search = (q: string, overrides: Partial<NormSearchState> = {}) => runNormSearch(documents, searchState({
    q,
    sort: 'relevance',
    sortExplicit: false,
    ...overrides,
  }));
  const fundingSlug = 'forderrichtlinie-des-staatsministeriums-des-innern-bau-und-f-1honi23';

  // Mit dem vollständigen Rechtsbestand konkurrieren viele Förderrichtlinien um den
  // reinen Typbegriff; entscheidend ist, dass ausschließlich Förderrichtlinien
  // erscheinen und die bekannte Richtlinie darunter ist (`anyPosition`).
  const cases: Array<{ q: string; slug: string; anyPosition?: boolean; assertion?: (results: ReturnType<typeof search>) => void }> = [
    {
      q: 'Förderrichtlinie',
      slug: fundingSlug,
      anyPosition: true,
      assertion: (results) => assert.ok(results.every((result) => result.documentEntry.type === 'foerderrichtlinie')),
    },
    { q: 'FRL Landesbaukindergeld', slug: fundingSlug },
    { q: 'Landesbaukindergeld', slug: fundingSlug },
    { q: 'OstPVDG', slug: 'ostdeutsches-polizeivollzugsdienstgesetz' },
    {
      q: 'Polizeivollzugsdienst § 41a',
      slug: 'ostdeutsches-polizeivollzugsdienstgesetz',
      assertion: (results) => assert.equal(results[0]?.bestHitUnit?.label, '§ 41a'),
    },
    {
      q: 'Polizeivollzugsdienst §§ 41, 41a',
      slug: 'ostdeutsches-polizeivollzugsdienstgesetz',
      assertion: (results) => {
        assert.equal(results[0]?.bestHitUnit?.label, '§ 41');
        assert.equal(results[0]?.matchLabel, 'Treffer in §§ 41, 41a');
      },
    },
    {
      q: 'Polizeivollzugsdienst § 41a Abs. 2',
      slug: 'ostdeutsches-polizeivollzugsdienstgesetz',
      assertion: (results) => {
        assert.equal(results[0]?.bestHitUnit?.label, '§ 41a');
        assert.equal(results[0]?.bestHitUnit?.references?.paragraph, '41a');
        assert.ok(results[0]?.bestHitUnit?.references?.subsections?.includes('2'));
      },
    },
    {
      q: 'Foerderrichtlinie',
      slug: fundingSlug,
      anyPosition: true,
      assertion: (results) => assert.ok(results.every((result) => result.documentEntry.type === 'foerderrichtlinie')),
    },
    {
      q: 'OGVBl. 2026 Nr. 68',
      slug: 'berichtigung-verschiedener-verkuendungen-2026',
      assertion: (results) => assert.equal(results[0]?.documentEntry.publicationSlug, 'ogvbl-2026-68'),
    },
  ];

  for (const { q, slug, anyPosition, assertion } of cases) {
    const results = search(q);
    if (anyPosition) assert.ok(results.some((result) => result.documentEntry.slug === slug), q);
    else assert.equal(results[0]?.documentEntry.slug, slug, q);
    assertion?.(results);
  }

  const firstLawResults = search('erstes Gesetz');
  assert.ok(firstLawResults.length > 0);
  assert.match(firstLawResults[0]?.documentEntry.title ?? '', /^Erstes Gesetz/u);
  assert.ok(firstLawResults.some((result) => result.documentEntry.slug === 'erstes-gesetz-zur-grossen-staatsreform'));

  const exactAmendmentTitle = 'Erstes Gesetz zur Großen Staatsreform zum Zwecke der Neuordnung des Staatswesens';
  assert.equal(search(exactAmendmentTitle)[0]?.documentEntry.slug, 'erstes-gesetz-zur-grossen-staatsreform');

  const amendmentIntentResults = search('Änderungsvorschrift');
  assert.ok(amendmentIntentResults.length > 0);
  assert.ok(amendmentIntentResults.every((result) => result.documentEntry.type === 'aenderungsvorschrift'));

  const amendmentFacetResults = search('', { types: ['aenderungsvorschrift'] });
  assert.ok(amendmentFacetResults.length > 0);
  assert.ok(amendmentFacetResults.every((result) => result.documentEntry.type === 'aenderungsvorschrift'));

  const genericLawResults = search('Gesetz');
  assert.ok(genericLawResults.length > 0);
  assert.ok(genericLawResults.every((result) => !result.documentEntry.isAmendment));

  const typedFirstLawResults = search('erstes Gesetz', { types: ['gesetz'] });
  assert.ok(typedFirstLawResults.length > 0);
  assert.ok(typedFirstLawResults.every((result) => result.documentEntry.type === 'gesetz'));
  assert.ok(typedFirstLawResults.every((result) => !result.documentEntry.isAmendment));

  const historicalTitleState = searchState({
    q: 'Sächsische Gemeindeordnung',
    versionScope: 'all',
    sort: 'relevance',
    sortExplicit: false,
  });
  const historicalTitleResults = runNormSearch(documents, historicalTitleState);
  const municipalityGroup = groupNormSearchResults(historicalTitleResults, historicalTitleState)
    .find((group) => group.slug === 'saechsische-gemeindeordnung');
  assert.equal(municipalityGroup?.entries[0]?.documentEntry.title, 'Sächsische Gemeindeordnung');
  assert.equal(municipalityGroup?.entries[0]?.documentEntry.versionKind, 'historical');

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

test('Autocomplete enthält eine kanonische Suggestion je geltender Norm', async () => {
  const payload = await buildSearchSuggestionPayload();
  assert.equal(new Set(payload.suggestions.map((suggestion) => suggestion.slug)).size, payload.suggestions.length);
  const funding = payload.suggestions.find((suggestion) => suggestion.slug === 'forderrichtlinie-des-staatsministeriums-des-innern-bau-und-f-1honi23');
  assert.ok(funding);
  assert.equal(funding.abbr, 'FRL Landesbaukindergeld');
  assert.ok(funding.title.includes('Landesbaukindergeld'));
  const historical = payload.suggestions.find((suggestion) => suggestion.slug === 'saechsische-gemeindeordnung');
  assert.ok(historical?.aliases.includes('Sächsische Gemeindeordnung'));
  assert.equal(historical?.url.endsWith('/norm/saechsische-gemeindeordnung/'), true);
});

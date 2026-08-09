import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildStructuralVersionDiff, diffSentences, diffWords } from '../src/lib/norms/diff.ts';
import {
  getBlockAnchorId,
  getLegacyBlockAnchorId,
  parseCitation,
} from '../src/lib/norms/presentation.ts';
import {
  normalizeSearchText,
  runNormSearch,
  type NormSearchState,
} from '../src/lib/norms/search-query.ts';
import {
  buildSearchIndexPayload,
  isAmendmentRecord,
  type SearchIndexDocument,
} from '../src/lib/norms/search.ts';
import { getLatestPublication, loadAllVerkuendungen } from '../src/lib/norms/publications.ts';
import {
  ContentValidationError,
  parseNormMeta,
  type NormRecord,
  type NormVersion,
} from '../src/lib/norms/schema.ts';
import {
  classifyNormVersion,
  getApplicableVersion,
  validateVersionIntervals,
} from '../src/lib/norms/versions.ts';

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

test('redaktionell aufgelöste Quellenkonflikte sind vollständig und maschinenlesbar dokumentiert', () => {
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
  assert.equal(countyMeta.editorialResolutions[0].resolvedApplication.includes('§ 65'), true);

  const policeMeta = read('content/normen/ostdeutsches-polizeivollzugsdienstgesetz/meta.json');
  const police2026 = read('content/normen/ostdeutsches-polizeivollzugsdienstgesetz/versions/2026-03-24.json');
  const policeParagraphs = police2026.body.flatMap(function flatten(block: any): any[] {
    return [block, ...(block.children ?? []).flatMap(flatten)];
  }).filter((block: any) => block.type === 'paragraph');
  const labels = policeParagraphs.map((block: any) => block.label);
  assert.equal(labels.indexOf('§ 41a'), labels.indexOf('§ 41') + 1);
  assert.equal(labels[labels.indexOf('§ 41a') + 1], '§ 42');
  assert.equal(labels.includes('§ 32a'), false);
  assert.equal(policeMeta.editorialResolutions[0].status, 'resolved-source-conflict');

  const districtMeta = read('content/normen/ostdeutsche-bezirksordnung/meta.json');
  assert.equal(districtMeta.editorialResolutions[0].status, 'resolved-source-conflict');
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
    bodyText: 'Die Straße dient der Krankenhausversorgung.',
    contexts: ['Die Straße dient der Krankenhausversorgung.'],
    hitUnits: [],
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
  assert.equal(runNormSearch(documents, searchState()).some((entry) => entry.documentEntry.isAmendment), false);
  assert.equal(runNormSearch(documents, searchState({ includeAmendments: true })).length, 3);
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
  const searchIndex = await buildSearchIndexPayload();
  assert.ok(latest);
  assert.equal(latest.slug, 'ogvbl-2026-59');
  assert.deepEqual(searchIndex.latestPublication, {
    slug: latest.slug,
    date: latest.date,
    publication: latest.publication,
    year: latest.year,
    issue: latest.issue,
  });
});

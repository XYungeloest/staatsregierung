import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSearchDocument } from '@ostrecht/recht-search/search.ts';
import type { NormSearchState } from '@ostrecht/recht-search/search-query.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';
import { isInheritedAmendment } from '@ostrecht/shared/lib/norms/inventory.ts';

import { assembleBlocks, createFileNormStore, selectedVersionIds, type NormSummary } from '../apps/recht/src/lib/runtime/store.ts';
import { FIXTURE_REFERENCE_DATE, fixtureCorpus } from './helpers/fixture-corpus.ts';

/**
 * Verhalten der Dateivariante des Norm-Stores (Übersichten, Filter, Paginierung, Kandidaten)
 * auf dem synthetischen Fixture-Bestand: dieselben Vertragsprüfungen wie die D1-Variante
 * (tests/recht-runtime-d1-queries.test.ts), aber mit gerechneten statt aufgezeichneten Ergebnissen.
 */
const { norms, publications } = fixtureCorpus();
const store = createFileNormStore({ loadAllNorms: async () => norms, loadAllVerkuendungen: async () => publications, buildSearchDocument });
/**
 * Grundmenge des Fixtures: alles außer den übernommenen Änderungsvorschriften. Verzeichnisse,
 * A–Z, Sachgebiete und Bestandszahlen beschreiben sie; die Erwartungen werden aus dem Bestand
 * gerechnet, nicht als Zahl geschrieben.
 */
const allSummaries = (): Promise<NormSummary[]> => store.listNormSummaries({ includeInheritedAmendments: true });
const inventorySize = (list: NormSummary[]): number => list.filter((summary) => !isInheritedAmendment(summary)).length;

test('Übersichtszeilen, Normen mit gewünschten Körpern, Ableitungen und Verkündungen', async () => {
  const summaries = await store.listNormSummaries();
  const everything = await allSummaries();
  assert.equal(everything.length, norms.length);
  // Übernommene Änderungsvorschriften stehen nicht neben den Stammnormen.
  assert.equal(summaries.length, inventorySize(everything));
  assert.ok(summaries.length < everything.length, 'das Fixture führt mindestens eine übernommene Änderungsvorschrift');
  assert.ok(summaries.every((summary) => !isInheritedAmendment(summary)));
  assert.ok(summaries.every((summary) => summary.slug && summary.title && summary.type && summary.currentVersionId));
  // Der Normtypfilter holt sie zurück, sonst bliebe er ohne Treffer.
  const amendments = await store.listNormSummaries({ types: ['aenderungsvorschrift'] });
  assert.ok(amendments.some((summary) => isInheritedAmendment(summary)));
  const regulations = await store.listNormSummariesByType('verordnung');
  assert.ok(regulations.length > 0);
  assert.deepEqual(regulations.map((summary) => summary.slug), summaries.filter((summary) => summary.type === 'verordnung').map((summary) => summary.slug));
  const amended = (await store.getNormSummaries(['testgesetz', 'gibt-es-nicht'])).get('testgesetz');
  assert.ok(amended?.sortWord && amended.sortKey === amended.sortKey.toLocaleLowerCase('de'), 'Ordnungswort und Vergleichsschlüssel stehen in der Übersichtszeile');
  assert.ok(amended);
  assert.equal(amended.originKind, 'inherited-amended');
  assert.equal(amended.versionCount, 2);
  const versionSummaries = await store.listVersionSummaries({ slugs: ['testgesetz'] });
  assert.equal(versionSummaries.length, amended.versionCount);
  assert.ok(versionSummaries.some((version) => version.temporalKind === 'current'));

  const current = await store.getNorm('testgesetz', 'current');
  assert.ok(current);
  assert.deepEqual(current.versions.filter((version) => version.body.length > 0).map((version) => version.versionId), ['2026-03-25']);
  const all = await store.getNorm('testgesetz', 'all');
  assert.ok(all && all.versions.every((version) => version.body.length > 0));
  const specific = await store.getNorm('testgesetz', ['2023-11-01']);
  assert.deepEqual(specific?.versions.filter((version) => version.body.length > 0).map((version) => version.versionId), ['2023-11-01']);
  assert.equal(await store.getNorm('gibt-es-nicht'), null);

  const derived = await store.getDerived('testgesetz');
  assert.ok(derived);
  assert.equal(derived.origin.kind, 'inherited-amended');
  assert.ok(derived.relations.some((relation) => relation.kind === 'amended-by'));
  assert.ok(derived.recommendations.length <= 5);
  assert.ok(derived.textReferences.every((reference) => typeof reference.label === 'string' && reference.label.length >= 3));

  const citation = await store.getFullCitation('testgesetz', '2023-11-01');
  assert.match(citation ?? '', /Testgesetz/u);
  const listed = await store.listPublications();
  assert.equal(listed.length, publications.length);
  assert.equal((await store.listPublications({ limit: 3 })).length, 3);
  assert.equal((await store.getPublication(listed[0].slug))?.slug, listed[0].slug);
  const labels = await store.getNormLabels(['testgesetz', 'gibt-es-nicht']);
  assert.equal(labels.size, 1);
});

test('Übersichtsdaten: Änderungen, Sachgebiete, Bestandszahlen, Vorschläge, Suchfilter', async () => {
  const changes = await store.listChanges({ changeTypes: ['amendment', 'repeal'], until: '2026-12-31', order: 'desc', limit: 5 });
  assert.ok(changes.length > 0 && changes.length <= 5);
  assert.ok(changes.every((change, index) => index === 0 || changes[index - 1].date >= change.date));
  assert.ok(changes.every((change) => ['amendment', 'repeal'].includes(change.changeType) && change.normShortTitle));
  assert.deepEqual(await store.listChanges({ changeTypes: ['amendment'], after: '2099-01-01', order: 'asc', limit: 3 }), []);
  const subjects = await store.listSubjectSummaries();
  const areas = await store.listSubjectAreas();
  const stats = await store.getCorpusStats();
  const summaries = await store.listNormSummaries();
  assert.equal(subjects.reduce((sum, subject) => sum + subject.normCount, 0), summaries.reduce((sum, summary) => sum + new Set(summary.subjects).size, 0));
  assert.ok(areas.length > 0 && areas.every((area) => area.subjects.length > 0));
  // Sachgebiete tragen ihre amtliche Nummer und stehen in der Reihenfolge der Systematik.
  assert.ok(subjects.every((subject) => /^\d{2}$/u.test(subject.number ?? '')));
  assert.deepEqual(subjects.map((subject) => subject.number), [...subjects.map((subject) => subject.number)].sort());
  assert.ok(areas.every((area) => /^\d$/u.test(area.number ?? '') && area.subjects.every((subject) => subject.number?.startsWith(area.number ?? ''))));
  assert.equal(stats.normCount, summaries.length);
  assert.equal(stats.inForceCount, summaries.filter((summary) => summary.status === 'in-force').length);
  assert.equal(stats.normCount + stats.inheritedAmendmentCount, norms.length, 'Grundmenge und übernommene Änderungsvorschriften ergeben den Bestand');
  const bySubject = await store.listNormSummaries({ subjectSlug: subjects[0].slug });
  assert.equal(bySubject.length, subjects[0].normCount);
  const suggestions = await store.listSearchSuggestions();
  assert.ok(suggestions.some((suggestion) => suggestion.slug === 'testgesetz'));
  const { filters, documentCount } = await store.getSearchFilters();
  assert.ok(filters.types.length > 0);
  // Die Suche kennt alle Fassungen, auch die der übernommenen Änderungsvorschriften.
  assert.equal(documentCount, (await allSummaries()).reduce((sum, summary) => sum + summary.versionCount, 0));
  assert.equal((await store.listSearchPublications()).length, publications.length);
});

test('Aktuelle Änderungen: Erlass zählt, je Norm nur das jüngste Ereignis, künftige Ereignisse bleiben draußen', async () => {
  const asOf = FIXTURE_REFERENCE_DATE;
  const latest = await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], until: asOf, order: 'desc', limit: 20, distinctNorms: true });
  assert.ok(latest.length > 0);
  assert.ok(latest.every((change) => change.date <= asOf), 'kein künftiges Ereignis in der aktuellen Liste');
  assert.ok(latest.every((change, index) => index === 0 || latest[index - 1].date >= change.date), 'absteigend nach Ereignisdatum');
  assert.equal(new Set(latest.map((change) => change.slug)).size, latest.length, 'jede Norm höchstens einmal');
  const newLaw = latest.find((change) => change.slug === 'neues-ostgesetz');
  assert.equal(newLaw?.changeType, 'initial', 'der Erlass einer neuen Vorschrift ist ein Rechtsereignis');
  assert.equal(latest[0].date, '2026-09-03');
  assert.ok(!latest.some((change) => change.slug === 'kuenftiges-gesetz'));
  const slugs = latest.map((change) => change.slug);
  assert.ok(slugs.indexOf('testverordnung') > slugs.indexOf('neues-ostgesetz'), 'unverändert übernommenes Recht steht hinter neuen Erlassen');
  const upcoming = await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], after: asOf, order: 'asc', limit: 12, distinctNorms: true });
  assert.ok(upcoming.every((change) => change.date > asOf));
  assert.ok(upcoming.some((change) => change.slug === 'kuenftiges-gesetz'));
  assert.ok(upcoming.every((change, index) => index === 0 || upcoming[index - 1].date <= change.date));
  const all = await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], until: asOf, order: 'desc', limit: 400 });
  assert.ok(all.length > new Set(all.map((change) => change.slug)).size, 'ohne distinctNorms bleiben mehrere Ereignisse derselben Norm erhalten');
});

test('Übersichten ohne Suchbegriff: jüngstes Rechtsereignis zuerst (wie D1), A–Z alphabetisch', async () => {
  const page = await store.queryNormSummaries({ sort: 'activity', page: 1, pageSize: 50 });
  const dates = page.items.map((item) => item.lastChangeDate ?? '');
  assert.ok(dates.every((date, index) => index === 0 || dates[index - 1] >= date), 'absteigend nach jüngstem Rechtsereignis');
  assert.equal(dates[0], '2026-09-03');
  assert.ok(page.items.every((item) => !item.lastChangeDate || item.lastChangeDate <= FIXTURE_REFERENCE_DATE), 'keine künftigen Ereignisse als bereits erfolgt');
  const dated = page.items.filter((item) => item.lastChangeDate);
  assert.equal(dated.at(-1)?.originKind, 'inherited-unchanged', 'unverändert übernommenes Recht steht am Ende');
  const filtered = await store.queryNormSummaries({ sort: 'activity', types: ['gesetz'], page: 1, pageSize: 20 });
  assert.ok(filtered.items.length > 0 && filtered.items.every((item) => item.type === 'gesetz'));
  assert.ok(filtered.items.every((item, index) => index === 0 || (filtered.items[index - 1].lastChangeDate ?? '') >= (item.lastChangeDate ?? '')));
  // Buchstabengruppe zur Laufzeit wählen: die Einordnung folgt dem Ordnungswort, nicht dem Titel.
  const letters = await store.listIndexLetters();
  const filled = letters.find((entry) => entry.count > 1) ?? letters[0];
  const alphabetical = await store.queryNormSummaries({ letter: filled.letter, page: 1, pageSize: 20 });
  assert.equal(alphabetical.total, filled.count);
  assert.ok(alphabetical.items.every((item) => getGermanIndexLetter(item.sortWord) === filled.letter));
  assert.ok(alphabetical.items.every((item, index) => index === 0 || alphabetical.items[index - 1].sortKey <= item.sortKey));
  const candidates = await store.searchCandidates({ match: null, limit: 50, offset: 0 });
  // Die Kandidatenmenge der Suche ist nicht die Grundmenge der Verzeichnisse; verglichen wird die
  // Reihenfolge über denselben Bestand.
  const everything = await store.queryNormSummaries({ sort: 'activity', includeInheritedAmendments: true, page: 1, pageSize: 50 });
  assert.deepEqual(candidates.slugs, everything.items.map((item) => item.slug), 'Kandidaten ohne Suchausdruck in derselben Reihenfolge wie die Übersicht');
});

test('Buchstabenzähler eines Verzeichnisses folgen dem Normtyp- bzw. Sachgebietsfilter', async () => {
  const all = await store.listIndexLetters();
  const laws = await store.listIndexLetters({ types: ['gesetz'] });
  const lawSummaries = await store.listNormSummariesByType('gesetz');
  assert.equal(laws.reduce((sum, entry) => sum + entry.count, 0), lawSummaries.length);
  assert.ok(laws.every((entry) => (all.find((total) => total.letter === entry.letter)?.count ?? 0) >= entry.count));
  for (const entry of laws) {
    const page = await store.queryNormSummaries({ types: ['gesetz'], letter: entry.letter, pageSize: 100 });
    assert.equal(page.total, entry.count, `Buchstabe ${entry.letter}`);
  }
  const subject = (await store.listSubjectSummaries())[0];
  const bySubject = await store.listIndexLetters({ subjectSlug: subject.slug });
  assert.equal(bySubject.reduce((sum, entry) => sum + entry.count, 0), subject.normCount);
});

test('Suchkandidaten und Suchdokumente entsprechen dem Suchindexformat; der Herkunftsfilter wirkt serverseitig', async () => {
  const { slugs, total } = await store.searchCandidates({ match: '("bestattung"*)', limit: 10, offset: 0 });
  assert.ok(slugs.includes('testverordnung'));
  assert.ok(total >= slugs.length);
  const [candidate] = await store.getSearchDocuments(['testverordnung'], null);
  assert.equal(candidate.document.slug, 'testverordnung');
  assert.ok(candidate.units.length > 0);
  const typed = await store.searchCandidates({ match: null, limit: 5, offset: 0, types: ['verordnung'] });
  assert.ok(typed.slugs.length > 0);
  const all = await store.searchCandidates({ match: null, limit: 1000, offset: 0 });
  const originals = await store.searchCandidates({ match: null, limit: 1000, offset: 0, origins: ['ostdeutsch-original'] });
  const inherited = await store.searchCandidates({ match: null, limit: 1000, offset: 0, origins: ['inherited-unchanged', 'inherited-amended'] });
  const unresolved = await store.searchCandidates({ match: null, limit: 1000, offset: 0, origins: ['origin-unresolved'] });
  assert.ok(originals.total > 0 && originals.total < all.total);
  assert.equal(originals.slugs.length, originals.total);
  // Die vier Herkunftsarten zerlegen den Bestand vollständig und überschneidungsfrei.
  assert.ok(unresolved.total > 0, 'der Bestand enthält eine Norm ungeklärter Herkunft');
  assert.equal(originals.total + inherited.total + unresolved.total, all.total);
  // Die Suche kennt auch die übernommenen Änderungsvorschriften; die Zuordnung nutzt den vollen Bestand.
  const summariesBySlug = new Map((await allSummaries()).map((summary) => [summary.slug, summary]));
  assert.ok(originals.slugs.every((slug) => summariesBySlug.get(slug)?.originKind === 'ostdeutsch-original'));
  assert.ok(inherited.slugs.every((slug) => summariesBySlug.get(slug)?.originKind?.startsWith('inherited-')));
  const searched = await store.searchCandidates({ match: '("testgesetz"*)', limit: 10, offset: 0, origins: ['ostdeutsch-original'] });
  assert.ok(!searched.slugs.includes('testgesetz'), 'übernommene Norm fällt beim Filter auf ostdeutsch-original heraus');
  assert.ok(searched.slugs.includes('aenderungsgesetz-testgesetz'));
});

/** Suchzustand der Dateivariante; sie bewertet mit derselben Logik wie die Anzeige. */
function searchState(overrides: Partial<NormSearchState> = {}): NormSearchState {
  return {
    q: '', exclude: '', exact: '', scope: 'all', types: [], ministries: [], subjects: [], statuses: [], origins: [],
    versionScope: 'current', includeAmendments: false, geltungstag: '', validFrom: '', validTo: '', citation: '',
    publicationSources: [], publicationYears: [], publicationIssue: '', publicationPage: '',
    sort: 'activity', sortExplicit: false, ...overrides,
  };
}

test('Trefferseite, Gesamtzahl und Facettenzähler der Dateivariante beschreiben dieselbe Menge', async () => {
  const state = searchState();
  const all = await store.searchCandidates({ match: null, limit: 500, offset: 0, state });
  assert.equal(all.slugs.length, all.total, 'die Gesamtzahl zählt genau die gelieferten Vorschriften');
  assert.equal(new Set(all.slugs).size, all.slugs.length, 'jede Vorschrift steht einmal in der Liste');
  const first = await store.searchCandidates({ match: null, limit: 5, offset: 0, state });
  const second = await store.searchCandidates({ match: null, limit: 5, offset: 5, state });
  assert.equal(first.total, all.total);
  assert.deepEqual([...first.slugs, ...second.slugs], all.slugs.slice(0, 10), 'echtes Blättern ohne Lücken und Doppelungen');

  const facets = await store.countSearchFacets({ match: null, limit: 5, offset: 0, state });
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, count) => total + count, 0);
  assert.equal(sum(facets.type), all.total, 'jede Vorschrift trägt genau einen Normtyp');
  assert.equal(sum(facets.origin), all.total, 'die Herkunftsarten zerlegen die Treffermenge');
  assert.ok(sum(facets.subject) >= all.total, 'eine Vorschrift kann mehreren Sachgebieten angehören');

  // Grundmenge: übernommene Änderungsvorschriften kommen erst mit dem Häkchen hinzu.
  const withAmendments = await store.searchCandidates({ match: null, limit: 500, offset: 0, state: searchState({ includeAmendments: true }) });
  assert.ok(withAmendments.total > all.total, 'das Häkchen erweitert die Menge');

  // Identität zuerst: die Abkürzung einer Vorschrift führt sie an die Spitze der Trefferliste.
  const identity = await store.searchCandidates({ match: '("osttestg"*)', limit: 20, offset: 0, state: searchState({ q: 'OstTestG', sort: 'relevance' }) });
  assert.equal(identity.slugs[0], 'testgesetz');
});

test('Body-Blöcke werden aus Teilen in Reihenfolge zusammengesetzt', () => {
  const block = { type: 'paragraph', label: '§ 1', children: [{ type: 'paragraphText', text: 'x'.repeat(50) }] };
  const json = JSON.stringify(block);
  const rows = [
    { block_index: 1, part_index: 0, block_json: '{"type":"annex","label":"Anlage","children":[]}' },
    { block_index: 0, part_index: 1, block_json: json.slice(30) },
    { block_index: 0, part_index: 0, block_json: json.slice(0, 30) },
  ];
  assert.deepEqual(assembleBlocks(rows), [block, { type: 'annex', label: 'Anlage', children: [] }]);
  const record = { versions: [{ versionId: 'a', isCurrent: false }, { versionId: 'b', isCurrent: true }] } as never;
  assert.deepEqual([...selectedVersionIds(record, 'current')], ['b']);
  assert.deepEqual([...selectedVersionIds(record, 'all')], ['a', 'b']);
  assert.deepEqual([...selectedVersionIds(record, ['a'])], ['a']);
  assert.deepEqual([...selectedVersionIds(record, 'none')], []);
});

test('seitenweise Übersichten mit Buchstaben-, Freitext-, Herkunfts- und Sachgebietsfilter sowie Stichwortindex', async () => {
  const letters = await store.listIndexLetters();
  // Eine Buchstabengruppe mit mehreren Seiten wird zur Laufzeit bestimmt, nicht angenommen.
  const group = letters.find((entry) => entry.count > 2) ?? letters[0];
  assert.ok(group.count > 0);
  assert.equal(letters.reduce((sum, entry) => sum + entry.count, 0), inventorySize(await allSummaries()));
  const first = await store.queryNormSummaries({ letter: group.letter, page: 1, pageSize: 2 });
  assert.equal(first.pageSize, 2);
  assert.ok(first.items.length <= 2);
  assert.ok(first.items.every((summary) => getGermanIndexLetter(summary.sortWord) === group.letter));
  assert.equal(first.total, group.count);
  assert.equal(first.pageCount, Math.ceil(first.total / 2));
  const second = await store.queryNormSummaries({ letter: group.letter, page: 2, pageSize: 2 });
  assert.ok(second.items.length > 0);
  assert.ok(second.items.every((summary) => !first.items.some((entry) => entry.slug === summary.slug)), 'Seiten überschneiden sich nicht');
  const beyond = await store.queryNormSummaries({ letter: group.letter, page: 999, pageSize: 2 });
  assert.equal(beyond.page, beyond.pageCount, 'zu große Seite fällt auf die letzte zurück');
  const text = await store.queryNormSummaries({ q: 'testgesetz' });
  assert.ok(text.items.some((summary) => summary.slug === 'testgesetz'));
  assert.ok(text.items.every((summary) => [summary.title, summary.shortTitle, summary.abbr ?? '', ...summary.keywords].join(' ').toLocaleLowerCase('de-DE').includes('testgesetz')));
  const origin = await store.queryNormSummaries({ originKind: 'ostdeutsch-original', pageSize: 100 });
  assert.ok(origin.total > 0);
  assert.ok(origin.items.every((summary) => summary.originKind === 'ostdeutsch-original'));
  const counts = await store.countByOriginKind();
  assert.equal(counts['ostdeutsch-original'], origin.total);
  const subject = (await store.listNormSummaries())[0].subjects[0];
  const bySubject = await store.queryNormSummaries({ subject, pageSize: 100 });
  assert.ok(bySubject.total > 0);
  assert.ok(bySubject.items.every((summary) => summary.subjects.includes(subject)));
  const keywords = await store.listKeywordIndex('T', { pageSize: 2 });
  assert.ok(keywords.entries.length > 0 && keywords.entries.length <= 2);
  assert.ok(keywords.total > keywords.entries.length);
  assert.equal(keywords.pageCount, Math.ceil(keywords.total / 2));
  assert.ok(keywords.entries.every((entry) => getGermanIndexLetter(entry.keyword) === 'T' && entry.norms.length > 0));
  assert.deepEqual(keywords.entries.map((entry) => entry.keyword), [...keywords.entries.map((entry) => entry.keyword)].sort((left, right) => left.localeCompare(right, 'de')));
  const filtered = await store.listKeywordIndex('T', { q: 'kindergeld' });
  assert.ok(filtered.total > 0);
  assert.ok(filtered.entries.every((entry) => entry.keyword.toLocaleLowerCase('de-DE').includes('kindergeld')));
  const secondPage = await store.listKeywordIndex('T', { pageSize: 2, page: 2 });
  assert.ok(secondPage.entries.length > 0);
  assert.ok(secondPage.entries.every((entry) => !keywords.entries.some((first) => first.keyword === entry.keyword)), 'Stichwortseiten überschneiden sich nicht');
});

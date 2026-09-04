import assert from 'node:assert/strict';
import test from 'node:test';

import { loadNormsOnce as loadAllNorms } from './helpers/corpus.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { buildSearchDocument } from '@ostrecht/recht-search/search.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';

import { assembleBlocks, createFileNormStore, selectedVersionIds } from '../apps/recht/src/lib/runtime/store.ts';

const store = createFileNormStore({ loadAllNorms, loadAllVerkuendungen, buildSearchDocument });

test('Dateivariante des Stores liefert Übersichtszeilen, Normen mit gewünschten Körpern, Ableitungen und Verkündungen', async () => {
  const summaries = await store.listNormSummaries();
  assert.ok(summaries.length > 100);
  assert.ok(summaries.every((summary) => summary.slug && summary.title && summary.type && summary.currentVersionId));
  const regulations = await store.listNormSummariesByType('verordnung');
  assert.ok(regulations.length > 0);
  assert.deepEqual(regulations.map((summary) => summary.slug), summaries.filter((summary) => summary.type === 'verordnung').map((summary) => summary.slug));
  const feiertagSummary = (await store.getNormSummaries(['ostdeutsches-feiertagsgesetz', 'gibt-es-nicht'])).get('ostdeutsches-feiertagsgesetz');
  assert.ok(feiertagSummary);
  assert.equal(feiertagSummary.originKind, 'inherited-amended');
  assert.ok(feiertagSummary.versionCount > 1);
  const versionSummaries = await store.listVersionSummaries({ slugs: ['ostdeutsches-feiertagsgesetz'] });
  assert.equal(versionSummaries.length, feiertagSummary.versionCount);
  assert.ok(versionSummaries.some((version) => version.temporalKind === 'current'));

  const feiertag = await store.getNorm('ostdeutsches-feiertagsgesetz', 'current');
  assert.ok(feiertag);
  const currentBodies = feiertag.versions.filter((version) => version.body.length > 0);
  assert.equal(currentBodies.length, 1);
  const all = await store.getNorm('ostdeutsches-feiertagsgesetz', 'all');
  assert.ok(all && all.versions.every((version) => version.body.length > 0));
  const specific = await store.getNorm('ostdeutsches-feiertagsgesetz', ['2023-11-01']);
  assert.deepEqual(specific?.versions.filter((version) => version.body.length > 0).map((version) => version.versionId), ['2023-11-01']);
  assert.equal(await store.getNorm('gibt-es-nicht'), null);

  const derived = await store.getDerived('ostdeutsches-feiertagsgesetz');
  assert.ok(derived);
  assert.equal(derived.origin.kind, 'inherited-amended');
  assert.ok(Array.isArray(derived.relations));
  assert.ok(derived.recommendations.length <= 5);
  assert.ok(derived.textReferences.every((reference) => typeof reference.label === 'string' && reference.label.length >= 3));

  const citation = await store.getFullCitation('ostdeutsches-feiertagsgesetz', '2023-11-01');
  assert.match(citation ?? '', /Sonn- und Feiertage/u);
  const publications = await store.listPublications();
  assert.ok(publications.length > 0);
  assert.equal((await store.listPublications({ limit: 3 })).length, 3);
  assert.equal((await store.getPublication(publications[0].slug))?.slug, publications[0].slug);
  const labels = await store.getNormLabels(['ostdeutsches-feiertagsgesetz', 'gibt-es-nicht']);
  assert.equal(labels.size, 1);
});

test('Übersichtsdaten der Dateivariante: Änderungen, Sachgebiete, Bestandszahlen, Vorschläge, Suchfilter', async () => {
  const changes = await store.listChanges({ changeTypes: ['amendment', 'repeal'], until: '2026-12-31', order: 'desc', limit: 5 });
  assert.ok(changes.length > 0 && changes.length <= 5);
  assert.ok(changes.every((change, index) => index === 0 || changes[index - 1].date >= change.date));
  assert.ok(changes.every((change) => ['amendment', 'repeal'].includes(change.changeType) && change.normShortTitle));
  const upcoming = await store.listChanges({ changeTypes: ['amendment'], after: '2099-01-01', order: 'asc', limit: 3 });
  assert.deepEqual(upcoming, []);
  const subjects = await store.listSubjectSummaries();
  const areas = await store.listSubjectAreas();
  const stats = await store.getCorpusStats();
  const summaries = await store.listNormSummaries();
  assert.equal(subjects.reduce((sum, subject) => sum + subject.normCount, 0), summaries.reduce((sum, summary) => sum + new Set(summary.subjects).size, 0));
  assert.ok(areas.length > 0 && areas.every((area) => area.subjects.length > 0));
  assert.equal(stats.normCount, summaries.length);
  assert.equal(stats.inForceCount, summaries.filter((summary) => summary.status === 'in-force').length);
  const bySubject = await store.listNormSummaries({ subjectSlug: subjects[0].slug });
  assert.equal(bySubject.length, subjects[0].normCount);
  const suggestions = await store.listSearchSuggestions();
  assert.ok(suggestions.some((suggestion) => suggestion.slug === 'ostdeutsches-feiertagsgesetz'));
  const { filters, documentCount } = await store.getSearchFilters();
  assert.ok(filters.types.length > 0);
  assert.equal(documentCount, summaries.reduce((sum, summary) => sum + summary.versionCount, 0));
  const searchPublications = await store.listSearchPublications();
  assert.equal(searchPublications.length, (await store.listPublications()).length);
});

test('Aktuelle Änderungen: Erlass neuer Vorschriften zählt, je Norm nur das jüngste Ereignis, künftige Ereignisse bleiben draußen, neue Gesetze vor alten Schulverordnungen', async () => {
  const asOf = '2026-09-04';
  const latest = await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], until: asOf, order: 'desc', limit: 20, distinctNorms: true });
  assert.ok(latest.length > 0);
  assert.ok(latest.every((change) => change.date <= asOf), 'kein künftiges Ereignis in der aktuellen Liste');
  assert.ok(latest.every((change, index) => index === 0 || latest[index - 1].date >= change.date), 'absteigend nach Ereignisdatum');
  assert.equal(new Set(latest.map((change) => change.slug)).size, latest.length, 'jede Norm höchstens einmal');
  const slugs = latest.map((change) => change.slug);
  // Die am 2./3. September 2026 erlassenen ostdeutschen Gesetze stehen vor den am 1. September 2026 geänderten Schulverordnungen.
  for (const slug of ['interflug-gesetz', 'zinnwald-vergesellschaftungsgesetz', 'ostdeutsches-daseinsvorsorgegesetz', 'ostdeutsches-hoheitszeichengesetz']) {
    assert.ok(slugs.includes(slug), `${slug} unter den jüngsten Rechtsereignissen`);
    assert.equal(latest.find((change) => change.slug === slug)?.changeType, 'initial');
  }
  assert.equal(latest[0].date, '2026-09-03');
  const schoolIndex = slugs.indexOf('pruefungsverordnung-waldorfschulen');
  const interflugIndex = slugs.indexOf('interflug-gesetz');
  assert.ok(schoolIndex === -1 || schoolIndex > interflugIndex, 'Schulverordnung vom 1. September 2026 nach dem Interflug-Gesetz');
  const upcoming = await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], after: asOf, order: 'asc', limit: 12, distinctNorms: true });
  assert.ok(upcoming.every((change) => change.date > asOf));
  assert.ok(upcoming.every((change, index) => index === 0 || upcoming[index - 1].date <= change.date));
  assert.equal(new Set(upcoming.map((change) => change.slug)).size, upcoming.length);
  // Ohne distinctNorms bleiben mehrere Ereignisse derselben Norm erhalten.
  const all = await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], until: asOf, order: 'desc', limit: 400 });
  assert.ok(all.length > new Set(all.map((change) => change.slug)).size);
});

test('Übersichten ohne Suchbegriff: jüngstes Rechtsereignis zuerst (Dateivariante wie D1), A–Z alphabetisch', async () => {
  const page = await store.queryNormSummaries({ sort: 'activity', page: 1, pageSize: 50 });
  const dates = page.items.map((item) => item.lastChangeDate ?? '');
  assert.ok(dates.every((date, index) => index === 0 || dates[index - 1] >= date), 'absteigend nach jüngstem Rechtsereignis');
  assert.ok(dates[0] >= '2026-09-01', `jüngstes Ereignis ${dates[0]} auf der ersten Seite`);
  assert.ok(page.items.every((item) => !item.lastChangeDate || item.lastChangeDate <= '2026-09-04'), 'keine künftigen Ereignisse als bereits erfolgt');
  const unchanged = page.items.find((item) => item.originKind === 'inherited-unchanged');
  assert.equal(unchanged, undefined, 'unverändert übernommene Normen stehen nicht auf der ersten Seite');
  const filtered = await store.queryNormSummaries({ sort: 'activity', types: ['gesetz'], page: 1, pageSize: 20 });
  assert.ok(filtered.items.every((item) => item.type === 'gesetz'));
  assert.ok(filtered.items.every((item, index) => index === 0 || (filtered.items[index - 1].lastChangeDate ?? '') >= (item.lastChangeDate ?? '')));
  const alphabetical = await store.queryNormSummaries({ letter: 'G', page: 1, pageSize: 20 });
  assert.ok(alphabetical.items.every((item, index) => index === 0 || alphabetical.items[index - 1].title.toLocaleLowerCase('de').localeCompare(item.title.toLocaleLowerCase('de'), 'de') <= 0));
  const candidates = await store.searchCandidates({ match: null, limit: 20, offset: 0 });
  const summaries = await store.getNormSummaries(candidates.slugs);
  const candidateDates = candidates.slugs.map((slug) => summaries.get(slug)?.lastChangeDate ?? '');
  assert.ok(candidateDates.every((date, index) => index === 0 || candidateDates[index - 1] >= date), 'Kandidaten ohne Suchausdruck nach jüngstem Rechtsereignis');
  assert.ok(candidateDates[0] >= '2026-09-01');
});

test('Suchkandidaten und Suchdokumente der Dateivariante entsprechen dem Suchindexformat', async () => {
  const { slugs, total } = await store.searchCandidates({ match: '("feiertag"*)', limit: 10, offset: 0 });
  assert.ok(slugs.includes('ostdeutsches-feiertagsgesetz'));
  assert.ok(total >= slugs.length);
  const [candidate] = await store.getSearchDocuments(['ostdeutsches-feiertagsgesetz'], null);
  assert.equal(candidate.document.slug, 'ostdeutsches-feiertagsgesetz');
  assert.ok(candidate.units.length > 0 || candidate.document.versionKind !== 'current');
  const typed = await store.searchCandidates({ match: null, limit: 5, offset: 0, types: ['verordnung'] });
  assert.ok(typed.slugs.length > 0);
  // Herkunftsfilter: Kandidatenmenge und Gesamtzahl berücksichtigen die Rechtsherkunft bereits serverseitig.
  const all = await store.searchCandidates({ match: null, limit: 1000, offset: 0 });
  const originals = await store.searchCandidates({ match: null, limit: 1000, offset: 0, origins: ['ostdeutsch-original'] });
  const inherited = await store.searchCandidates({ match: null, limit: 1000, offset: 0, origins: ['inherited-unchanged', 'inherited-amended'] });
  assert.ok(originals.total > 0 && originals.total < all.total);
  assert.equal(originals.slugs.length, originals.total);
  const summariesBySlug = new Map((await store.listNormSummaries()).map((summary) => [summary.slug, summary]));
  assert.ok(originals.slugs.every((slug) => summariesBySlug.get(slug)?.originKind === 'ostdeutsch-original'));
  assert.ok(inherited.slugs.every((slug) => summariesBySlug.get(slug)?.originKind?.startsWith('inherited-')));
  const searched = await store.searchCandidates({ match: '("feiertag"*)', limit: 10, offset: 0, origins: ['ostdeutsch-original'] });
  assert.ok(!searched.slugs.includes('ostdeutsches-feiertagsgesetz'), 'übernommene Norm fällt beim Filter auf ostdeutsch-original heraus');
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

test('Dateivariante: seitenweise Übersichten mit Buchstaben-, Freitext-, Herkunfts- und Sachgebietsfilter sowie Aggregate', async () => {
  const letters = await store.listIndexLetters();
  assert.ok(letters.some((entry) => entry.letter === 'O' && entry.count > 0));
  assert.equal(letters.reduce((sum, entry) => sum + entry.count, 0), (await store.listNormSummaries()).length);
  const first = await store.queryNormSummaries({ letter: 'O', page: 1, pageSize: 5 });
  assert.equal(first.pageSize, 5);
  assert.ok(first.items.length <= 5);
  assert.ok(first.items.every((summary) => getGermanIndexLetter(summary.title) === 'O'));
  assert.equal(first.total, letters.find((entry) => entry.letter === 'O')?.count);
  assert.equal(first.pageCount, Math.ceil(first.total / 5));
  const second = await store.queryNormSummaries({ letter: 'O', page: 2, pageSize: 5 });
  assert.ok(second.items.every((summary) => !first.items.some((entry) => entry.slug === summary.slug)), 'Seiten überschneiden sich nicht');
  const beyond = await store.queryNormSummaries({ letter: 'O', page: 999, pageSize: 5 });
  assert.equal(beyond.page, beyond.pageCount, 'zu große Seite fällt auf die letzte zurück');
  const text = await store.queryNormSummaries({ q: 'gemeindeordnung' });
  assert.ok(text.items.some((summary) => summary.slug === 'saechsische-gemeindeordnung'));
  assert.ok(text.items.every((summary) => [summary.title, summary.shortTitle, summary.abbr ?? '', ...summary.keywords].join(' ').toLocaleLowerCase('de-DE').includes('gemeindeordnung')));
  const origin = await store.queryNormSummaries({ originKind: 'ostdeutsch-original', pageSize: 100 });
  assert.ok(origin.total > 0);
  assert.ok(origin.items.every((summary) => summary.originKind === 'ostdeutsch-original'));
  const counts = await store.countByOriginKind();
  assert.equal(counts['ostdeutsch-original'], origin.total);
  const subject = (await store.listNormSummaries())[0].subjects[0];
  const bySubject = await store.queryNormSummaries({ subject, pageSize: 100 });
  assert.ok(bySubject.total > 0);
  assert.ok(bySubject.items.every((summary) => summary.subjects.includes(subject)));
  const keywords = await store.listKeywordIndex('O', { pageSize: 20 });
  assert.ok(keywords.entries.length > 0 && keywords.entries.length <= 20);
  assert.ok(keywords.total >= keywords.entries.length);
  assert.equal(keywords.pageCount, Math.ceil(keywords.total / 20));
  assert.ok(keywords.entries.every((entry) => getGermanIndexLetter(entry.keyword) === 'O' && entry.norms.length > 0));
  assert.deepEqual(keywords.entries.map((entry) => entry.keyword), [...keywords.entries.map((entry) => entry.keyword)].sort((left, right) => left.localeCompare(right, 'de')));
  const filtered = await store.listKeywordIndex('O', { q: 'gemeinde' });
  assert.ok(filtered.total > 0);
  assert.ok(filtered.entries.every((entry) => entry.keyword.toLocaleLowerCase('de-DE').includes('gemeinde')));
  const secondPage = await store.listKeywordIndex('O', { pageSize: 20, page: 2 });
  assert.ok(secondPage.entries.every((entry) => !keywords.entries.some((first) => first.keyword === entry.keyword)), 'Stichwortseiten überschneiden sich nicht');
});

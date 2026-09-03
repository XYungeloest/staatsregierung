import assert from 'node:assert/strict';
import test from 'node:test';

import { loadNormsOnce as loadAllNorms } from './helpers/corpus.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { buildSearchDocument } from '@ostrecht/recht-search/search.ts';

import { assembleBlocks, createFileNormStore, selectedVersionIds } from '../apps/recht/src/lib/runtime/store.ts';

const store = createFileNormStore({ loadAllNorms, loadAllVerkuendungen, buildSearchDocument });

test('Dateivariante des Stores liefert Normen ohne fremde Körper, Ableitungen und Verkündungen', async () => {
  const norms = await store.listNorms();
  assert.ok(norms.length > 100);
  assert.ok(norms.every((norm) => norm.versions.every((version) => version.body.length === 0)));

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
  assert.equal((await store.getPublication(publications[0].slug))?.slug, publications[0].slug);
  const labels = await store.getNormLabels(['ostdeutsches-feiertagsgesetz', 'gibt-es-nicht']);
  assert.equal(labels.size, 1);
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

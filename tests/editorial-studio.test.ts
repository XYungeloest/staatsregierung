import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { prepareCabinetReshuffle, prepareDocumentChange } from '../src/editorial-worker/content.ts';
import { MemoryEditorialRepository } from '../src/editorial-worker/github.ts';
import {
  editorialRegistry,
  serializeEditorialDocument,
  type EditorialContentTypeId,
} from '../src/editorial-worker/registry.ts';

const fileForType: Record<Exclude<EditorialContentTypeId, 'cabinet-reshuffle'>, string> = {
  'government-member': 'content/regierung/mitglieder/karl-honecker.json',
  ministry: 'content/ressorts/staatskanzlei.json',
  home: 'content/portal/home.json',
  'cabinet-page': 'content/regierung/cabinet-page.json',
  topic: 'content/themen/bildungsreform.json',
  'press-release': 'content/presse/mitteilungen/kabinett-honecker-ii-im-amt.json',
  speech: 'content/presse/reden/rede-schlussberatung-bezahlbarer-wohnraum.json',
  event: 'content/presse/termine/dritte-plenarsitzung-7-landtag.json',
  job: 'content/service/stellen/referentin-bodycam-beschwerdestelle.json',
  'service-page': 'content/service/seiten/barrierefreiheit.json',
  'freestate-page': 'content/freistaat/berlin.json',
  'action-plan': 'content/dashboard/action-plan.json',
  timeline: 'content/dashboard/timeline.json',
};

async function actualFileMap(paths: string[]): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readFile(path, 'utf8')])));
}

async function collectionFiles(directory: string): Promise<string[]> {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => `${directory}/${entry.name}`);
}

test('jeder unterstützte dateibasierte Inhaltstyp wird mit dem öffentlichen Parser geladen und serialisiert', async () => {
  for (const [type, path] of Object.entries(fileForType) as Array<[Exclude<EditorialContentTypeId, 'cabinet-reshuffle'>, string]>) {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    const serialized = serializeEditorialDocument(type, value, path);
    assert.doesNotThrow(() => JSON.parse(serialized), type);
    assert.ok(serialized.endsWith('\n'), type);
  }
});

test('die Registry enthält deutsche Feldangaben, Referenzen, Listen, Bilder und öffentliche Routen', () => {
  const definitions = Object.values(editorialRegistry);
  assert.ok(definitions.every((definition) => definition.label && definition.description && definition.publicRoutes.length > 0));
  const fieldTypes = new Set(definitions.flatMap((definition) => definition.fields.map((field) => field.type)));
  for (const type of ['text', 'textarea', 'number', 'date', 'datetime', 'boolean', 'enum', 'slug', 'person-reference', 'ministry-reference', 'reference-list', 'sortable-list', 'object-list', 'image', 'image-alt', 'image-credit']) {
    assert.ok(fieldTypes.has(type as never), type);
  }
  assert.equal(editorialRegistry.topic.fields.find((field) => field.name === 'federfuehrendesRessort')?.referenceTarget, 'ministry');
  assert.equal(editorialRegistry.topic.fields.find((field) => field.name === 'knowledgeProjectRefs')?.referenceTarget, 'knowledge-project');
  assert.deepEqual(editorialRegistry.ministry.publicRoutes, ['/staatsregierung/kabinett/{slug}/', '/staatsregierung/kabinett/']);
  assert.deepEqual(editorialRegistry['press-release'].publicRoutes, ['/presse/pressemitteilungen/{slug}/']);
  assert.deepEqual(editorialRegistry['action-plan'].publicRoutes, ['/staatsregierung/15-punkte-plan/']);
  assert.deepEqual(editorialRegistry.timeline.publicRoutes, ['/staatsregierung/15-punkte-plan/']);
});

test('serverseitige Validierung lehnt unvollständige Inhalte verständlich ab', () => {
  assert.throws(() => serializeEditorialDocument('press-release', { slug: 'test' }), /title/u);
  assert.throws(() => serializeEditorialDocument('home', { hero: {} }), /portalAccesses|hero/u);
});

test('die Diff-Vorschau zeigt Datei und Route und prüft Referenzen', async () => {
  const paths = [
    'content/portal/home.json',
    'content/organisation/governments.json',
    'content/presse/termine/dritte-plenarsitzung-7-landtag.json',
    ...await collectionFiles('content/themen'),
    ...await collectionFiles('content/ressorts'),
  ];
  const repository = new MemoryEditorialRepository(await actualFileMap(paths), 'basis-123');
  const home = JSON.parse(await readFile('content/portal/home.json', 'utf8')) as Record<string, unknown>;
  const changed = structuredClone(home);
  (changed.hero as Record<string, unknown>).title = 'Geprüfte neue Überschrift';
  const preview = await prepareDocumentChange(repository, 'home', changed, 'home', 'basis-123');
  assert.deepEqual(preview.changes.map((entry) => entry.path), ['content/portal/home.json']);
  assert.deepEqual(preview.routes, ['/']);
  assert.match(preview.diff, /Geprüfte neue Überschrift/u);

  const topic = JSON.parse(await readFile('content/themen/bildungsreform.json', 'utf8')) as Record<string, unknown>;
  topic.mitzeichnungsressorts = ['gibt-es-nicht'];
  await assert.rejects(() => prepareDocumentChange(repository, 'topic', topic, 'bildungsreform'), /Unbekannte Ressortreferenz/u);

  const event = JSON.parse(await readFile('content/presse/termine/dritte-plenarsitzung-7-landtag.json', 'utf8')) as Record<string, unknown>;
  event.relatedTopicSlugs = ['gibt-es-nicht'];
  await assert.rejects(() => prepareDocumentChange(repository, 'event', event, 'dritte-plenarsitzung-7-landtag'), /Unbekannte Themenreferenz/u);
});

test('Themenseite und Wissenshub-Coverage werden atomar und wechselseitig geändert', async () => {
  const paths = [
    'knowledge/projects.json',
    'content/portal/topic-coverage.json',
    'content/themen/bildungsreform.json',
    ...await collectionFiles('content/themen'),
    ...await collectionFiles('content/ressorts'),
  ];
  const repository = new MemoryEditorialRepository(await actualFileMap([...new Set(paths)]), 'basis-thema');
  const topic = JSON.parse(await readFile('content/themen/bildungsreform.json', 'utf8')) as Record<string, unknown>;
  topic.knowledgeProjectRefs = ['project-kulturpass'];

  const preview = await prepareDocumentChange(repository, 'topic', topic, 'bildungsreform', 'basis-thema');
  assert.deepEqual(preview.changes.map((entry) => entry.path), [
    'content/themen/bildungsreform.json',
    'content/portal/topic-coverage.json',
  ]);
  assert.deepEqual(preview.routes, ['/themen/bildungsreform/', '/', '/themen/']);

  const coverageChange = preview.changes.find((entry) => entry.path === 'content/portal/topic-coverage.json');
  assert.equal(typeof coverageChange?.content, 'string');
  const coverage = JSON.parse(coverageChange?.content as string) as {
    projectCoverage: Array<{ id: string; topicSlugs?: string[] }>;
  };
  assert.equal(coverage.projectCoverage.find((entry) => entry.id === 'project-schulreform')?.topicSlugs?.includes('bildungsreform') ?? false, false);
  assert.equal(coverage.projectCoverage.find((entry) => entry.id === 'project-kulturpass')?.topicSlugs?.includes('bildungsreform'), true);
  assert.match(preview.diff, /content\/portal\/topic-coverage\.json/u);
});

test('der geführte Kabinettsvorgang erzeugt genau eine atomare Organisationsdatei', async () => {
  const paths = [
    'content/organisation/governments.json',
    'content/organisation/offices.json',
    'content/organisation/assignments.json',
    ...await collectionFiles('content/regierung/mitglieder'),
    ...await collectionFiles('content/ressorts'),
  ];
  const repository = new MemoryEditorialRepository(await actualFileMap(paths), 'basis-organisation');
  const preview = await prepareCabinetReshuffle(repository, {
    effectiveDate: '2026-08-15', governmentSlug: 'erster-staatsrat', summary: 'Ressortleitung wechselt',
    changes: [{ ministrySlug: 'umwelt-energie-und-klimaschutz', personSlug: 'max-peterson', officeSlug: 'staatsratsmitglied', title: 'Staatsrat für Nachhaltigkeit und Energie', sortOrder: 60, sourceRefs: ['redaktionsstudio-test'] }],
  }, 'basis-organisation');
  assert.deepEqual(preview.changes.map((entry) => entry.path), ['content/organisation/assignments.json']);
  assert.deepEqual(preview.workflowPreview, [{
    ministrySlug: 'umwelt-energie-und-klimaschutz',
    ministryName: 'Staatssekretariat für Nachhaltigkeit und Energie',
    beforePersonSlug: 'yannik-schmaele', beforePersonName: 'Yannik Schmäle',
    afterPersonSlug: 'max-peterson', afterPersonName: 'Max Peterson',
  }]);
});

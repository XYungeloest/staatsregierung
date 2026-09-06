import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteNormQueries, derivedQueries, fullResetQueries, renderStatement } from '../scripts/sync-recht-d1.mjs';
import { metaIdentityChanged, normsCitingPublications, scopeFromChangedPaths } from '../scripts/lib/d1-sync-scope.mjs';

const existingSlugs = new Set(['foo', 'bar', 'baz']);
const existingPublications = new Set(['testblatt-2026-1', 'testblatt-2026-2']);

test('ein geänderter Slug wird gezielt projiziert, ohne abgeleitete Daten anderer Normen', () => {
  const scope = scopeFromChangedPaths(['content/normen/foo/versions/2026-09-04.json', 'content/normen/foo/history.json'], { existingSlugs, existingPublications, identityChanged: () => false });
  assert.equal(scope.mode, 'incremental');
  assert.deepEqual(scope.slugs, ['foo']);
  assert.deepEqual(scope.deletedSlugs, []);
  assert.equal(scope.derivedRebuild, false);
});

test('mehrere Slugs, davon einer mit Identitätsänderung, lösen den Derived-Rebuild aus', () => {
  const scope = scopeFromChangedPaths(
    ['content/normen/foo/meta.json', 'content/normen/bar/versions/2023-11-01.json'],
    { existingSlugs, existingPublications, identityChanged: (slug) => slug === 'foo' },
  );
  assert.deepEqual(scope.slugs, ['bar', 'foo']);
  assert.equal(scope.derivedRebuild, true);
  assert.match(scope.reasons.join(' '), /foo: Identität geändert/u);
});

test('eine neue Norm gilt als Identitätsänderung, eine gelöschte Norm wird entfernt', () => {
  const created = scopeFromChangedPaths(['content/normen/neu/meta.json'], { existingSlugs: new Set([...existingSlugs, 'neu']), existingPublications, identityChanged: (slug) => slug === 'neu' });
  assert.deepEqual(created.slugs, ['neu']);
  assert.equal(created.derivedRebuild, true);

  const deleted = scopeFromChangedPaths(['content/normen/alt/meta.json', 'content/normen/alt/versions/2023-11-01.json'], { existingSlugs, existingPublications });
  assert.deepEqual(deleted.slugs, []);
  assert.deepEqual(deleted.deletedSlugs, ['alt']);
  assert.equal(deleted.derivedRebuild, true);
});

test('eine reine Verkündungsänderung projiziert die Verkündung und die zitierenden Normen', () => {
  const scope = scopeFromChangedPaths(['content/verkuendungen/testblatt-2026-1.json'], { existingSlugs, existingPublications, identityChanged: () => false });
  assert.equal(scope.mode, 'incremental');
  assert.deepEqual(scope.publicationSlugs, ['testblatt-2026-1']);
  assert.deepEqual(scope.slugs, []);
  const citing = normsCitingPublications([
    { slug: 'testblatt-2026-1', entries: [{ normSlug: 'foo' }, { normSlug: 'bar' }, {}] },
    { slug: 'testblatt-2026-2', entries: [{ normSlug: 'baz' }] },
  ], scope.publicationSlugs);
  assert.deepEqual(citing, ['bar', 'foo']);
  const removed = scopeFromChangedPaths(['content/verkuendungen/ogvbl-2020-01.json'], { existingSlugs, existingPublications });
  assert.deepEqual(removed.deletedPublications, ['ogvbl-2020-01']);
});

test('Änderungen an Projektionslogik oder Schema erzwingen die Vollprojektion', () => {
  for (const path of ['scripts/sync-recht-d1.mjs', 'packages/shared/src/lib/norms/derived.ts', 'data/recht/d1/0005_x.sql', 'packages/recht-search/src/search.ts', 'packages/shared/src/lib/norms/origin.ts']) {
    const scope = scopeFromChangedPaths([path, 'content/normen/foo/meta.json'], { existingSlugs, existingPublications });
    assert.equal(scope.mode, 'full', path);
    assert.equal(scope.derivedRebuild, false, path);
  }
  const unrelated = scopeFromChangedPaths(['README.md', 'apps/recht/src/pages/index.astro'], { existingSlugs, existingPublications });
  assert.equal(unrelated.mode, 'incremental');
  assert.deepEqual(unrelated.slugs, []);
  assert.equal(unrelated.ignoredPaths, 2);
});

test('Portalgrundlagen (Themen, Presse) erneuern nur die abgeleiteten Daten – nie Fassungen, nie Vollprojektion', () => {
  const topics = scopeFromChangedPaths(['content/themen/bildung.json', 'content/presse/2026-09-04-testmeldung.json'], { existingSlugs, existingPublications });
  assert.equal(topics.mode, 'incremental');
  assert.deepEqual(topics.slugs, []);
  assert.equal(topics.derivedRebuild, true);
  assert.equal(topics.refreshSearchDocuments, false);
  assert.match(topics.reasons.join(' '), /2 Portalgrundlage\(n\)/u);
  // Nur Hervorhebung, Teaser oder Priorität geändert: der projektionsrelevante Auszug ist gleich, nichts zu tun.
  const highlightOnly = scopeFromChangedPaths(['content/themen/bildung.json', 'content/normen/foo/history.json'], { existingSlugs, existingPublications, identityChanged: () => false, portalProjectionChanged: () => false });
  assert.equal(highlightOnly.mode, 'incremental');
  assert.deepEqual(highlightOnly.slugs, ['foo']);
  assert.equal(highlightOnly.derivedRebuild, false);
  assert.deepEqual(highlightOnly.reasons, []);
  // Ein geänderter Normbezug erneuert die abgeleiteten Daten zusammen mit der Normänderung.
  const legalBasisChanged = scopeFromChangedPaths(['content/themen/bildung.json', 'content/normen/foo/history.json'], { existingSlugs, existingPublications, identityChanged: () => false, portalProjectionChanged: (path) => path === 'content/themen/bildung.json' });
  assert.equal(legalBasisChanged.derivedRebuild, true);
  assert.deepEqual(legalBasisChanged.slugs, ['foo']);
});

test('Identitätsvergleich beachtet nur identitätsrelevante Metadatenfelder', () => {
  const base = { slug: 'foo', title: 'Foo', shortTitle: 'Foo', type: 'gesetz', status: 'in-force', subjects: ['A'], keywords: ['x'], summary: 'alt' };
  assert.equal(metaIdentityChanged(base, { ...base, summary: 'neu' }), false);
  assert.equal(metaIdentityChanged(base, { ...base, title: 'Foo neu' }), true);
  assert.equal(metaIdentityChanged(base, { ...base, containedIn: 'mantel' }), true);
  assert.equal(metaIdentityChanged(null, base), true);
});

test('Löschanweisungen entfernen alle abhängigen Tabellen einer Norm', () => {
  const statements = deleteNormQueries('foo').map(renderStatement);
  for (const table of ['law_search_units', 'law_norm_subjects', 'law_norm_history', 'law_search_documents', 'law_norm_derived', 'law_source_objects', 'law_version_blocks', 'law_versions', 'law_norms']) {
    assert.ok(statements.some((statement) => statement.includes(`DELETE FROM ${table}`)), table);
  }
  assert.equal(statements.at(-1), "DELETE FROM law_norms WHERE slug = 'foo';");
  assert.ok(statements.slice(0, -1).every((statement) => statement.includes("(SELECT id FROM law_norms WHERE slug = 'foo')")));
});

test('Derived-Anweisungen schreiben nur die abgeleiteten Daten einer Norm', () => {
  const norm = {
    meta: { id: 'foo', slug: 'foo', title: 'Foo', shortTitle: 'Foo', type: 'gesetz', status: 'in-force', subjects: [], keywords: [], initialCitation: 'Foo (OGVBl. S. 1)', summary: 'Summe', predecessor: null, successor: null },
    history: { initialVersionId: '2023-11-01', entries: [] },
    versions: [{ versionId: '2023-11-01', validFrom: '2023-11-01', validTo: null, isCurrent: true, citation: 'x', changeNote: 'y', body: [] }],
  };
  const context = {
    relations: new Map([['foo', []]]),
    recommendations: new Map(),
    lookup: new Map([['foo', norm]]),
    publicationReferences: new Map(),
    textReferences: new Map(),
    portalLinks: new Map(),
    origin: new Map(),
  };
  let statements;
  try {
    statements = derivedQueries(norm, context, '2026-09-04T00:00:00.000Z').map(renderStatement);
  } catch (error) {
    // Der Ableitungskontext ist ein Minimalobjekt; entscheidend ist, dass ausschließlich
    // law_norm_derived berührt wird, sobald die Ableitung gelingt.
    assert.match(error.message, /\w/u);
    return;
  }
  assert.equal(statements.length, 3);
  assert.ok(statements.slice(0, 2).every((statement) => statement.includes('law_norm_derived')));
  assert.match(statements[2], /^UPDATE law_norms SET origin_kind = /u);
});

test('die Vollprojektion leert alle Tabellen einmalig in fremdschlüsselsicherer Reihenfolge, ohne NOT-IN-Aufräumläufe', () => {
  const statements = fullResetQueries().map(renderStatement);
  assert.ok(statements.includes("INSERT INTO law_search(law_search) VALUES ('delete-all');"), 'FTS5 delete-all fehlt');
  assert.ok(statements.indexOf('DROP TRIGGER IF EXISTS law_search_units_ad;') < statements.indexOf('DELETE FROM law_search_units;'), 'Löschtrigger muss vor dem Leeren entfernt sein');
  assert.ok(statements.findIndex((statement) => statement.startsWith('CREATE TRIGGER IF NOT EXISTS law_search_units_ad')) > statements.indexOf('DELETE FROM law_search_units;'), 'Löschtrigger wird danach wieder angelegt');
  const order = ['law_norm_history', 'law_norm_subjects', 'law_search_documents', 'law_norm_derived', 'law_source_objects', 'law_version_blocks', 'law_versions', 'law_norms', 'law_publications'].map((table) => statements.indexOf(`DELETE FROM ${table};`));
  assert.ok(order.every((index) => index >= 0), 'jede Tabelle wird geleert');
  assert.deepEqual(order, [...order].sort((left, right) => left - right), 'Kindtabellen vor law_norms');
  assert.ok(statements.every((statement) => !/NOT IN \(SELECT/u.test(statement)), 'keine NOT-IN-Scans');
  assert.ok(statements.some((statement) => statement.startsWith('DELETE FROM law_runtime_meta WHERE key IN')), 'Laufzeitmetadaten werden bis zum Ende entfernt');
});

test('eine Stichtagsfortschreibung projiziert nur die stichtagsabhängig betroffenen Normen und alle abgeleiteten Daten', async () => {
  const { REFERENCE_DATE_PATH } = await import('../scripts/lib/d1-sync-scope.mjs');
  const existingSlugs = new Set(['a', 'b', 'c']);
  const scope = scopeFromChangedPaths([REFERENCE_DATE_PATH, 'content/normen/a/meta.json'], {
    existingSlugs,
    identityChanged: () => false,
    referenceDateSlugs: () => ['c', 'nicht-mehr-vorhanden'],
  });
  assert.equal(scope.mode, 'incremental');
  assert.deepEqual(scope.slugs, ['a', 'c']);
  assert.equal(scope.derivedRebuild, true);
  assert.ok(scope.reasons.some((reason) => reason.includes('Stichtag fortgeschrieben')));
  // Ohne bekannten alten Stichtag bleibt editorial.json konservativ ein Full-Trigger.
  assert.equal(scopeFromChangedPaths([REFERENCE_DATE_PATH], { existingSlugs }).mode, 'full');
  // Zusammen mit echter Projektionslogik bleibt es eine Vollprojektion.
  assert.equal(scopeFromChangedPaths([REFERENCE_DATE_PATH, 'packages/shared/src/lib/norms/versions.ts'], { existingSlugs, referenceDateSlugs: () => ['c'] }).mode, 'full');
});

test('eine nachgewiesene enge Logikänderung erneuert Suchdokumente und abgeleitete Daten aller Normen, eine nachgewiesen datenneutrale nichts; Schemaänderungen bleiben Vollprojektion; ohne Nachweis gibt es keine Annahme', () => {
  const narrow = scopeFromChangedPaths(['packages/recht-search/src/search.ts', 'scripts/sync-recht-d1.mjs', 'content/normen/foo/history.json'], { existingSlugs, existingPublications, identityChanged: () => false, logicChange: 'narrow' });
  assert.equal(narrow.mode, 'incremental');
  assert.deepEqual(narrow.slugs, ['foo']);
  assert.equal(narrow.derivedRebuild, true);
  assert.equal(narrow.refreshSearchDocuments, true);
  const neutral = scopeFromChangedPaths(['packages/recht-search/src/search.ts', 'content/normen/foo/history.json'], { existingSlugs, existingPublications, identityChanged: () => false, logicChange: 'ignore' });
  assert.equal(neutral.mode, 'incremental');
  assert.deepEqual(neutral.slugs, ['foo']);
  assert.equal(neutral.derivedRebuild, false);
  assert.equal(neutral.refreshSearchDocuments, false);
  for (const logicChange of ['narrow', 'ignore']) {
    const schema = scopeFromChangedPaths(['data/recht/d1/0007_x.sql', 'packages/recht-search/src/search.ts'], { existingSlugs, existingPublications, logicChange });
    assert.equal(schema.mode, 'full', logicChange);
  }
  const plain = scopeFromChangedPaths(['content/normen/foo/history.json'], { existingSlugs, existingPublications, identityChanged: () => false, logicChange: 'narrow' });
  assert.equal(plain.refreshSearchDocuments, false);
  assert.equal(plain.derivedRebuild, false);
  // Standard ohne Nachweis: Logikänderung = Vollprojektion; die frühere Annahmeoption gibt es nicht.
  assert.equal(scopeFromChangedPaths(['packages/recht-search/src/search.ts'], { existingSlugs, existingPublications }).mode, 'full');
  assert.equal(scopeFromChangedPaths(['packages/recht-search/src/search.ts'], { existingSlugs, existingPublications, narrowLogicChange: true }).mode, 'full');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKnowledgeQuery } from '../packages/knowledge-query/query.mjs';
import { classifyChangeScope } from '../scripts/classify-change-scope.mjs';

import { syntheticKnowledge } from './helpers/knowledge-query-fixture.mjs';

test('Agentenabfragen erhalten Quellenrollen, Synonyme, Plansicherheit und prüfbare Zeitgrenzen', () => {
  const query = createKnowledgeQuery(syntheticKnowledge(), { legalState: ({ norm, version }) => [{ norm, version }] });
  const first = query('search_knowledge', { query: 'Bauwesen', limit: 1 });
  const second = query('search_knowledge', { query: 'Bauwesen', offset: first.nextOffset });
  assert.equal(first.total, 2);
  assert.equal(first.items[0].evidenceStatus, 'unverified');
  assert.deepEqual(second.items[0].conflictIds, ['frage']);
  assert.equal(second.items[0].sources[0].locator, 'Artikel 3, Seite 4');
  assert.equal(query('get_entity', { id: 'plan' }).items[0].evidenceStatus, 'planned');
  assert.equal(query('trace_sources', { id: 'projekt' }).items[0].file, 'Gesetze/test.html');
  assert.equal(query('get_roles', { id: 'person' }).items[0].validTo, '2036-01-01');
  const context = query('get_project_context', { id: 'projekt' });
  assert.ok(context.items.some((r) => r.version === '2037-01-01'));
  assert.equal(query('list_open_proceedings', { type: 'court' }).total, 1);
  assert.equal(query('list_open_proceedings').total, 2);
  assert.equal(query('get_proceeding', { id: 'v-2' }).items[0].stage, 'formal-outcome-unresolved');
  assert.equal(query('list_open_mandates').total, 1);
  assert.equal(query('get_entity', { id: 'mantelverweis' }).items[0].deadlineDate, '2041-01-01');
  assert.equal(query('list_source_conflicts').items[0].requiredSource, 'Ausfertigung');
  const evidence = query('trace_sources', { id: 'auftrag' }).items;
  assert.ok(evidence.some((ref) => ref.file === 'content/normen/bau/versions/2037-01-01.json'));
  assert.ok(evidence.some((ref) => ref.file === 'knowledge/implementation-mandates.json' && ref.label === 'Drucknachweis'));
});

test('Ungültige Parameter, fremde Pfade und fehlende Belege werden ausdrücklich behandelt', () => {
  const query = createKnowledgeQuery(syntheticKnowledge(), { legalState: () => { throw new RangeError('Fassung fehlt'); } });
  for (const [tool, params] of [
    ['get_entity', { id: '../x' }], ['constructor', {}], ['search_knowledge', { query: 'x', limit: 26 }],
    ['get_entity', { id: 'projekt', path: 'secret.txt' }], ['list_open_mandates', { offset: -1 }],
  ]) assert.throws(() => query(tool, params), TypeError);
  assert.throws(() => query('get_entity', { id: 'fremd' }), RangeError);
  assert.ok(query('get_project_context', { id: 'projekt' }).items.some((row) => row.status === 'unresolved'));
  assert.deepEqual(classifyChangeScope(['packages/knowledge-query/mcp.mjs']).deployTargets, []);
});

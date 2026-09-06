import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { COMPARATOR_VERSION, compareProjections, formatComparison, narrowEligible } from '../scripts/lib/d1-projection-compare.mjs';
import { PROOF_SCHEMA, validateProof } from '../scripts/lib/d1-projection-proof-format.mjs';
import { openDatabase } from '../scripts/lib/d1-sqlite.mjs';

const ROOT = process.cwd();

async function projectionFile(name, fill) {
  const path = join(await mkdtemp(join(tmpdir(), 'compare-')), `${name}.sqlite`);
  const db = await openDatabase(path, { create: true, root: ROOT });
  try {
    fill(db);
  } finally {
    db.close();
  }
  return path;
}

const NORM = (id, extra = {}) => ({
  id, slug: id, title: `Titel ${id}`, short_title: `Kurz ${id}`, abbr: null, type: 'gesetz', status: 'in-force', revosax_law_id: null, current_version_id: 'v1',
  document_date: '2026-01-01', publication_date: null, effective_date: '2026-01-01', expiry_date: null, initial_citation: 'OGVBl. 1', summary: 's',
  responsible_ministry: null, enacting_body: null, source_kind: 'repository', updated_at: '2026-01-01T00:00:00.000Z', meta_json: '{}', history_json: '{}', sort_title: `titel ${id}`, current_valid_from: '2026-01-01',
  subjects_json: '[]', primary_subject: null, keywords_json: '[]', aliases_json: '[]', origin_kind: 'ostdeutsch-original', origin_baseline_version_id: null, origin_last_own_change_date: null, version_count: 1, last_change_date: '2026-01-01', last_activity_date: '2026-01-01', is_amendment: 0, index_letter: 'T', ...extra,
});

function insertNorm(db, norm) {
  const columns = Object.keys(norm);
  db.prepare(`INSERT INTO law_norms (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...columns.map((column) => norm[column]));
}

function fillBase(db, { updatedAt = '2026-01-01T00:00:00.000Z', originKind = 'ostdeutsch-original', derived = '{"a":1}', filters = '{"f":1}', body = 'Text' } = {}) {
  insertNorm(db, NORM('a', { updated_at: updatedAt, origin_kind: originKind }));
  insertNorm(db, NORM('b'));
  db.prepare('INSERT INTO law_norm_derived (norm_id, relations_json, recommendations_json, origin_json, text_references_json, portal_links_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('a', derived, '[]', '{}', '[]', '[]', updatedAt);
  db.prepare('INSERT INTO law_search_units (norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('a', 'v1', '0', 'p1', 'paragraph', null, 'a', 'Titel a', 'Kurz a', '', '§ 1', 'Erster', body);
  for (const [key, value] of Object.entries({ last_sync_at: updatedAt, sync_mode: 'full', sync_state: 'complete', projection_fingerprint: `fp-${updatedAt}`, projection_scope: 'full', projection_logic_hash: 'l', corpus_content_hash: 'c', portal_content_hash: 'p', search_filters_json: filters, norm_count: '2' })) {
    db.prepare('INSERT INTO law_runtime_meta (key, value) VALUES (?, ?)').run(key, value);
  }
}

test('Vergleich normalisiert nur Zeitstempel, Laufmodus, Identitätszeilen und Suchzeilen-rowid', async () => {
  const left = await projectionFile('left', (db) => fillBase(db));
  const right = await projectionFile('right', (db) => fillBase(db, { updatedAt: '2026-02-02T00:00:00.000Z' }));
  const comparison = await compareProjections(left, right, { root: ROOT });
  assert.equal(comparison.identical, true, formatComparison(comparison));
  assert.equal(comparison.comparator, COMPARATOR_VERSION);
  assert.ok(Object.keys(comparison.tables).includes('law_search_units'));
  assert.ok(!Object.keys(comparison.tables).some((table) => /^law_search(?:_data|_idx|_docsize|_config)?$/u.test(table)), 'FTS5-Schattentabellen werden nicht zeilenweise verglichen');
});

test('Vergleich meldet Tabelle, Zeilenzahlen, Abweichungen und Beispielschlüssel; Suchtext und Filterzeilen sind semantisch', async () => {
  const left = await projectionFile('left', (db) => fillBase(db));
  const right = await projectionFile('right', (db) => fillBase(db, { body: 'Anderer Text', filters: '{"f":2}' }));
  const comparison = await compareProjections(left, right, { root: ROOT });
  assert.equal(comparison.identical, false);
  assert.deepEqual(comparison.differingTables, ['law_runtime_meta', 'law_search_units']);
  assert.equal(comparison.tables.law_search_units.changed, 1);
  assert.deepEqual(comparison.tables.law_search_units.sampleKeys, ['a|v1|0']);
  assert.deepEqual(comparison.tables.law_runtime_meta.sampleKeys, ['search_filters_json']);
  assert.match(formatComparison(comparison), /DIFF law_search_units: 1 vs 1 Zeilen – nur links 0, nur rechts 0, geändert 1; Beispiele: a\|v1\|0/u);
  assert.equal(narrowEligible(comparison), false, 'Suchzeilen schreibt die enge Projektion nicht');
});

test('enge Logikprojektion: nur abgeleitete Daten, Suchdokumente, abgeleitete Normspalten und Metadaten dürfen abweichen', async () => {
  const left = await projectionFile('left', (db) => fillBase(db));
  const narrow = await projectionFile('narrow', (db) => fillBase(db, { derived: '{"a":2}', originKind: 'origin-unresolved', filters: '{"f":3}' }));
  const comparison = await compareProjections(left, narrow, { root: ROOT });
  assert.deepEqual(comparison.differingTables, ['law_norm_derived', 'law_norms', 'law_runtime_meta']);
  assert.deepEqual(comparison.tables.law_norms.changedColumns, ['origin_kind']);
  assert.equal(narrowEligible(comparison), true);
  const wide = await projectionFile('wide', (db) => {
    fillBase(db);
    db.prepare("UPDATE law_norms SET title = 'Neuer Titel' WHERE id = 'b'").run();
  });
  const wideComparison = await compareProjections(left, wide, { root: ROOT });
  assert.deepEqual(wideComparison.tables.law_norms.changedColumns, ['title']);
  assert.equal(narrowEligible(wideComparison), false);
});

test('ein Nachweis gilt nur für genau den geprüften Stand: Identitäten, Scope, Comparator, Ergebnis und Umfang sind gebunden', () => {
  const head = { fingerprint: 'h'.repeat(64) };
  const proof = {
    $schema: PROOF_SCHEMA,
    comparator: COMPARATOR_VERSION,
    base: { fingerprint: 'b'.repeat(64), scope: 'full', commit: 'aaa' },
    head: { fingerprint: head.fingerprint, scope: 'full', commit: 'bbb' },
    result: 'identity',
    logicChange: 'ignore',
    scopeSignature: '{"mode":"incremental"}',
  };
  assert.deepEqual(validateProof(proof, { storedFingerprint: 'b'.repeat(64), headIdentity: head }), { ok: true, problems: [] });
  // Ein Nachweis mit einem zusätzlichen Feld schmuggelt keine zweite Basis ein.
  assert.equal(validateProof({ ...proof, base: { ...proof.base, legacyFingerprint: 'l'.repeat(64) } }, { storedFingerprint: 'l'.repeat(64), headIdentity: head }).ok, false);
  const problem = (change, options = {}) => validateProof({ ...proof, ...change }, { storedFingerprint: 'b'.repeat(64), headIdentity: head, ...options }).problems.join('; ');
  assert.match(problem({}, { storedFingerprint: 'x'.repeat(64) }), /gespeicherte Identität .* ist nicht die Basis/u);
  assert.match(problem({}, { headIdentity: { fingerprint: 'y'.repeat(64) } }), /Zielidentität des Nachweises/u);
  assert.match(problem({ comparator: COMPARATOR_VERSION + 1 }), /Comparator-Version/u);
  assert.match(problem({ $schema: 'anderes' }), /Nachweisschema/u);
  assert.match(problem({ result: 'full' }), /verlangt eine Vollprojektion/u);
  assert.match(problem({ result: 'trust-me' }), /unbekanntes Ergebnis/u);
  assert.match(problem({ head: { ...proof.head, scope: 'fixture:x@1' } }), /Nachweis-Scope/u);
  assert.match(problem({ scopeSignature: null }), /keinen nachgewiesenen Umfang/u);
  assert.match(problem({}, { storedFingerprint: null }), /gespeicherte Identität/u);
  assert.equal(validateProof(null, { storedFingerprint: 'b', headIdentity: head }).ok, false);
});

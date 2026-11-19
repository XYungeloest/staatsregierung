import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { COMPARATOR_VERSION, compareProjections, formatComparison, narrowEligible } from '../scripts/lib/d1-projection-compare.mjs';
import { AFFECTED_ATTEMPT, logicAffectedNorms, runProofAttempts } from '../scripts/lib/d1-projection-proof.mjs';
import { MAX_LOGIC_AFFECTED_NORMS, PROOF_SCHEMA, validateProof } from '../scripts/lib/d1-projection-proof-format.mjs';
import { openDatabase } from '../scripts/lib/d1-sqlite.mjs';
import { addLogicAffectedSlugs, scopeFromChangedPaths, scopeSignature } from '../scripts/lib/d1-sync-scope.mjs';

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

test('ein Nachweis gilt nur für genau den geprüften Stand: Commits, Identitäten, Scope, Comparator, Ergebnis und Umfang sind gebunden', () => {
  const head = { fingerprint: 'h'.repeat(64) };
  const commits = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
  const proof = {
    $schema: PROOF_SCHEMA,
    comparator: COMPARATOR_VERSION,
    base: { fingerprint: 'b'.repeat(64), scope: 'full', commit: commits.base },
    head: { fingerprint: head.fingerprint, scope: 'full', commit: commits.head },
    result: 'identity',
    logicChange: 'ignore',
    scopeSignature: '{"mode":"incremental"}',
  };
  assert.deepEqual(validateProof(proof, { storedFingerprint: 'b'.repeat(64), headIdentity: head, commits }), { ok: true, problems: [] });
  // Ein Nachweis mit einem zusätzlichen Feld schmuggelt keine zweite Basis ein.
  assert.equal(validateProof({ ...proof, base: { ...proof.base, legacyFingerprint: 'l'.repeat(64) } }, { storedFingerprint: 'l'.repeat(64), headIdentity: head, commits }).ok, false);
  const problem = (change, options = {}) => validateProof({ ...proof, ...change }, { storedFingerprint: 'b'.repeat(64), headIdentity: head, commits, ...options }).problems.join('; ');
  // Basis- und Ziel-Commit des Laufs sind gebunden; ohne sie ist kein Nachweis anwendbar.
  assert.match(problem({}, { commits: { ...commits, base: 'c'.repeat(40) } }), /Basis-Commit des Nachweises/u);
  assert.match(problem({}, { commits: { ...commits, head: 'c'.repeat(40) } }), /Ziel-Commit des Nachweises/u);
  assert.match(problem({ head: { ...proof.head, commit: undefined } }), /Ziel-Commit des Nachweises/u);
  assert.match(problem({}, { commits: null }), /Commit des Laufs fehlen/u);
  assert.match(problem({}, { commits: { base: 'HEAD', head: 'main' } }), /Commit des Laufs fehlen/u);
  assert.match(problem({}, { storedFingerprint: 'x'.repeat(64) }), /gespeicherte Identität .* ist nicht die Basis/u);
  assert.match(problem({}, { headIdentity: { fingerprint: 'y'.repeat(64) } }), /Zielidentität des Nachweises/u);
  assert.match(problem({ comparator: COMPARATOR_VERSION + 1 }), /Comparator-Version/u);
  assert.match(problem({ $schema: 'anderes' }), /Nachweisschema/u);
  assert.match(problem({ result: 'full' }), /verlangt eine Vollprojektion/u);
  assert.match(problem({ result: 'trust-me' }), /unbekanntes Ergebnis/u);
  assert.match(problem({ head: { ...proof.head, scope: 'fixture:x@1' } }), /Nachweis-Scope/u);
  assert.match(problem({ scopeSignature: null }), /keinen nachgewiesenen Umfang/u);
  assert.match(problem({}, { storedFingerprint: null }), /gespeicherte Identität/u);
  assert.equal(validateProof(null, { storedFingerprint: 'b', headIdentity: head, commits }).ok, false);
});

// --- Dritter Versuch: enge Logikprojektion plus die durch die Logik abweichenden Normen -------

const LOGIC_PATH = 'packages/shared/src/lib/norms/citation.ts';
const MANY = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'];

/** Basis mit sieben Normen und je einer Suchzeile; `bodies` überschreibt den Wortlaut einzelner Normen. */
function fillMany(db, { bodies = {}, filters = '{"f":1}', extraNorm = null } = {}) {
  for (const id of [...MANY, ...(extraNorm ? [extraNorm] : [])]) {
    insertNorm(db, NORM(id));
    db.prepare('INSERT INTO law_search_units (norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, 'v1', '0', 'p1', 'paragraph', null, id, `Titel ${id}`, `Kurz ${id}`, '', '§ 1', 'Erster', bodies[id] ?? 'Text');
  }
  for (const [key, value] of Object.entries({ sync_mode: 'full', search_filters_json: filters, norm_count: String(MANY.length) })) {
    db.prepare('INSERT INTO law_runtime_meta (key, value) VALUES (?, ?)').run(key, value);
  }
}

const existing = new Set(MANY);
const slugById = new Map(MANY.map((id) => [id, id]));
const logicScope = (logicChange) => scopeFromChangedPaths([LOGIC_PATH], { existingSlugs: existing, logicPaths: new Set([LOGIC_PATH]), logicChange });

/**
 * Simuliert die Anwendung eines Umfangs auf die Basis: die Logik des Ziels erzeugt für die Normen
 * in `headBodies` einen anderen Wortlaut; nur eine vollständig neu geschriebene Norm (im Umfang,
 * ohne Metadata-only-Eintrag) erhält ihn. Alles andere bleibt auf dem Stand der Basis.
 */
function simulatedEvaluate(headPath, headBodies, calls, { headFilters = '{"f":1}' } = {}) {
  return async (scope, label) => {
    calls.push({ label, slugs: [...scope.slugs] });
    const rewritten = Object.fromEntries(Object.entries(headBodies).filter(([id]) => scope.slugs.includes(id) && !Array.isArray(scope.metadataOnly?.[id])));
    const candidate = await projectionFile(`candidate-${label}`, (db) => fillMany(db, { bodies: rewritten, filters: scope.refreshSearchDocuments ? headFilters : '{"f":1}' }));
    return { comparison: await compareProjections(candidate, headPath, { root: ROOT }), statementCount: scope.slugs.length };
  };
}

test('(a) weicht die enge Logikprojektion nur bei einzelnen Normen ab, ergibt der dritte Versuch incremental mit genau diesen Normen', async () => {
  const headBodies = { n2: 'Neuer Wortlaut 2' };
  const headPath = await projectionFile('head', (db) => fillMany(db, { bodies: headBodies }));
  const calls = [];
  const { outcome } = await runProofAttempts({
    attempts: [{ logicChange: 'ignore', scope: logicScope('ignore') }, { logicChange: 'narrow', scope: logicScope('narrow') }],
    evaluate: simulatedEvaluate(headPath, headBodies, calls),
    extendScope: (slugs) => addLogicAffectedSlugs(logicScope('narrow'), slugs, { existingSlugs: existing, logicChange: 'narrow' }),
    slugById,
  });
  assert.deepEqual(calls.map((call) => call.label), ['ignore', 'narrow', AFFECTED_ATTEMPT]);
  assert.ok(outcome, 'der dritte Versuch weist den Umfang nach');
  assert.equal(outcome.logicChange, 'narrow');
  assert.deepEqual(outcome.logicAffectedSlugs, ['n2']);
  assert.deepEqual(outcome.scope.slugs, ['n2']);
  assert.equal(outcome.scope.refreshSearchDocuments, true, 'die enge Logikprojektion bleibt Teil des Umfangs');
  assert.equal(outcome.comparison.identical, true);
  assert.match(scopeSignature(outcome.scope), /"logicAffectedSlugs":\["n2"\]/u);
});

test('(a) die Normliste ist vollständig – auch jenseits der Beispielschlüssel des Vergleichs', async () => {
  const headBodies = Object.fromEntries(MANY.map((id) => [id, `Neu ${id}`]));
  const headPath = await projectionFile('head', (db) => fillMany(db, { bodies: headBodies }));
  const base = await projectionFile('base', (db) => fillMany(db));
  const comparison = await compareProjections(base, headPath, { root: ROOT });
  assert.equal(comparison.tables.law_search_units.sampleKeys.length, 5, 'Stichprobe bleibt klein');
  assert.deepEqual(comparison.tables.law_search_units.normIds, MANY, 'normIds nennt jede abweichende Norm');
  assert.equal(comparison.tables.law_runtime_meta.normIds, null, 'nicht normbezogene Tabellen tragen keine Normliste');
  assert.deepEqual(logicAffectedNorms(comparison, { slugById }), { eligible: true, slugs: MANY });
  const calls = [];
  const { outcome } = await runProofAttempts({
    attempts: [{ logicChange: 'narrow', scope: logicScope('narrow') }],
    evaluate: simulatedEvaluate(headPath, headBodies, calls),
    extendScope: (slugs) => addLogicAffectedSlugs(logicScope('narrow'), slugs, { existingSlugs: existing, logicChange: 'narrow' }),
    slugById,
  });
  assert.deepEqual(outcome?.logicAffectedSlugs, MANY);
});

test('(b) eine Abweichung außerhalb normbezogener Tabellen, eine neue Norm oder die Obergrenze lassen den Nachweis full', async () => {
  const headBodies = { n2: 'Neuer Wortlaut 2' };
  const extend = (slugs) => addLogicAffectedSlugs(logicScope('narrow'), slugs, { existingSlugs: existing, logicChange: 'narrow' });
  // Laufzeitmetadaten weichen ab, die die enge Projektion nicht herstellt: kein dritter Versuch.
  const metaHead = await projectionFile('head-meta', (db) => fillMany(db, { bodies: headBodies, filters: '{"f":9}' }));
  const metaCalls = [];
  const notes = [];
  const meta = await runProofAttempts({ attempts: [{ logicChange: 'narrow', scope: logicScope('narrow') }], evaluate: simulatedEvaluate(metaHead, headBodies, metaCalls), extendScope: extend, slugById, note: (line) => notes.push(line) });
  assert.equal(meta.outcome, null);
  assert.deepEqual(metaCalls.map((call) => call.label), ['narrow']);
  assert.ok(notes.some((line) => /entfällt: Tabelle law_runtime_meta ist nicht normbezogen/u.test(line)), notes.join('\n'));
  // Obergrenze: mehr abweichende Normen als zugelassen.
  const wideBodies = Object.fromEntries(MANY.map((id) => [id, `Neu ${id}`]));
  const wideHead = await projectionFile('head-wide', (db) => fillMany(db, { bodies: wideBodies }));
  const wideCalls = [];
  const wide = await runProofAttempts({ attempts: [{ logicChange: 'narrow', scope: logicScope('narrow') }], evaluate: simulatedEvaluate(wideHead, wideBodies, wideCalls), extendScope: extend, slugById, limit: MANY.length - 1 });
  assert.equal(wide.outcome, null);
  assert.deepEqual(wideCalls.map((call) => call.label), ['narrow']);
  // Eine Norm nur im Ziel ist eine neue Norm, keine Logikwirkung.
  const base = await projectionFile('base', (db) => fillMany(db));
  const added = await compareProjections(base, await projectionFile('head-added', (db) => fillMany(db, { extraNorm: 'n8' })), { root: ROOT });
  assert.match(logicAffectedNorms(added, { slugById: new Map([...slugById, ['n8', 'n8']]) }).reason, /neue oder entfernte Norm/u);
  // Verbleibt nach dem dritten Versuch eine Abweichung (die Neuprojektion stellt das Ziel nicht her), bleibt es full.
  const bodiesHead = await projectionFile('head-bodies', (db) => fillMany(db, { bodies: headBodies }));
  const stubbornCalls = [];
  const stubborn = await runProofAttempts({
    attempts: [{ logicChange: 'narrow', scope: logicScope('narrow') }],
    evaluate: async (scope, label) => {
      stubbornCalls.push(label);
      return { comparison: await compareProjections(base, bodiesHead, { root: ROOT }), statementCount: 0 };
    },
    extendScope: extend,
    slugById,
  });
  assert.deepEqual(stubbornCalls, ['narrow', AFFECTED_ATTEMPT]);
  assert.equal(stubborn.outcome, null, 'ein nicht identischer dritter Versuch ist kein Nachweis');
  assert.equal(stubborn.lastComparison.identical, false);
  // Reine Funktion: Obergrenze, fremde Norm, fehlende Normliste, Volltext ohne Suchzeilen.
  const synthetic = (tables, fts = {}) => ({ identical: false, differingTables: Object.keys(tables), tables, fts });
  const entry = (normIds, extra = {}) => ({ onlyLeft: 0, onlyRight: 0, changed: normIds?.length ?? 1, normIds, ...extra });
  const many = Array.from({ length: MAX_LOGIC_AFFECTED_NORMS + 1 }, (_, index) => `x${String(index).padStart(4, '0')}`);
  assert.match(logicAffectedNorms(synthetic({ law_versions: entry(many) }), { slugById: new Map(many.map((id) => [id, id])) }).reason, new RegExp(`> Obergrenze ${MAX_LOGIC_AFFECTED_NORMS}`, 'u'));
  assert.equal(logicAffectedNorms(synthetic({ law_versions: entry(many.slice(0, MAX_LOGIC_AFFECTED_NORMS)) }), { slugById: new Map(many.map((id) => [id, id])) }).eligible, true);
  assert.match(logicAffectedNorms(synthetic({ law_versions: entry(['fremd']) }), { slugById }).reason, /nicht im Zielbestand/u);
  assert.match(logicAffectedNorms(synthetic({ law_versions: entry(null) }), { slugById }).reason, /keine vollständige Normliste/u);
  assert.match(logicAffectedNorms(synthetic({ law_publications: entry(null) }), { slugById }).reason, /law_publications ist nicht normbezogen/u);
  assert.match(logicAffectedNorms(synthetic({ law_norm_derived: entry(['n1']) }, { Zinnwald: false }), { slugById }).reason, /Volltextabweichung ohne abweichende Suchzeilen/u);
  assert.equal(logicAffectedNorms(synthetic({ law_search_units: entry(['n1']) }, { Zinnwald: false }), { slugById }).eligible, true);
  assert.match(logicAffectedNorms(synthetic({ law_versions: { ...entry(['n1']), missing: 'rechts' } }), { slugById }).reason, /fehlt rechts/u);
});

test('ein Nachweis mit zusätzlichen Normen gilt nur in kanonischer Form am Ergebnis incremental der engen Logikprojektion', () => {
  const head = { fingerprint: 'h'.repeat(64) };
  const proof = {
    $schema: PROOF_SCHEMA, comparator: COMPARATOR_VERSION,
    base: { fingerprint: 'b'.repeat(64), scope: 'full', commit: 'a'.repeat(40) }, head: { fingerprint: head.fingerprint, scope: 'full', commit: 'b'.repeat(40) },
    result: 'incremental', logicChange: 'narrow', logicAffectedSlugs: ['a', 'b'], scopeSignature: '{}',
  };
  const check = (change) => validateProof({ ...proof, ...change }, { storedFingerprint: 'b'.repeat(64), headIdentity: head, commits: { base: 'a'.repeat(40), head: 'b'.repeat(40) } });
  assert.equal(check({}).ok, true);
  assert.equal(check({ logicAffectedSlugs: null }).ok, true);
  assert.match(check({ logicAffectedSlugs: ['b', 'a'] }).problems.join('; '), /nicht streng sortiert/u);
  assert.match(check({ logicAffectedSlugs: ['a', 'a'] }).problems.join('; '), /nicht streng sortiert/u);
  assert.match(check({ logicAffectedSlugs: [] }).problems.join('; '), /keine nicht leere Slug-Liste/u);
  assert.match(check({ logicAffectedSlugs: 'a' }).problems.join('; '), /keine nicht leere Slug-Liste/u);
  assert.match(check({ logicChange: 'ignore' }).problems.join('; '), /nur am Ergebnis incremental der engen Logikprojektion/u);
  assert.match(check({ result: 'identity' }).problems.join('; '), /nur am Ergebnis incremental/u);
  const tooMany = Array.from({ length: MAX_LOGIC_AFFECTED_NORMS + 1 }, (_, index) => `x${String(index).padStart(4, '0')}`);
  assert.match(check({ logicAffectedSlugs: tooMany }).problems.join('; '), /Obergrenze/u);
});

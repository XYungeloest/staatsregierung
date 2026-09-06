import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { buildDerivedContext } from '@ostrecht/shared/lib/norms/derived.ts';

import { scopeSignature } from '../scripts/lib/d1-sync-scope.mjs';
import {
  D1_FILE_ATTEMPTS, SyncBaseMismatch, SyncBudgetExceeded, assertEstimateWithinBudget, assessSyncDecision, buildSyncPlan, classifyStoredIdentityError, decideSyncAction, estimatePlanCost,
  identityMetaValues, incrementalStartQueries, isMetadataOnlyRun, isTransientD1Error, planRun, renderStatement, resolveBudget, runtimeMetaQueries,
} from '../scripts/sync-recht-d1.mjs';
import { fixtureCorpus } from './helpers/fixture-corpus.ts';

const full = { fingerprint: 'f'.repeat(64), scope: 'full', logic: 'l', corpus: 'c', portal: 'p' };
const fixtureA = { fingerprint: 'a'.repeat(64), scope: 'fixture:data/recht/runtime-fixture.json@1111111111111111', logic: 'l', corpus: 'c', portal: 'p' };
const fixtureB = { fingerprint: 'b'.repeat(64), scope: 'fixture:data/recht/other-fixture.json@2222222222222222', logic: 'l', corpus: 'c', portal: 'p' };
const stored = (identity, extra = {}) => ({ projection_fingerprint: identity.fingerprint, projection_scope: identity.scope, sync_state: 'complete', ...extra });

// --- Projektionsidentität und Scope (Tests A–E) -----------------------------------------

test('A: Fixture → dasselbe Fixture ist ein No-op', () => {
  assert.equal(decideSyncAction({ requested: 'full', stored: stored(fixtureA), identity: fixtureA }).action, 'noop');
});

test('B: Fixture in D1, Vollbestand angefordert → muss projizieren (nie No-op)', () => {
  const decision = decideSyncAction({ requested: 'full', stored: stored(fixtureA), identity: full });
  assert.equal(decision.action, 'full');
  assert.match(decision.reason, /weicht ab/u);
  // auch wenn der Fixture-Fingerabdruck zufällig gleich wäre, entscheidet der Scope
  const collision = decideSyncAction({ requested: 'full', stored: stored({ ...fixtureA, fingerprint: full.fingerprint }), identity: full });
  assert.equal(collision.action, 'full');
});

test('C: Vollbestand in D1, Fixture angefordert → projiziert; Scope-Metadaten zeigen danach das Fixture', () => {
  assert.equal(decideSyncAction({ requested: 'full', stored: stored(full), identity: fixtureA }).action, 'full');
  const values = identityMetaValues(fixtureA);
  assert.equal(values.projection_scope, fixtureA.scope);
  assert.equal(values.sync_state, 'complete');
  const meta = runtimeMetaQueries({ now: 't', norms: [], publications: [], identity: fixtureA, mode: 'full' }).map(renderStatement);
  assert.ok(meta.some((statement) => statement.includes("'projection_scope'") && statement.includes(fixtureA.scope)));
});

test('D: zwei verschiedene Fixtures erkennen einander nicht als aktuell', () => {
  assert.equal(decideSyncAction({ requested: 'full', stored: stored(fixtureA), identity: fixtureB }).action, 'full');
  assert.equal(decideSyncAction({ requested: 'full', stored: stored(fixtureB), identity: fixtureA }).action, 'full');
});

test('E: der Produktionsschutz für --corpus-filter bleibt im Sync verankert; frei setzbare Bypässe gibt es nicht mehr', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/sync-recht-d1.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(corpusFilter && targetsProduction\) throw new Error\('--corpus-filter ist nur lokal oder gegen eine Staging-Datenbank zulässig/u);
  assert.match(source, /const targetsProduction = transport === 'api' \? config\.databaseId === DEFAULT_D1_DATABASE_ID : !local && databaseName === PRODUCTION_DATABASE_NAME;/u);
  // --stamp-fingerprint und --assume-narrow-logic-change sind entfernt: nur ein validierter
  // Äquivalenznachweis (--equivalence-proof) darf den Umfang einer geänderten Logik bestimmen.
  assert.match(source, /if \(args\.includes\('--stamp-fingerprint'\)\) throw new Error/u);
  assert.match(source, /if \(args\.includes\('--assume-narrow-logic-change'\)\) throw new Error/u);
  assert.doesNotMatch(source, /fingerprintStampQueries/u);
});

// --- Base-State-Guard für inkrementelle Läufe -------------------------------------------

const base = { fingerprint: '1'.repeat(64), scope: 'full', logic: 'l', corpus: 'c0', portal: 'p', ref: 'abc123' };
const head = { fingerprint: '2'.repeat(64), scope: 'full', logic: 'l', corpus: 'c1', portal: 'p' };

test('1: korrekter Basiszustand → inkrementell erlaubt', () => {
  const decision = decideSyncAction({ requested: 'incremental', stored: stored(base), identity: head, baseIdentity: base });
  assert.equal(decision.action, 'incremental');
  assert.match(decision.reason, /Basiszustand verifiziert/u);
});

test('2: anderer Zustand X in D1 → inkrementell verboten (fail-closed) bzw. Recovery mit --recover', () => {
  const other = stored({ ...base, fingerprint: '9'.repeat(64) });
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: other, identity: head, baseIdentity: base }), SyncBaseMismatch);
  const recovery = decideSyncAction({ requested: 'incremental', stored: other, identity: head, baseIdentity: base, recover: true });
  assert.equal(recovery.action, 'recovery');
  assert.match(recovery.reason, /≠ erwartete Basis/u);
});

test('3: leere oder teilweise projizierte D1 wird nie als Basis anerkannt', () => {
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: null, identity: head, baseIdentity: base }), /keine vollständige Identität/u);
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: {}, identity: head, baseIdentity: base }), SyncBaseMismatch);
  const partial = { projection_scope: 'full', sync_state: 'incremental-in-progress:2026-09-03T00:00:00Z' };
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: partial, identity: head, baseIdentity: base }), /keine vollständige Identität/u);
  assert.equal(decideSyncAction({ requested: 'incremental', stored: partial, identity: head, baseIdentity: base, recover: true }).action, 'recovery');
});

test('4: fehlender Fingerabdruck → verboten oder Recovery, nie inkrementell', () => {
  const noFingerprint = { projection_scope: 'full', sync_state: 'complete', corpus_hash: 'x' };
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: noFingerprint, identity: head, baseIdentity: base }), SyncBaseMismatch);
  assert.equal(decideSyncAction({ requested: 'incremental', stored: noFingerprint, identity: head, baseIdentity: base, recover: true }).action, 'recovery');
});

test('5: identischer Head → echter No-op, auch inkrementell', () => {
  assert.equal(decideSyncAction({ requested: 'incremental', stored: stored(head), identity: head, baseIdentity: base }).action, 'noop');
  // --ignore-fingerprint erzwingt den Lauf, aber nur mit verifizierter Basis
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: stored(head), identity: head, baseIdentity: base, ignoreFingerprint: true }), SyncBaseMismatch);
});

test('6: geänderte Projektionslogik → Vollprojektion bzw. Recovery statt inkrementell', () => {
  // Der Umfang (scopeFromChangedPaths) wählt bei Logikänderung "full"; die Entscheidung projiziert dann immer.
  const logicChanged = { ...head, logic: 'l2', fingerprint: '3'.repeat(64) };
  assert.equal(decideSyncAction({ requested: 'full', stored: stored(base), identity: logicChanged }).action, 'full');
  // Trägt D1 eine Basis mit anderer Logik als der Basis-Ref, ist das kein gültiger Ausgangszustand.
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: stored({ ...base, fingerprint: '4'.repeat(64) }), identity: logicChanged, baseIdentity: base }), SyncBaseMismatch);
});

test('7: Fixture-Metadaten werden nie als Vollbestands-Basis anerkannt', () => {
  const fixtureAsBase = stored({ ...fixtureA, fingerprint: base.fingerprint });
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: fixtureAsBase, identity: head, baseIdentity: base }), /Scope in D1 ist fixture:/u);
  assert.equal(decideSyncAction({ requested: 'incremental', stored: fixtureAsBase, identity: head, baseIdentity: base, recover: true }).action, 'recovery');
});

test('Base-State-Guard: nur die Identität des Basis-Refs wird als Ausgangszustand anerkannt', () => {
  const head = { ...full, fingerprint: '9'.repeat(64) };
  const base = { ...full, fingerprint: '8'.repeat(64), ref: 'main' };
  assert.equal(decideSyncAction({ requested: 'incremental', stored: stored({ ...full, fingerprint: '8'.repeat(64) }), identity: head, baseIdentity: base }).action, 'incremental');
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: stored({ ...full, fingerprint: '7'.repeat(64) }), identity: head, baseIdentity: base }), SyncBaseMismatch);
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: stored({ ...full, fingerprint: '6'.repeat(64) }), identity: head, baseIdentity: base }), SyncBaseMismatch);
});

test('Base-State-Guard: nur die Identität des Basis-Refs zählt, keine frühere Berechnung', () => {
  const head = { ...full, fingerprint: '9'.repeat(64) };
  const base = { ...full, fingerprint: '8'.repeat(64), ref: 'main' };
  assert.equal(decideSyncAction({ requested: 'incremental', stored: stored({ ...full, fingerprint: '8'.repeat(64) }), identity: head, baseIdentity: base }).action, 'incremental');
  // Ein zusätzliches Feld am Basisobjekt eröffnet keine zweite anerkannte Basis.
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: stored({ ...full, fingerprint: '7'.repeat(64) }), identity: head, baseIdentity: { ...base, legacyFingerprint: '7'.repeat(64) } }), SyncBaseMismatch);
});

test('Entscheidung gegen Budgetprofil: No-op und verifizierter inkrementeller Lauf sind tragbar, eine Vollprojektion nur mit Full-/Recovery-Budget (Release-Gate)', () => {
  const scope = { mode: 'incremental', slugs: ['a'], deletedSlugs: [], publicationSlugs: [], derivedRebuild: true, refreshSearchDocuments: true };
  assert.equal(assessSyncDecision({ decision: { action: 'noop', reason: 'gleich' }, scope, budgetProfile: 'incremental' }).ok, true);
  const incremental = assessSyncDecision({ decision: { action: 'incremental', reason: 'Basis verifiziert' }, scope, budgetProfile: 'incremental' });
  assert.equal(incremental.ok, true);
  assert.match(incremental.message, /abgeleitete Daten aller Normen, Suchdokumente aller Normen/u);
  assert.equal(assessSyncDecision({ decision: { action: 'recovery', reason: 'Basis fehlt' }, scope: { ...scope, mode: 'full' }, budgetProfile: 'incremental' }).ok, true);
  const gate = assessSyncDecision({ decision: { action: 'full', reason: 'Identität weicht ab' }, scope: { ...scope, mode: 'full' }, budgetProfile: 'incremental', limits: { maxRowsWritten: 120000 } });
  assert.equal(gate.ok, false);
  assert.equal(gate.code, 'full-gate');
  assert.match(gate.message, /Release-Gate/u);
  assert.equal(assessSyncDecision({ decision: { action: 'full', reason: '--full' }, scope: { ...scope, mode: 'full' }, budgetProfile: 'full', limits: { maxRowsWritten: 800000 } }).ok, true);
  assert.equal(assessSyncDecision({ decision: { action: 'full', reason: '--full' }, scope: { ...scope, mode: 'full' }, budgetProfile: null, limits: {} }).ok, true);
  assert.equal(assessSyncDecision({ decision: { action: 'full', reason: '--full' }, scope: { ...scope, mode: 'full' }, budgetProfile: null, limits: { maxRowsWritten: 5000 } }).ok, false);
});

test('manuelle Auswahl ohne Basis-Ref verlangt eine vollständige Identität im selben Scope', () => {
  assert.equal(decideSyncAction({ requested: 'incremental', stored: stored(base), identity: head, requiresBase: false }).action, 'incremental');
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: null, identity: head, requiresBase: false }), SyncBaseMismatch);
  assert.throws(() => decideSyncAction({ requested: 'incremental', stored: stored(fixtureA), identity: head, requiresBase: false }), SyncBaseMismatch);
});

test('ein manueller Teilsync schreibt keine Identität, nur Zeitstempel und Modus', () => {
  const plan = buildSyncPlan({ scope: { mode: 'incremental', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: [] }, norms: [], publications: [], context: {}, now: 't', identity: head, writeIdentity: false });
  assert.ok(!plan.groups.some((group) => group.slug === '(identität entwerten)'));
  const rendered = plan.groups.at(-1).queries.map(renderStatement);
  assert.ok(rendered.every((statement) => !statement.includes("'projection_fingerprint'") && !statement.includes("'sync_state'") && !statement.includes("'corpus_hash'")));
  assert.ok(rendered.some((statement) => statement.includes("'sync_mode', 'manual-partial'")));
  assert.ok(rendered.some((statement) => statement.includes("'last_sync_at'")));
});

test('ein inkrementeller Plan entwertet die Identität vor dem ersten Schreibzugriff und setzt sie erst am Ende', () => {
  const start = incrementalStartQueries('2026-09-03T00:00:00.000Z').map(renderStatement);
  assert.equal(start[0], "DELETE FROM law_runtime_meta WHERE key = 'projection_fingerprint';");
  assert.match(start[1], /'sync_state', 'incremental-in-progress:2026-09-03T00:00:00\.000Z'/u);
  const plan = buildSyncPlan({ scope: { mode: 'incremental', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: [] }, norms: [], publications: [], context: {}, now: 't', identity: head });
  assert.equal(plan.groups[0].slug, '(identität entwerten)');
  const rendered = plan.groups.at(-1).queries.map(renderStatement);
  assert.ok(rendered.some((statement) => statement.includes("'sync_state', 'complete'")));
  assert.ok(rendered.some((statement) => statement.includes("'projection_fingerprint'") && statement.includes(head.fingerprint)));
});

// --- Budgets --------------------------------------------------------------------------

const budgets = { profiles: { incremental: { maxRowsRead: 60000, maxRowsWritten: 120000 }, full: { maxRowsRead: 500000, maxRowsWritten: 900000 } }, estimate: { writtenPerStatement: 1.25, writtenPerSearchUnit: 14, readPerStatementFull: 1, readPerStatementIncremental: 2 } };

test('Budgetprofile kommen aus der zentralen Datei; explizite Grenzen gehen vor; unbekannte Profile scheitern', () => {
  assert.deepEqual(resolveBudget('incremental', budgets), { maxRowsRead: 60000, maxRowsWritten: 120000, profile: 'incremental' });
  assert.deepEqual(resolveBudget('full', budgets, { maxRowsWritten: 10 }), { maxRowsRead: 500000, maxRowsWritten: 10, profile: 'full' });
  assert.deepEqual(resolveBudget(null, budgets, { maxRowsRead: 5 }), { maxRowsRead: 5 });
  assert.throws(() => resolveBudget('nope', budgets), /Unbekanntes Budgetprofil nope/u);
});

test('Vorabschätzung über dem Budget → Abbruch vor dem ersten Schreibzugriff; darunter erlaubt', () => {
  const planLike = (statementCount, searchUnitCount, full) => ({ statementCount, searchUnitCount, full, byStatement: { 'insert law_norms': statementCount } });
  const fullCost = estimatePlanCost(planLike(103127, 38561, true), budgets.estimate);
  assert.ok(fullCost.rowsWrittenMax >= 465926, `Vollprojektion konservativ geschätzt: ${fullCost.rowsWrittenMax}`);
  assert.ok(fullCost.rowsReadApprox >= 103127);
  assert.doesNotThrow(() => assertEstimateWithinBudget(fullCost, resolveBudget('full', budgets)));
  assert.throws(() => assertEstimateWithinBudget(fullCost, resolveBudget('incremental', budgets)), (error) => error instanceof SyncBudgetExceeded && /es wurde nichts geschrieben/u.test(error.message));
  const incrementalCost = estimatePlanCost(planLike(300, 40, false), budgets.estimate);
  assert.doesNotThrow(() => assertEstimateWithinBudget(incrementalCost, resolveBudget('incremental', budgets)));
});

test('vorübergehende Cloudflare-Fehler beim Hochladen einer SQL-Datei werden erkannt und wiederholt, SQL- und Budgetfehler nicht', () => {
  for (const message of [
    'File could not be uploaded. Please retry.\nGot response: <?xml version="1.0"?><Error><Code>ServiceUnavailable</Code><Message>Please look at https://www.cloudflarestatus.com</Message></Error>',
    'wrangler d1 execute batch-0007.sql: Network connection lost',
    'fetch failed', 'ETIMEDOUT', 'HTTP 503 Service Unavailable', 'Too Many Requests (429)', 'InternalError: internal error; reference = abc',
  ]) assert.equal(isTransientD1Error(message), true, message);
  for (const message of [
    'D1_ERROR: near "SELEC": syntax error at offset 0', 'Lesebudget überschritten: 70000 gelesene Zeilen > Budget 60000', 'Unknown database ostrecht-recht-x', 'no such table: law_norms',
  ]) assert.equal(isTransientD1Error(message), false, message);
  assert.ok(D1_FILE_ATTEMPTS >= 6);
});

test('ein Lesefehler der gespeicherten Identität gilt nie als leere Datenbank: nur eine fehlende Tabelle ist „keine Identität“, Transportfehler werden wiederholt, alles andere bricht ab', () => {
  assert.equal(classifyStoredIdentityError('D1_ERROR: no such table: law_runtime_meta'), 'missing-table');
  assert.equal(classifyStoredIdentityError('File could not be uploaded. Please retry. ServiceUnavailable'), 'transient');
  assert.equal(classifyStoredIdentityError('fetch failed'), 'transient');
  assert.equal(classifyStoredIdentityError('Authentication error [code: 10000]'), 'transient');
  assert.equal(classifyStoredIdentityError('wrangler d1 execute lieferte kein JSON'), 'fatal');
  assert.equal(classifyStoredIdentityError('Unknown database'), 'fatal');
});

// --- Metadata-only-Lauf: leerer nachgewiesener Umfang ohne korpusweite Ableitungen ------------

const NOW = '2026-09-06T12:00:00.000Z';
const incremental = { action: 'incremental', reason: 'Basiszustand verifiziert' };
const emptyScope = () => ({ mode: 'incremental', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, refreshSearchDocuments: false, reasons: [] });
const identityProof = (scope, overrides = {}) => ({ result: 'identity', logicChange: 'ignore', scopeSignature: scopeSignature(scope), ...overrides });

let corpusPromise = null;
/** Synthetischer Bestand (tests/helpers/fixture-corpus.ts) mit einmal gerechnetem Ableitungskontext. */
function corpus() {
  corpusPromise ??= (async () => {
    const { norms, publications } = fixtureCorpus();
    const context = buildDerivedContext({ norms, publications, topics: [], pressReleases: [] });
    return { norms, publications, context };
  })();
  return corpusPromise;
}

test('Metadata-only: leerer nachgewiesener Umfang erzeugt den 19-Anweisungen-Metadatenplan ohne Ableitungskontext', async () => {
  const { norms, publications } = await corpus();
  const scope = emptyScope();
  assert.equal(isMetadataOnlyRun({ decision: incremental, scope, proof: identityProof(scope) }), true);
  // Ohne Nachweis wurde der Umfang mit logicChange `full` bestimmt: eine Logikänderung hätte `full` ergeben.
  assert.equal(isMetadataOnlyRun({ decision: incremental, scope }), true);
  for (const proof of [identityProof(scope), null]) {
    const buildContext = mock.fn(() => { throw new Error('buildDerivedContext darf im Metadata-only-Lauf nicht gerufen werden'); });
    const { plan, metadataOnly } = planRun({ decision: incremental, scope, norms, publications, buildContext, now: NOW, identity: head, writeIdentity: true, proof });
    assert.equal(metadataOnly, true);
    assert.equal(buildContext.mock.callCount(), 0);
    assert.equal(plan.statementCount, 19);
    assert.deepEqual(plan.groups.map((group) => group.slug), ['(identität entwerten)', '(verkuendungen+meta)']);
    assert.deepEqual(plan.byStatement, { 'delete law_runtime_meta': 1, 'insert law_runtime_meta': 18 });
    const rendered = plan.groups.at(-1).queries.map(renderStatement);
    assert.ok(rendered.some((statement) => statement.includes("'projection_fingerprint'") && statement.includes(head.fingerprint)));
    assert.ok(rendered.some((statement) => statement.includes("'sync_state', 'complete'")));
    assert.ok(rendered.some((statement) => statement.includes("'sync_mode', 'incremental'")));
    // Die korpusabgeleiteten Zeilen stammen aus dem geladenen Bestand, nicht aus D1 (der Nachweis belegt sie nicht).
    assert.ok(rendered.some((statement) => statement.includes(`'norm_count', '${norms.length}'`)));
    assert.ok(rendered.some((statement) => statement.includes(`'publication_count', '${publications.length}'`)));
    for (const key of ['corpus_hash', 'search_filters_json', 'search_publications_json', 'subject_groups_json', 'subject_areas_json', 'corpus_stats_json']) {
      assert.ok(rendered.some((statement) => statement.includes(`'${key}'`)), key);
    }
  }
});

test('jeder nicht leere oder nicht eindeutig datenneutrale Umfang nimmt den normalen fail-closed Projektionsweg', async () => {
  const { norms, publications, context } = await corpus();
  const slug = norms[0].meta.slug;
  const publicationSlug = publications[0].slug;
  const run = ({ decision = incremental, scope, proof }) => {
    const buildContext = mock.fn(() => context);
    const result = planRun({ decision, scope, norms, publications, buildContext, now: NOW, identity: head, writeIdentity: true, proof });
    assert.equal(result.metadataOnly, isMetadataOnlyRun({ decision, scope, proof }));
    return { ...result, buildContext };
  };
  const beyondMeta = (plan) => Object.keys(plan.byStatement).some((key) => !key.endsWith('law_runtime_meta'));

  // Nicht leerer Umfang: Normen, Löschungen, Verkündungen, abgeleitete Daten, Suchdokumente – auch mit gültigem Nachweis.
  for (const variant of [{ slugs: [slug] }, { deletedSlugs: ['alt'] }, { publicationSlugs: [publicationSlug] }, { deletedPublications: ['alt'] }, { derivedRebuild: true }, { refreshSearchDocuments: true }]) {
    const scope = { ...emptyScope(), ...variant };
    const label = JSON.stringify(variant);
    const { plan, metadataOnly, buildContext } = run({ scope, proof: identityProof(scope) });
    assert.equal(metadataOnly, false, label);
    assert.equal(buildContext.mock.callCount(), 1, label);
    assert.ok(beyondMeta(plan), `${label}: ${JSON.stringify(plan.byStatement)}`);
  }
  // Leerer Umfang, aber kein eindeutig datenneutraler Nachweis: Ergebnis incremental, enge Logikänderung, fremde Umfangssignatur.
  for (const overrides of [{ result: 'incremental' }, { logicChange: 'narrow' }, { scopeSignature: scopeSignature({ ...emptyScope(), slugs: ['x'] }) }]) {
    const scope = emptyScope();
    const label = JSON.stringify(overrides);
    const { metadataOnly, buildContext } = run({ scope, proof: identityProof(scope, overrides) });
    assert.equal(metadataOnly, false, label);
    assert.equal(buildContext.mock.callCount(), 1, label);
  }
  // Entscheidungen No-op, Vollprojektion und Recovery: nie Metadata-only.
  for (const [action, scope] of [['noop', emptyScope()], ['full', { ...emptyScope(), mode: 'full' }], ['recovery', { ...emptyScope(), mode: 'full' }]]) {
    const { plan, metadataOnly, buildContext } = run({ decision: { action, reason: action }, scope, proof: identityProof(scope) });
    assert.equal(metadataOnly, false, action);
    assert.equal(buildContext.mock.callCount(), 1, action);
    if (scope.mode === 'full') assert.equal(plan.groups[0].slug, '(reset)', action);
  }
  // Fail-closed im Planbau: ohne Ableitungskontext lässt sich kein nicht leerer Umfang bauen.
  for (const scope of [{ ...emptyScope(), slugs: [slug] }, { ...emptyScope(), derivedRebuild: true }, { ...emptyScope(), refreshSearchDocuments: true }, { ...emptyScope(), mode: 'full' }]) {
    assert.throws(() => buildSyncPlan({ scope, norms, publications, context: null, now: NOW, identity: head }), /Ableitungskontext fehlt/u);
  }
  // main() rechnet buildDerivedContext ausschließlich über den injizierten Thunk von planRun.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/sync-recht-d1.mjs', import.meta.url), 'utf8');
  assert.equal((source.match(/buildDerivedContext\(/gu) ?? []).length, 1);
});

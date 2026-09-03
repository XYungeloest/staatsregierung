import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SyncBaseMismatch, SyncBudgetExceeded, assertEstimateWithinBudget, buildSyncPlan, decideSyncAction, estimatePlanCost,
  identityMetaValues, incrementalStartQueries, renderStatement, resolveBudget, runtimeMetaQueries,
} from '../scripts/sync-recht-d1.mjs';

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

test('E: der Produktionsschutz für --corpus-filter bleibt im Sync verankert', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/sync-recht-d1.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(corpusFilter && targetsProduction\) throw new Error\('--corpus-filter ist nur lokal oder gegen eine Staging-Datenbank zulässig/u);
  assert.match(source, /const targetsProduction = transport === 'api' \? config\.databaseId === DEFAULT_D1_DATABASE_ID : !local && databaseName === PRODUCTION_DATABASE_NAME;/u);
  assert.match(source, /if \(corpusFilter\) throw new Error\('--stamp-fingerprint gilt nur für den Vollbestand'\)/u);
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

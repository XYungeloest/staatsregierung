import assert from 'node:assert/strict';
import test from 'node:test';
import { findDeployedBase, readD1ReleaseState } from '../scripts/ci-d1-base.mjs';

const before = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const older = 'c'.repeat(40);
const target = 'd'.repeat(40);
const live = '9'.repeat(64);
const commits = [before, previous, older];
const stored = { projection_scope: 'full', sync_state: 'complete', projection_fingerprint: live };

test('D1-Abfrage akzeptiert nur eine erfolgreiche Metadatenantwort', () => {
  const results = Object.entries(stored).map(([key, value]) => ({ key, value }));
  assert.deepEqual(readD1ReleaseState([{ success: true, results }]), stored);
  for (const response of [null, [], [{ results }], [{ success: true, results: null }]]) {
    assert.throws(() => readD1ReleaseState(response), /Metadaten/u);
  }
});

test('CI behandelt aktuelle Basis, bereits ausgerolltes Ziel und nachzuholende Merges anhand des Hashes', async () => {
  for (const [matches, expected, visited] of [
    [[before], before, [before]], [[target], before, [before, target]],
    [[previous, older], previous, [before, target, previous]], [[older], older, [before, target, previous, older]],
  ]) {
    const refs = [];
    const identify = async (ref) => {
      refs.push(ref);
      return { scope: 'full', fingerprint: matches.includes(ref) ? live : '0'.repeat(64), closureUncertain: false };
    };
    assert.equal(await findDeployedBase({ stored, commits, target, identify }), expected);
    assert.deepEqual(refs, visited);
  }
});

test('Teilzustände, unbekannte Vorfahren und unsichere Code-Abschlüsse geben keine D1-Basis frei', async () => {
  for (const drift of [{ projection_scope: 'fixture:test' }, { sync_state: 'in-progress' }, { projection_fingerprint: live.slice(0, 16) }]) {
    await assert.rejects(findDeployedBase({ stored: { ...stored, ...drift }, commits, target, identify: assert.fail }), /abgeschlossene Vollprojektion/u);
  }
  for (const result of [{ scope: 'full', fingerprint: live, closureUncertain: true }, { scope: 'full', fingerprint: '1'.repeat(64) },
    { scope: 'fixture:x', fingerprint: live }]) {
    await assert.rejects(findDeployedBase({ stored, commits, target, identify: async () => result }), /Keine passende D1-Basis/u);
  }
});

test('Eine weit zurückliegende Identität wird nicht automatisch gewählt', async () => {
  const history = Array.from({ length: 35 }, (_, i) => (i + 1).toString(16).padStart(40, '0'));
  const seen = [];
  const identify = async (ref) => {
    seen.push(ref);
    return { scope: 'full', fingerprint: ref === history[32] ? live : null };
  };
  await assert.rejects(findDeployedBase({ stored, commits: history, target, identify }), /32 First-Parent-Commits/u);
  assert.equal(seen.length, 33);
});

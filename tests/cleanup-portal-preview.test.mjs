import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupComment, cleanupVersions, previewComment, trackedVersions } from '../scripts/cleanup-portal-preview.mjs';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const production = '00000000-0000-4000-8000-000000000003';
const reply = (result) => ({ ok: true, status: 200, body: { success: true, result } });
const failure = (status, code, message) => ({ ok: false, status, body: { success: false, errors: [{ code, message }] } });
const missing = failure(404, 10090, 'Version not found');
const latest = failure(409, 10339, 'The latest version cannot be deleted.');
const deployment = (...ids) => reply({ deployments: [{ versions: ids.map((id) => ({ version_id: id })) }] });

function simulate(responses) {
  const calls = [];
  return {
    calls,
    request(method, path) {
      calls.push([method, path]);
      assert.ok(responses.length, 'unerwarteter API-Aufruf');
      return responses.shift();
    },
  };
}
const info = (id, tag = 'pr-86') => reply({ id, annotations: { 'workers/tag': tag } });

test('Nur das Bot-Protokoll liefert vollständige UUIDs; ein abgeschlossener zweiter Lauf hat keinen Kandidaten', () => {
  const body = `<!-- ostrecht-cloudflare-preview -->\n<!-- cloudflare-versions:${first},${first} -->`;
  const bot = { user: { login: 'github-actions[bot]' }, body };
  assert.equal(previewComment([{ ...bot, user: { login: 'anderer[bot]' } }, bot]), bot);
  assert.deepEqual(trackedVersions(body), [first]);
  assert.throws(() => trackedVersions(body.replace(first, 'ungültig')), /Versionskennung/u);
  assert.deepEqual(trackedVersions(cleanupComment([{ id: first, status: 'removed' }])), []);
});

test('Teilbereinigung wie bei PR 86 behält nur die neueste Version für den erneuten Versuch', async () => {
  const cf = simulate([deployment(production), info(first), reply(null), deployment(production), info(second), latest]);
  const result = await cleanupVersions([first, second], 86, cf.request);
  assert.deepEqual(result.map((r) => r.status), ['removed', 'latest']);
  assert.deepEqual(trackedVersions(cleanupComment(result)), [second]);
  const retry = simulate([deployment(production), info(second), reply(null)]);
  assert.deepEqual(await cleanupVersions([second], 86, retry.request), [{ id: second, status: 'removed' }]);
});

test('Aktive Teil-Deployments, falsche PRs und unbestimmbare Deployments erhalten keinen DELETE', async () => {
  for (const [responses, expected] of [
    [[deployment(production, first)], 'active'],
    [[deployment(production), info(first, 'pr-99')], 'error'],
    [[deployment(production), reply({ id: first })], 'error'],
    [[reply({ deployments: [] })], 'error'],
  ]) {
    const cf = simulate(responses);
    assert.equal((await cleanupVersions([first], 86, cf.request))[0].status, expected);
    assert.ok(cf.calls.every(([method]) => method === 'GET'));
  }
});

test('Nur das belegte Fehlen ist idempotent; Berechtigungen, unbekannte Konflikte und Fehler bleiben sichtbar', async () => {
  for (const [responses, expected] of [
    [[deployment(production), missing], 'missing'],
    [[deployment(production), info(first), missing], 'missing'],
    [[deployment(production), failure(403, 10000, 'Authentication error')], 'error'],
    [[deployment(production), failure(404, 7003, 'Unknown route')], 'error'],
    [[deployment(production), info(first), failure(409, 42, 'Conflict'), deployment(production)], 'error'],
    [[deployment(production), info(first), failure(409, 42, 'Conflict'), deployment(first)], 'active'],
    [[deployment(production), info(first), failure(500, 0, 'Internal error')], 'error'],
  ]) {
    const cf = simulate(responses);
    assert.equal((await cleanupVersions([first], 86, cf.request))[0].status, expected);
  }
});

test('Eine alte Vorschau erfordert ihre eigene Versions-ID und Preview-Bindung oder passenden Alias', async () => {
  for (const data of [
    { annotations: { 'workers/alias': 'pr-86' } },
    { resources: { bindings: [{ type: 'plain_text', name: 'APP_ENV', text: 'preview' }] } },
  ]) {
    const cf = simulate([deployment(production), reply({ id: first, ...data }), reply(null)]);
    assert.equal((await cleanupVersions([first], 86, cf.request))[0].status, 'removed');
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sourceCheckKey, findCheckedPullRequest } from '../scripts/ci-source-checks.mjs';

const scope = { runContentCheck: true, runKnowledgeCheck: true, checkPortal: true, checkLaw: false, runUnitTests: true, runCorpusTests: false, closureKnown: true };
const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
const tree = 'c'.repeat(40);
const commit = 'd'.repeat(40);
const key = sourceCheckKey(base, tree, scope);
const repo = { owner: 'test', repo: 'portal' };
const repository = { full_name: 'test/portal' };
const pull = { number: 42, merged_at: '2026-01-01', merge_commit_sha: commit, head: { sha: head, repo: repository }, base: { ref: 'main', repo: repository } };
const run = { id: 7, run_attempt: 2, event: 'pull_request', path: '.github/workflows/pull-request.yml', conclusion: 'success',
  head_repository: repository, head_sha: head, html_url: 'https://github.com/test/portal/actions/runs/7' };
const step = { name: `Quellprüfung PR 42 ${key}`, conclusion: 'success' };
const job = { name: 'quality', conclusion: 'success', steps: [step] };

function lookup(pulls = [pull], runs = [run], jobs = [job]) {
  const github = { rest: {
    repos: { listPullRequestsAssociatedWithCommit: async (params) => {
      assert.equal(params.commit_sha, commit);
      return { data: pulls };
    } },
    actions: {
      listWorkflowRuns: async (params) => {
        assert.equal(params.head_sha, head);
        assert.equal(params.workflow_id, 'pull-request.yml');
        return { data: { workflow_runs: runs } };
      },
      listJobsForWorkflowRunAttempt: async (params) => {
        assert.equal(params.run_id, run.id);
        assert.equal(params.attempt_number, run.run_attempt);
        return { data: { jobs } };
      },
    },
  } };
  return findCheckedPullRequest(github, repo, commit, key);
}

test('Quellprüfungen sind an Basis, Baum und jeden geprüften Scope gebunden', () => {
  assert.ok(/^[0-9a-f]{64}$/u.test(key));
  assert.notEqual(sourceCheckKey(head, tree, scope), key);
  assert.notEqual(sourceCheckKey(base, commit, scope), key);
  for (const flag of Object.keys(scope)) assert.notEqual(sourceCheckKey(base, tree, { ...scope, [flag]: !scope[flag] }), key);
  for (const invalid of ['HEAD', '0'.repeat(40), undefined]) assert.equal(sourceCheckKey(invalid, tree, scope), '');
});

test('Squash-Merge übernimmt nur den erfolgreichen Prüfvermerk des zugeordneten PR-Versuchs', async () => {
  assert.equal(await lookup(), run.html_url);
  for (const pulls of [[], [pull, pull], [{ ...pull, merged_at: null }], [{ ...pull, merge_commit_sha: head }],
    [{ ...pull, head: { sha: head, repo: { full_name: 'fork/portal' } } }]]) assert.equal(await lookup(pulls), null);
  for (const change of [{ head_sha: commit }, { event: 'push' }, { path: 'other.yml' }, { conclusion: 'cancelled' },
    { head_repository: null }]) assert.equal(await lookup([pull], [{ ...run, ...change }]), null);
  for (const jobs of [[], [{ ...job, name: 'preview' }], [{ ...job, conclusion: 'failure' }],
    [{ ...job, steps: [{ ...step, name: step.name.replace('42', '41') }] }],
    [{ ...job, steps: [{ ...step, conclusion: 'skipped' }] }]]) assert.equal(await lookup([pull], [run], jobs), null);
});

test('Freigabe wertet übersprungene Jobs nur für vom Scope abgewählte Prüfungen als Erfolg', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const condition = workflow.split('\n  deploy:\n')[1].split('    runs-on:')[0];
  assert.match(condition, /needs\.runtime_smoke\.result == 'skipped' && needs\.classify\.outputs\.run_ui_smoke != 'true'/u);
  assert.match(condition, /needs\.d1_sync\.result == 'skipped' && \(github\.event_name != 'push' \|\| needs\.classify\.outputs\.run_d1_sync != 'true'\)/u);
  assert.doesNotMatch(workflow, /norms:runtime:d1-sync -- --(?:full|apply-schema)/u);
});

import { createHash } from 'node:crypto';

/** Der PR prüft den ausgecheckten Merge-Baum. Die Commit-ID allein überlebt einen Squash nicht. */
export function sourceCheckKey(base, tree, scope) {
  if (![base, tree].every((id) => /^[a-f0-9]{40}$/u.test(id) && !/^0+$/u.test(id))) return '';
  const flags = [scope.runContentCheck, scope.runKnowledgeCheck, scope.checkPortal, scope.checkLaw,
    scope.runUnitTests, scope.runCorpusTests];
  if (!flags.every((flag) => typeof flag === 'boolean') || !scope.closureKnown) return '';
  return createHash('sha256').update(JSON.stringify([base, tree, ...flags])).digest('hex');
}

/** Liest ausschließlich GitHub-Jobmetadaten. Ein fehlender Treffer lässt main selbst prüfen. */
export async function findCheckedPullRequest(github, repo, commit, key) {
  if (!/^[a-f0-9]{64}$/u.test(key)) return null;
  const fullName = `${repo.owner}/${repo.repo}`;
  const { data: associated } = await github.rest.repos.listPullRequestsAssociatedWithCommit({ ...repo, commit_sha: commit });
  const pulls = associated.filter((pr) => pr.merged_at && pr.merge_commit_sha === commit && pr.base.ref === 'main'
    && pr.base.repo.full_name === fullName && pr.head.repo?.full_name === fullName);
  if (pulls.length !== 1) return null;
  const [pr] = pulls;
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...repo, workflow_id: 'pull-request.yml', event: 'pull_request', head_sha: pr.head.sha, status: 'success', per_page: 5,
  });
  for (const run of data.workflow_runs) {
    if (run.event !== 'pull_request' || run.conclusion !== 'success' || run.head_sha !== pr.head.sha
      || run.head_repository?.full_name !== fullName || run.path !== '.github/workflows/pull-request.yml') continue;
    const { data: jobs } = await github.rest.actions.listJobsForWorkflowRunAttempt({
      ...repo, run_id: run.id, attempt_number: run.run_attempt, per_page: 100,
    });
    const passed = jobs.jobs.some((job) => job.name === 'quality' && job.conclusion === 'success'
      && job.steps?.some((step) => step.name === `Quellprüfung PR ${pr.number} ${key}` && step.conclusion === 'success'));
    if (passed) return run.html_url;
  }
  return null;
}

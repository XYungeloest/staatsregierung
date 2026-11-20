import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FULL_SCOPE, projectionIdentityAtRef } from './lib/d1-projection-fingerprint.mjs';

const HISTORY_LIMIT = 32;
const gitSha = /^[0-9a-f]{40}$/u;

/** Verwendet nur eine abgeschlossene Vollprojektion. Der schreibende Sync prüft die Basis erneut. */
export async function findDeployedBase({ stored, commits, target, identify = projectionIdentityAtRef }) {
  if (stored.projection_scope !== FULL_SCOPE || stored.sync_state !== 'complete' || !/^[0-9a-f]{64}$/u.test(stored.projection_fingerprint)) {
    throw new Error('D1 trägt keine abgeschlossene Vollprojektion mit gültigem Fingerabdruck. D1-Release-Gate prüfen.');
  }
  if (!commits.length || !gitSha.test(target) || !commits.every((sha) => gitSha.test(sha))) throw new Error('Git-Basis oder Ziel ungültig.');
  const matches = async (ref) => {
    const identity = await identify(ref);
    return !identity.closureUncertain && identity.scope === FULL_SCOPE && identity.fingerprint === stored.projection_fingerprint;
  };
  if (await matches(commits[0]) || await matches(target)) return commits[0];
  for (const ancestor of commits.slice(1, HISTORY_LIMIT)) {
    if (await matches(ancestor)) return ancestor;
  }
  throw new Error(`Keine passende D1-Basis unter den letzten ${Math.min(commits.length, HISTORY_LIMIT)} First-Parent-Commits. D1-Release-Gate prüfen.`);
}

export function readD1ReleaseState(response) {
  if (!Array.isArray(response) || response.length !== 1 || response[0]?.success !== true || !Array.isArray(response[0].results)) {
    throw new Error('D1-Metadaten konnten nicht eindeutig gelesen werden.');
  }
  return Object.fromEntries(response[0].results.map(({ key, value }) => [key, value]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, target] = process.argv.slice(2);
  if (![base, target].every((sha) => gitSha.test(sha) && !/^0+$/u.test(sha))) throw new Error('Eine auflösbare Basis und ein Zielcommit sind erforderlich.');
  execFileSync('git', ['merge-base', '--is-ancestor', base, target]);
  const commits = execFileSync('git', ['rev-list', '--first-parent', '--max-count=' + HISTORY_LIMIT, base], { encoding: 'utf8' }).trim().split('\n');
  const stored = readD1ReleaseState(JSON.parse(readFileSync(0, 'utf8')));
  console.log(await findDeployedBase({ stored, commits, target }));
}

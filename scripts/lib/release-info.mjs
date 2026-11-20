import { readFileSync } from 'node:fs';
import { resolveBuildCommit } from './build-commit.mjs';

const editorial = new URL('../../packages/shared/src/config/editorial.json', import.meta.url);

export function createBuildInfo(target, env = process.env) {
  const commit = resolveBuildCommit(env);
  const epoch = env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && !/^\d{1,12}$/u.test(epoch)) throw new Error('Ungültiger SOURCE_DATE_EPOCH.');
  const builtAt = (epoch === undefined ? new Date() : new Date(Number(epoch) * 1000)).toISOString();
  const run = env.GITHUB_RUN_ID;
  const attempt = env.GITHUB_RUN_ATTEMPT;
  if (run && (!/^\d+$/u.test(run) || !/^\d+$/u.test(attempt ?? ''))) throw new Error('Ungültige Actions-Laufkennung.');
  const buildId = target + '-' + (run ? run + '.' + attempt : commit + '-' + builtAt.replace(/[^0-9]/gu, ''));
  const { referenceDate } = JSON.parse(readFileSync(editorial, 'utf8'));
  return { schemaVersion: 1, target, commit, buildId, builtAt, referenceDate, projectionFingerprint: null };
}

export function validateBuildInfo(info, target) {
  if (info?.schemaVersion !== 1 || info.target !== target || !['portal', 'law'].includes(target)
      || !/^[a-f0-9]{40}$/u.test(info.commit) || typeof info.buildId !== 'string'
      || !/^[a-zA-Z0-9.-]{1,100}$/u.test(info.buildId)
      || !/^\d{4}-\d\d-\d\d$/u.test(info.referenceDate)
      || !Number.isFinite(Date.parse(info.builtAt)) || new Date(info.builtAt).toISOString() !== info.builtAt
      || (info.projectionFingerprint !== null && (target !== 'law' || !/^[a-f0-9]{64}$/u.test(info.projectionFingerprint)))) {
    throw new Error('Ungültiger Buildnachweis für ' + target);
  }
  return info;
}

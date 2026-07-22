import { execFileSync } from 'node:child_process';

const FULL_COMMIT_PATTERN = /^[0-9a-f]{40}$/u;

export function resolveBuildCommit(env = process.env) {
  const configured = env.PORTAL_BUILD_COMMIT ?? env.GITHUB_SHA;
  const commit = configured?.trim() || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!FULL_COMMIT_PATTERN.test(commit)) {
    throw new Error(`Buildkennung „${commit}“ ist kein vollständiger Git-Commit.`);
  }
  return commit;
}

export function withBuildCommitHeader(headers, commit) {
  if (!FULL_COMMIT_PATTERN.test(commit)) throw new Error('X-Portal-Commit benötigt einen vollständigen Git-Commit.');
  const lines = headers.replace(/\r\n?/gu, '\n').split('\n');
  const rootRuleIndex = lines.findIndex((line) => line.trim() === '/*');
  if (rootRuleIndex < 0) throw new Error('Globale /*-Regel fehlt in der erzeugten _headers-Datei.');
  const existingIndex = lines.findIndex((line) => /^\s*X-Portal-Commit:/iu.test(line));
  const headerLine = `  X-Portal-Commit: ${commit}`;
  if (existingIndex >= 0) lines[existingIndex] = headerLine;
  else lines.splice(rootRuleIndex + 1, 0, headerLine);
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

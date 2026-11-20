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

export function withBuildCommitHeader(headers, commit, buildId) {
  if (!FULL_COMMIT_PATTERN.test(commit)) throw new Error('X-Portal-Commit benötigt einen vollständigen Git-Commit.');
  const lines = headers.replace(/\r\n?/gu, '\n').split('\n');
  const rootRuleIndex = lines.findIndex((line) => line.trim() === '/*');
  if (rootRuleIndex < 0) throw new Error('Globale /*-Regel fehlt in der erzeugten _headers-Datei.');
  const values = { 'X-Portal-Commit': commit };
  if (buildId !== undefined) {
    if (!/^[a-zA-Z0-9.-]{1,100}$/u.test(buildId)) throw new Error('Ungültige Build-ID.');
    values['X-Portal-Build'] = buildId;
  }
  for (const [name, value] of Object.entries(values)) {
    let index = rootRuleIndex + 1;
    while (index < lines.length && /^\s+\S/u.test(lines[index])) {
      if (lines[index].trimStart().toLowerCase().startsWith(name.toLowerCase() + ':')) break;
      index++;
    }
    const line = '  ' + name + ': ' + value;
    if (lines[index]?.trimStart().toLowerCase().startsWith(name.toLowerCase() + ':')) lines[index] = line;
    else lines.splice(rootRuleIndex + 1, 0, line);
  }
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

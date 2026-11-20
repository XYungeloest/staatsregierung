#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveBuildCommit, withBuildCommitHeader } from './lib/build-commit.mjs';
import { validateBuildInfo } from './lib/release-info.mjs';

const commit = resolveBuildCommit();
const target = process.argv[2];
if (target !== 'portal' && target !== 'law') {
  throw new Error('Aufruf: node scripts/stamp-build.mjs <portal|law>');
}
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const targetRoot = target === 'portal'
  ? resolve(repositoryRoot, 'apps', 'portal', 'dist')
  : resolve(repositoryRoot, 'apps', 'recht', 'dist');
const candidates = [resolve(targetRoot, 'client/_headers'), resolve(targetRoot, '_headers')];
let headerPath = null;
for (const candidate of candidates) {
  if (await access(candidate).then(() => true).catch(() => false)) {
    headerPath = candidate;
    break;
  }
}

if (!headerPath) throw new Error('Erzeugte Cloudflare-_headers-Datei wurde nicht gefunden.');
const headers = await readFile(headerPath, 'utf8');
const infoPath = resolve(dirname(headerPath), 'build-info.json');
const info = validateBuildInfo(JSON.parse(await readFile(infoPath, 'utf8')), target);
if (info.commit !== commit) throw new Error('HTML-Build und Header gehören zu unterschiedlichen Commits.');
if (target === 'law') {
  const { projectionIdentity } = await import('./lib/d1-projection-fingerprint.mjs');
  const identity = await projectionIdentity({ root: repositoryRoot });
  if (!identity.closureUncertain) info.projectionFingerprint = identity.fingerprint;
}
await writeFile(infoPath, JSON.stringify(info, null, 2) + '\n');
await writeFile(headerPath, withBuildCommitHeader(headers, commit, info.buildId), 'utf8');
console.log(`Buildkennung ${commit} in ${headerPath} eingetragen.`);

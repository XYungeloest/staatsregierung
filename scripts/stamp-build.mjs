#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveBuildCommit, withBuildCommitHeader } from './lib/build-commit.mjs';

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
await writeFile(headerPath, withBuildCommitHeader(headers, commit), 'utf8');
console.log(`Buildkennung ${commit} in ${headerPath} eingetragen.`);

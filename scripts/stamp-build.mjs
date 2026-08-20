#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { resolveBuildCommit, withBuildCommitHeader } from './lib/build-commit.mjs';

const commit = resolveBuildCommit();
const target = process.argv[2];
const targetRoot = target === 'portal' || target === 'law' ? resolve('dist', target) : resolve('dist');
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

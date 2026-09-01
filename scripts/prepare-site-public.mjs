#!/usr/bin/env node

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (target !== 'portal' && target !== 'law') {
  throw new Error('Aufruf: node scripts/prepare-site-public.mjs <portal|law>');
}

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = resolve(root, 'public');
const outputRoot = target === 'portal'
  ? resolve(root, 'apps', 'portal', '.site-public')
  : resolve(root, 'apps', 'recht', '.site-public');

async function copy(relativePath) {
  const source = resolve(sourceRoot, relativePath);
  const destination = resolve(outputRoot, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

if (target === 'portal') {
  await cp(sourceRoot, outputRoot, {
    recursive: true,
    filter(source) {
      const relative = source.slice(sourceRoot.length).replaceAll('\\', '/');
      return relative !== '/assets/recht' && !relative.startsWith('/assets/recht/');
    },
  });

  const lawSiteUrl = (process.env.LAW_SITE_URL ?? 'https://recht.freistaat-ostdeutschland.de')
    .replace(/\/+$/u, '');
  const redirects = [
    `/recht/suche/ ${lawSiteUrl}/suche/ 301`,
    `/recht/archiv/ ${lawSiteUrl}/archiv/ 301`,
    `/recht/sachgebiete/ ${lawSiteUrl}/sachgebiete/ 301`,
    `/recht/foerderrichtlinien/ ${lawSiteUrl}/foerderrichtlinien/ 301`,
    `/recht/fundstellen/ ${lawSiteUrl}/fundstellen/ 301`,
    `/recht/verkuendungen/ ${lawSiteUrl}/verkuendungen/ 301`,
    `/recht/verfassung/ ${lawSiteUrl}/norm/staatsverfassung-des-freistaates-ostdeutschland/ 301`,
    `/recht/rechtsentwicklung/ ${lawSiteUrl}/rechtsentwicklung/ 301`,
    `/recht/hilfe/ ${lawSiteUrl}/hilfe/ 301`,
    `/recht/search-index.json ${lawSiteUrl}/search-index.json 301`,
    `/recht/verkuendungen/index.json ${lawSiteUrl}/verkuendungen/index.json 301`,
    `/recht/norm/sachsische-landkreisordnung/ ${lawSiteUrl}/norm/saechsische-landkreisordnung/ 301`,
    `/recht/norm/* ${lawSiteUrl}/norm/:splat 301`,
    `/recht/verkuendungen/* ${lawSiteUrl}/verkuendungen/:splat 301`,
    `/recht/sachgebiete/* ${lawSiteUrl}/sachgebiete/:splat 301`,
  ].join('\n');
  await writeFile(resolve(outputRoot, '_redirects'), `${redirects}\n`, 'utf8');
} else {
  await Promise.all([
    copy('_headers'),
    copy('favicon.ico'),
    copy('favicon.svg'),
    copy('assets/recht'),
    copy('images/ui/ost-flagge.png'),
    copy('images/generated/ui/ost-flagge-480.webp'),
    copy('images/social/recht-preview.png'),
  ]);
}

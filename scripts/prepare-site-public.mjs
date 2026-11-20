#!/usr/bin/env node

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLegacyLawRedirects } from '../apps/portal/src/config/legacy-routes.mjs';

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

  await writeFile(resolve(outputRoot, '_redirects'), buildLegacyLawRedirects(process.env.LAW_SITE_URL), 'utf8');
} else {
  await Promise.all([
    copy('_headers'),
    // Weiterleitungen der OstRecht-Origin (Altadressen der Ausgaben-PDFs mit Leerzeichen).
    copy('_redirects'),
    copy('favicon.ico'),
    copy('favicon.svg'),
    copy('assets/recht'),
    copy('images/ui/ost-flagge.png'),
    copy('images/generated/ui/ost-flagge-480.webp'),
    copy('images/social/recht-preview.png'),
  ]);
}

// Die Lizenztexte zusammen mit der Software und den lokal ausgelieferten Schriften bereitstellen.
const licensesDir = resolve(outputRoot, 'lizenzen');
const fontsDir = resolve(root, 'packages/shared/src/assets/fonts');
await mkdir(licensesDir, { recursive: true });
await Promise.all([
  cp(resolve(root, 'LICENSE'), resolve(licensesDir, 'mit.txt')),
  cp(resolve(root, 'LICENSES/CC-BY-NC-4.0.txt'), resolve(licensesDir, 'cc-by-nc-4.0.txt')),
  cp(resolve(fontsDir, 'LICENSE-Jost.txt'), resolve(licensesDir, 'jost.txt')),
  cp(resolve(fontsDir, 'LICENSE-SourceSerif4.md'), resolve(licensesDir, 'source-serif-4.txt')),
  cp(resolve(fontsDir, 'LICENSE-OstGrotesk.md'), resolve(licensesDir, 'ost-grotesk.txt')),
]);

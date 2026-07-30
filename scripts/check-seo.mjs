import { glob, readFile } from 'node:fs/promises';

const failures = [];
const titles = new Map();

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

for await (const file of glob('dist/client/**/*.html')) {
  const html = await readFile(file, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/iu)?.[1]?.trim();
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/iu)?.[1]?.trim();
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/iu)?.[1]?.trim();
  const h1Count = count(html, /<h1(?:\s[^>]*)?>/giu);
  const structuredData = [];

  if (!title) failures.push(`${file}: Titel fehlt`);
  if (!description) failures.push(`${file}: Meta-Description fehlt`);
  if (!canonical) failures.push(`${file}: Canonical fehlt`);
  if (h1Count !== 1) failures.push(`${file}: ${h1Count} H1-Elemente`);
  if (/<a\s+[^>]*href="\s*"/iu.test(html)) failures.push(`${file}: leerer Link`);
  if (!/property="og:image"\s+content="https:\/\//iu.test(html)) failures.push(`${file}: absolutes og:image fehlt`);
  if (!/name="twitter:image"\s+content="https:\/\//iu.test(html)) failures.push(`${file}: twitter:image fehlt`);
  if (/GovernmentOrganization/u.test(html)) failures.push(`${file}: GovernmentOrganization ist nicht zulässig`);

  if (title && !/dist\/client\/(?:404|500)\.html$/u.test(file)) {
    const duplicates = titles.get(title) ?? [];
    duplicates.push(file);
    titles.set(title, duplicates);
  }

  for (const match of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/giu)) {
    try {
      structuredData.push(JSON.parse(match[1]));
    } catch (error) {
      failures.push(`${file}: ungültiges JSON-LD (${error instanceof Error ? error.message : 'Parsefehler'})`);
    }
  }

  if (/^dist\/client\/recht\/norm\/[^/]+\/index\.html$/u.test(file)) {
    const legislation = structuredData.find((entry) => entry?.['@type'] === 'Legislation');
    if (!legislation) {
      failures.push(`${file}: strukturierte Gesetzesdaten fehlen`);
    } else {
      if (!legislation.name) failures.push(`${file}: Legislation.name fehlt`);
      if (!legislation.description) failures.push(`${file}: Legislation.description fehlt`);
      if (!legislation.legislationType) failures.push(`${file}: Legislation.legislationType fehlt`);
      if (!legislation.legislationIdentifier) {
        failures.push(`${file}: Vollzitat als Legislation.legislationIdentifier fehlt`);
      }
      if (legislation.url !== canonical) {
        failures.push(`${file}: Legislation.url weicht vom Canonical ab`);
      }
    }
  }
}

for (const [title, files] of titles) {
  if (files.length > 1) failures.push(`Titel mehrfach verwendet: „${title}“ (${files.join(', ')})`);
}

const searchHtml = await readFile('dist/client/suche/index.html', 'utf8');
if (!/<meta\s+name="robots"\s+content="noindex, follow"/iu.test(searchHtml)) {
  failures.push('dist/client/suche/index.html: noindex, follow fehlt');
}

const sitemap = await readFile('dist/client/sitemap.xml', 'utf8');
if (!sitemap.includes('<lastmod>')) failures.push('dist/sitemap.xml: lastmod fehlt vollständig');
if (sitemap.includes('/suche/')) failures.push('dist/sitemap.xml: nicht indexierbare Suche enthalten');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('SEO-QA erfolgreich.');
}

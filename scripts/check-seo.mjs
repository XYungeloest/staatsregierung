import { access, glob, readFile } from 'node:fs/promises';
import { normalizeSiteTargets } from './lib/site-targets.mjs';

const allSites = [
  {
    target: 'portal',
    name: 'Staatsportal',
    root: 'apps/portal/dist/client',
    origin: new URL(process.env.PORTAL_SITE_URL ?? 'https://freistaat-ostdeutschland.de').origin,
    siteName: 'Freistaat Ostdeutschland',
  },
  {
    target: 'law',
    name: 'OstRecht',
    root: 'apps/recht/dist/client',
    origin: new URL(process.env.LAW_SITE_URL ?? 'https://recht.freistaat-ostdeutschland.de').origin,
    siteName: 'OstRecht – Rechtsportal des Ostdeutschen Freistaates',
    normPattern: /^apps\/recht\/dist\/client\/norm\/[^/]+\/index\.html$/u,
  },
];

const selectedTargets = new Set(normalizeSiteTargets(process.env.SITE_TARGETS));
const sites = allSites.filter((site) => selectedTargets.has(site.target));

const failures = [];

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

for (const site of sites) {
  const titles = new Map();
  for await (const file of glob(`${site.root}/**/*.html`)) {
    const html = await readFile(file, 'utf8');
    const isRedirectDocument = /<meta\s+http-equiv="refresh"\s+content="0;url=[^"]+"/iu.test(html)
      && /<meta\s+name="robots"\s+content="noindex"/iu.test(html);
    const title = html.match(/<title>([^<]+)<\/title>/iu)?.[1]?.trim();
    const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/iu)?.[1]?.trim();
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/iu)?.[1]?.trim();
    const ogSiteName = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/iu)?.[1]?.trim();
    const h1Count = count(html, /<h1(?:\s[^>]*)?>/giu);
    const structuredData = [];

    if (isRedirectDocument) {
      if (!canonical) failures.push(`${file}: Redirect-Canonical fehlt`);
      else if (!canonical.startsWith(`${site.origin}/`) && canonical !== site.origin) failures.push(`${file}: Redirect-Canonical verwendet nicht ${site.origin}`);
      continue;
    }

    if (!title) failures.push(`${file}: Titel fehlt`);
    if (!description) failures.push(`${file}: Meta-Description fehlt`);
    if (!canonical) failures.push(`${file}: Canonical fehlt`);
    else if (!canonical.startsWith(`${site.origin}/`) && canonical !== site.origin) failures.push(`${file}: Canonical verwendet nicht ${site.origin}`);
    if (ogSiteName !== site.siteName) failures.push(`${file}: falscher OpenGraph-Site-Name`);
    if (h1Count !== 1) failures.push(`${file}: ${h1Count} H1-Elemente`);
    if (/<a\s+[^>]*href="\s*"/iu.test(html)) failures.push(`${file}: leerer Link`);
    if (!/property="og:image"\s+content="https:\/\//iu.test(html)) failures.push(`${file}: absolutes og:image fehlt`);
    if (!/name="twitter:image"\s+content="https:\/\//iu.test(html)) failures.push(`${file}: twitter:image fehlt`);
    if (/GovernmentOrganization/u.test(html)) failures.push(`${file}: GovernmentOrganization ist nicht zulässig`);
    if (site.name === 'OstRecht' && canonical?.includes('/recht/')) failures.push(`${file}: altes /recht/-Präfix im Canonical`);

    if (title && !/(?:404|500)\.html$/u.test(file)) {
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

    if (site.normPattern?.test(file)) {
      const legislation = structuredData.find((entry) => entry?.['@type'] === 'Legislation');
      if (!legislation) failures.push(`${file}: strukturierte Gesetzesdaten fehlen`);
      else {
        if (!legislation.name) failures.push(`${file}: Legislation.name fehlt`);
        if (!legislation.description) failures.push(`${file}: Legislation.description fehlt`);
        if (!legislation.legislationType) failures.push(`${file}: Legislation.legislationType fehlt`);
        if (!legislation.legislationIdentifier) failures.push(`${file}: Legislation.legislationIdentifier fehlt`);
        if (legislation.url !== canonical) failures.push(`${file}: Legislation.url weicht vom Canonical ab`);
      }
    }
  }

  for (const [title, files] of titles) {
    if (files.length > 1) failures.push(`${site.name}: Titel mehrfach verwendet: „${title}“ (${files.join(', ')})`);
  }

  const searchHtml = await readFile(`${site.root}/suche/index.html`, 'utf8');
  if (!/<meta\s+name="robots"\s+content="noindex, follow"/iu.test(searchHtml)) failures.push(`${site.root}/suche/index.html: noindex, follow fehlt`);

  const robots = await readFile(`${site.root}/robots.txt`, 'utf8');
  const sitemapPath = `${site.root}/sitemap.xml`;
  if (!(await access(sitemapPath).then(() => true, () => false))) {
    // OstRecht erzeugt die Sitemap zur Laufzeit aus D1; ihre Inhalte prüft der Deployment-Smoke.
    if (!robots.includes(`Sitemap: ${site.origin}/sitemap.xml`)) failures.push(`${site.root}/robots.txt: falsche Sitemap-URL`);
    console.log(`${site.name}: Sitemap wird zur Laufzeit erzeugt; statische Sitemap-Prüfung übersprungen.`);
    continue;
  }
  const sitemap = await readFile(sitemapPath, 'utf8');
  if (!sitemap.includes('<lastmod>')) failures.push(`${site.root}/sitemap.xml: lastmod fehlt vollständig`);
  if (sitemap.includes('/suche/')) failures.push(`${site.root}/sitemap.xml: nicht indexierbare Suche enthalten`);
  if ([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].some((match) => !match[1].startsWith(`${site.origin}/`))) failures.push(`${site.root}/sitemap.xml: fremde Origin enthalten`);
  if (!robots.includes(`Sitemap: ${site.origin}/sitemap.xml`)) failures.push(`${site.root}/robots.txt: falsche Sitemap-URL`);

  if (site.name === 'Staatsportal') {
    if (/\/recht\/(?:norm|verkuendungen|sachgebiete)\//u.test(sitemap)) failures.push('Portal-Sitemap enthält Rechtsdetails');
    if (!sitemap.includes(`${site.origin}/recht/`)) failures.push('Portal-Sitemap enthält die Brückenseite nicht');
  } else if (sitemap.includes('/recht/')) {
    failures.push('OstRecht-Sitemap enthält das alte /recht/-Präfix');
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`SEO-QA für ${sites.map((site) => site.name).join(' und ')} erfolgreich.`);
}

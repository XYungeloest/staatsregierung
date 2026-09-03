import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { normalizeSiteTargets } from './lib/site-targets.mjs';
import { loadOnDemandRoutePatterns } from './lib/on-demand-routes.mjs';

const allSites = [
  {
    target: 'portal',
    name: 'Staatsportal',
    origin: new URL(process.env.PORTAL_SITE_URL ?? 'https://freistaat-ostdeutschland.de').origin,
    outputRoot: resolve(process.cwd(), 'apps/portal/dist/client'),
    // Zur Laufzeit vom Worker ausgelieferte Routen (prerender = false) liegen nicht im Build-Output.
    onDemandRoutes: await loadOnDemandRoutePatterns(resolve(process.cwd(), 'apps/portal/src/pages')),
  },
  {
    target: 'law',
    name: 'OstRecht',
    origin: new URL(process.env.LAW_SITE_URL ?? 'https://recht.freistaat-ostdeutschland.de').origin,
    outputRoot: resolve(process.cwd(), 'apps/recht/dist/client'),
    onDemandRoutes: await loadOnDemandRoutePatterns(resolve(process.cwd(), 'apps/recht/src/pages')),
  },
];

const selectedTargets = new Set(normalizeSiteTargets(process.env.SITE_TARGETS));
const sites = allSites.filter((site) => selectedTargets.has(site.target));

const sitesByOrigin = new Map(sites.map((site) => [site.origin, site]));
const problems = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectHtmlFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectHtmlFiles(path, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

function resolveLink(href, sourceFile, sourceSite) {
  if (!href || /^(?:mailto:|tel:|data:|javascript:|#)/iu.test(href)) return undefined;

  if (/^(?:https?:)?\/\//iu.test(href)) {
    const url = new URL(href, sourceSite.origin);
    const targetSite = sitesByOrigin.get(url.origin);
    if (!targetSite) return undefined;
    if (targetSite.onDemandRoutes.some((pattern) => pattern.test(url.pathname))) return { onDemand: true };
    return { path: resolve(targetSite.outputRoot, `.${url.pathname}`) };
  }

  const pathname = href.replace(/[?#].*$/u, '');
  if (!pathname) return undefined;
  if (pathname.startsWith('/') && sourceSite.onDemandRoutes.some((pattern) => pattern.test(pathname))) {
    return { onDemand: true };
  }
  return {
    path: pathname.startsWith('/')
      ? resolve(sourceSite.outputRoot, `.${pathname}`)
      : resolve(dirname(sourceFile), pathname),
  };
}

let htmlCount = 0;
for (const site of sites) {
  const htmlFiles = await collectHtmlFiles(site.outputRoot);
  htmlCount += htmlFiles.length;

  for (const file of htmlFiles) {
    const html = (await readFile(file, 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/giu)) {
      const href = match[1];
      const resolved = resolveLink(href, file, site);
      if (!resolved || resolved.onDemand) continue;

      const candidates = [resolved.path, `${resolved.path}.html`, join(resolved.path, 'index.html')];
      if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
        problems.push(`${site.name}/${relative(site.outputRoot, file)}: ${href}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Defekte interne oder Cross-Site-Verweise (${problems.length}):\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Linkprüfung für ${sites.map((site) => site.name).join(' und ')} erfolgreich (${htmlCount} HTML-Dateien einschließlich Cross-Site-Links).`);
}

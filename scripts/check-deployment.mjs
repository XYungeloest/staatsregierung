#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FULL_COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const REPRESENTATIVE_NORM = '/norm/erstes-gesetz-zur-grossen-staatsreform/';

function normalizedOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} ist keine gültige absolute URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} muss HTTP oder HTTPS verwenden.`);
  return url.origin;
}

export function extractHtmlBuildCommit(html) {
  const tag = html.match(/<meta\s+[^>]*name=["']build-commit["'][^>]*>/iu)?.[0];
  return tag?.match(/content=["']([0-9a-f]{40})["']/iu)?.[1] ?? '';
}

async function checkedFetch(fetchImpl, url, init = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw new Error(`${url} konnte nicht abgerufen werden: ${error instanceof Error ? error.message : String(error)}`);
  }
  return response;
}

async function expectSuccessfulRoute(fetchImpl, url) {
  const response = await checkedFetch(fetchImpl, url);
  if (!response.ok) throw new Error(`${url} antwortet mit HTTP ${response.status}; erwartet wurde 2xx.`);
  return response;
}

export async function checkDeployment({
  portalSiteUrl,
  lawSiteUrl,
  expectedCommit,
  fetchImpl = fetch,
}) {
  const portalOrigin = normalizedOrigin(portalSiteUrl, 'PORTAL_SITE_URL');
  const lawOrigin = normalizedOrigin(lawSiteUrl, 'LAW_SITE_URL');
  if (!FULL_COMMIT_PATTERN.test(expectedCommit)) {
    throw new Error('EXPECTED_COMMIT muss ein vollständiger 40-stelliger Git-Commit sein.');
  }

  const portalPaths = ['/', '/recht/', '/sitemap.xml', '/robots.txt'];
  const lawPaths = ['/', '/suche/', REPRESENTATIVE_NORM, '/verkuendungen/', '/sitemap.xml', '/robots.txt'];
  const responses = new Map();

  for (const [origin, paths] of [[portalOrigin, portalPaths], [lawOrigin, lawPaths]]) {
    for (const path of paths) {
      const url = new URL(path, `${origin}/`).toString();
      responses.set(url, await expectSuccessfulRoute(fetchImpl, url));
    }
  }

  const legacyUrl = new URL(`/recht${REPRESENTATIVE_NORM}`, `${portalOrigin}/`).toString();
  const expectedRedirect = new URL(REPRESENTATIVE_NORM, `${lawOrigin}/`).toString();
  const redirect = await checkedFetch(fetchImpl, legacyUrl, { redirect: 'manual' });
  if (![301, 308].includes(redirect.status)) {
    throw new Error(`${legacyUrl} antwortet mit HTTP ${redirect.status}; erwartet wurde ein permanenter Redirect (301 oder 308).`);
  }
  const location = redirect.headers.get('location');
  const resolvedLocation = location ? new URL(location, legacyUrl).toString() : '';
  if (resolvedLocation !== expectedRedirect) {
    throw new Error(`${legacyUrl} verweist auf ${resolvedLocation || 'kein Ziel'}; erwartet wurde ${expectedRedirect}.`);
  }

  const commits = [];
  for (const origin of [portalOrigin, lawOrigin]) {
    const rootUrl = new URL('/', `${origin}/`).toString();
    const response = responses.get(rootUrl);
    const headerCommit = response.headers.get('x-portal-commit') ?? '';
    const htmlCommit = extractHtmlBuildCommit(await response.text());
    commits.push({ origin, headerCommit, htmlCommit });
  }

  for (const entry of commits) {
    if (entry.headerCommit !== expectedCommit) {
      throw new Error(`${entry.origin}: X-Portal-Commit ist ${entry.headerCommit || 'nicht gesetzt'}; erwartet wurde ${expectedCommit}.`);
    }
    if (entry.htmlCommit !== expectedCommit) {
      throw new Error(`${entry.origin}: meta[name="build-commit"] ist ${entry.htmlCommit || 'nicht gesetzt'}; erwartet wurde ${expectedCommit}.`);
    }
  }

  return {
    portalOrigin,
    lawOrigin,
    checkedRoutes: portalPaths.length + lawPaths.length,
    redirect: { source: legacyUrl, target: expectedRedirect, status: redirect.status },
    commit: expectedCommit,
  };
}

async function main() {
  const portalSiteUrl = process.env.PORTAL_SITE_URL ?? '';
  const lawSiteUrl = process.env.LAW_SITE_URL ?? '';
  const expectedCommit = process.env.EXPECTED_COMMIT ?? '';
  const attempts = Number.parseInt(process.env.DEPLOYMENT_SMOKE_ATTEMPTS ?? '6', 10);
  const retryDelayMs = Number.parseInt(process.env.DEPLOYMENT_SMOKE_RETRY_MS ?? '5000', 10);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await checkDeployment({ portalSiteUrl, lawSiteUrl, expectedCommit });
      console.log(`Produktions-Smoketest erfolgreich: ${result.checkedRoutes} Routen, permanenter Altpfad-Redirect und Commit ${result.commit} auf beiden Origins geprüft.`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Produktions-Smoketest Versuch ${attempt}/${attempts} fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelayMs));
    }
  }

  throw lastError;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

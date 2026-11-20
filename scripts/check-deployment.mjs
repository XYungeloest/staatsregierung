#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateBuildInfo } from './lib/release-info.mjs';
import { normalizeSiteTargets } from './lib/site-targets.mjs';

const FULL_COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const REPRESENTATIVE_NORM = '/norm/erstes-gesetz-zur-grossen-staatsreform/';

export function normalizeDeploymentTargets(value) {
  return normalizeSiteTargets(value);
}

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

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

function ancestor(older, newer) {
  if (!FULL_COMMIT_PATTERN.test(older) || !FULL_COMMIT_PATTERN.test(newer)) return false;
  return spawnSync('git', ['merge-base', '--is-ancestor', older, newer]).status === 0;
}

async function checkedFetch(fetchImpl, url, init = {}) {
  let response;
  const headers = new Headers(init.headers);
  if (!headers.has('user-agent')) {
    headers.set('user-agent', 'OstRecht-Deployment-Smoke/1.0 (+https://github.com/XYungeloest/staatsregierung)');
  }
  if (!headers.has('accept')) headers.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-cache');
  try {
    response = await fetchImpl(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw failure('deployment-incomplete', `${url} konnte nicht abgerufen werden: ${error instanceof Error ? error.message : String(error)}`);
  }
  return response;
}

async function expectSuccessfulRoute(fetchImpl, url) {
  const response = await checkedFetch(fetchImpl, url, { redirect: 'manual' });
  if (!response.ok) throw failure('deployment-incomplete', `${url} antwortet mit HTTP ${response.status}; erwartet wurde 2xx.`);
  return response;
}

/**
 * `representativeNorm` ist die Normadresse, deren Altpfad im Staatsportal permanent auf OstRecht
 * weiterleiten muss; produktiv die feste reale Norm (REPRESENTATIVE_NORM), in Unit-Tests ein
 * synthetischer Pfad.
 */
export async function checkDeployment({
  portalSiteUrl,
  lawSiteUrl,
  expectedCommit,
  targets,
  fetchImpl = fetch,
  expectedBuilds,
  repositoryCommit,
  isAncestor = ancestor,
  verifyProjection = false,
  representativeNorm = REPRESENTATIVE_NORM,
}) {
  const selectedTargets = normalizeDeploymentTargets(targets);
  const checksPortal = selectedTargets.includes('portal');
  const checksLaw = selectedTargets.includes('law');
  const portalOrigin = checksPortal ? normalizedOrigin(portalSiteUrl, 'PORTAL_SITE_URL') : undefined;
  // Die Portalprüfung kontrolliert zusätzlich den Zielorigin des permanenten
  // /recht/-Redirects, auch wenn nur das Portal ausgeliefert wurde.
  const lawOrigin = checksLaw || checksPortal ? normalizedOrigin(lawSiteUrl, 'LAW_SITE_URL') : undefined;
  if (repositoryCommit !== undefined && !FULL_COMMIT_PATTERN.test(repositoryCommit)) throw new Error('REPOSITORY_COMMIT ist ungültig.');
  for (const target of selectedTargets) {
    if (expectedBuilds) {
      const expected = validateBuildInfo(expectedBuilds[target], target);
      if (expectedCommit && expectedCommit !== expected.commit) throw new Error('Freigabeartefakt widerspricht EXPECTED_COMMIT.');
    }
  }
  if (!expectedBuilds && !FULL_COMMIT_PATTERN.test(expectedCommit)) {
    throw new Error('EXPECTED_COMMIT muss ein vollständiger 40-stelliger Git-Commit sein.');
  }

  const portalPaths = ['/', '/recht/', '/sitemap.xml', '/robots.txt'];
  const lawPaths = ['/', '/suche/', representativeNorm, '/verkuendungen/', '/sitemap.xml', '/robots.txt'];
  const responses = new Map();

  const routeGroups = [
    ...(checksPortal ? [[portalOrigin, portalPaths]] : []),
    ...(checksLaw ? [[lawOrigin, lawPaths]] : []),
  ];
  for (const [origin, paths] of routeGroups) {
    for (const path of paths) {
      const url = new URL(path, `${origin}/`).toString();
      responses.set(url, await expectSuccessfulRoute(fetchImpl, url));
    }
  }
  const checkedRoutes = routeGroups.reduce((total, [, paths]) => total + paths.length, 0);

  let redirect;
  let legacyUrl;
  let expectedRedirect;
  if (checksPortal) {
    legacyUrl = new URL(`/recht${representativeNorm}`, `${portalOrigin}/`).toString();
    expectedRedirect = new URL(representativeNorm, `${lawOrigin}/`).toString();
    redirect = await checkedFetch(fetchImpl, legacyUrl, { redirect: 'manual' });
    if (![301, 308].includes(redirect.status)) {
      throw failure('inconsistent', `${legacyUrl} antwortet mit HTTP ${redirect.status}; erwartet wurde ein permanenter Redirect (301 oder 308).`);
    }
    const location = redirect.headers.get('location');
    const resolvedLocation = location ? new URL(location, legacyUrl).toString() : '';
    if (resolvedLocation !== expectedRedirect) {
      throw failure('inconsistent', `${legacyUrl} verweist auf ${resolvedLocation || 'kein Ziel'}; erwartet wurde ${expectedRedirect}.`);
    }
  }

  const releases = [];
  for (const target of selectedTargets) {
    const origin = target === 'portal' ? portalOrigin : lawOrigin;
    const root = responses.get(origin + '/');
    const html = await root.text();
    const commit = root.headers.get('x-portal-commit');
    if (!commit || extractHtmlBuildCommit(html) !== commit) {
      throw failure('inconsistent', origin + ': X-Portal-Commit und meta[name="build-commit"] widersprechen einander.');
    }
    const expected = expectedBuilds?.[target];
    if (expected) {
      const response = await expectSuccessfulRoute(fetchImpl, origin + '/build-info.json');
      let live;
      try {
        live = validateBuildInfo(await response.json(), target);
      } catch {
        throw failure('inconsistent', origin + ': ungültiges öffentliches Buildmanifest.');
      }
      const htmlId = html.match(/<meta\s+[^>]*name=["']build-id["'][^>]*>/iu)?.[0]?.match(/content=["']([^"']+)["']/iu)?.[1];
      if (live.commit !== commit || live.buildId !== htmlId) throw failure('inconsistent', origin + ': HTML und Buildmanifest widersprechen einander.');
      const paths = target === 'portal' ? portalPaths : lawPaths;
      for (const [path, res] of [...paths.map((path) => [path, responses.get(origin + path)]), ['/build-info.json', response]]) {
        if (res.headers.get('x-portal-build') !== live.buildId || res.headers.get('x-portal-commit') !== live.commit) {
          throw failure('inconsistent', origin + path + ': Routenheader widersprechen dem Buildmanifest.');
        }
      }
      if (live.commit !== expected.commit || live.buildId !== expected.buildId) {
        const previous = live.commit === expected.commit
          ? live.builtAt < expected.builtAt
          : isAncestor(live.commit, expected.commit);
        throw failure(previous ? 'deployment-incomplete' : 'inconsistent', origin + ': Build ' + live.buildId + ' ausgeliefert, freigegeben ist ' + expected.buildId);
      }
      for (const field of ['builtAt', 'referenceDate', 'projectionFingerprint']) {
        if (live[field] !== expected[field]) throw failure('inconsistent', origin + ': ' + field + ' weicht vom Freigabeartefakt ab.');
      }
      let verifiedProjection = null;
      if (target === 'law' && verifyProjection && expected.projectionFingerprint) {
        const status = await expectSuccessfulRoute(fetchImpl, origin + '/api/projektionsstand.json');
        const data = await status.json().catch(() => null);
        if (data?.fingerprint !== expected.projectionFingerprint) throw failure('inconsistent', origin + ': D1-Projektion weicht vom Freigabeartefakt ab.');
        verifiedProjection = data.fingerprint;
      }
      const pending = repositoryCommit && repositoryCommit !== commit && isAncestor(commit, repositoryCommit);
      releases.push({ target, status: pending ? 'repository-pending' : 'expected', build: expected, verifiedProjection });
    } else if (commit !== expectedCommit) {
      throw failure('inconsistent', `${origin}: X-Portal-Commit ist ${commit}; erwartet wurde ${expectedCommit}.`);
    }
  }

  return {
    portalOrigin,
    lawOrigin,
    targets: selectedTargets,
    checkedRoutes,
    redirect: redirect
      ? { source: legacyUrl, target: expectedRedirect, status: redirect.status }
      : null,
    commit: expectedCommit || releases[0]?.build.commit,
    releases,
  };
}

async function main() {
  const portalSiteUrl = process.env.PORTAL_SITE_URL ?? '';
  const lawSiteUrl = process.env.LAW_SITE_URL ?? '';
  const expectedCommit = process.env.EXPECTED_COMMIT ?? '';
  const attempts = Number(process.env.DEPLOYMENT_SMOKE_ATTEMPTS ?? 12);
  const retryDelayMs = Number(process.env.DEPLOYMENT_SMOKE_RETRY_MS ?? 10_000);
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error('Ungültige Wiederholungsparameter.');
  const targets = normalizeDeploymentTargets(process.env.DEPLOY_TARGETS);
  const files = { portal: process.env.EXPECTED_PORTAL_BUILD, law: process.env.EXPECTED_LAW_BUILD };
  const reports = await Promise.all(targets.map(async (target) => {
    const artifact = files[target] ? JSON.parse(await readFile(files[target], 'utf8')) : null;
    if (!artifact && Object.values(files).some(Boolean)) throw new Error('Freigabeartefakt fehlt: ' + target);
    const expected = artifact && validateBuildInfo(artifact.build ?? artifact, target);
    let outcome;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await checkDeployment({
          portalSiteUrl, lawSiteUrl, expectedCommit, targets: [target],
          expectedBuilds: expected ? { [target]: expected } : undefined,
          repositoryCommit: process.env.REPOSITORY_COMMIT,
          verifyProjection: process.env.VERIFY_RELEASE_PROJECTION === '1',
        });
        outcome = result.releases[0] ?? { target, status: 'expected', commit: result.commit };
        break;
      } catch (error) {
        if (!error.status) throw error;
        outcome = { target, status: error.status, message: error.message, build: expected };
        console.error(`${target} (${attempt}/${attempts}): ${error.message}`);
        if (attempt < attempts) await new Promise((done) => setTimeout(done, retryDelayMs));
      }
    }
    const report = { ...outcome, observedAt: new Date().toISOString() };
    if (process.env.RELEASE_EVIDENCE_DIR) {
      await mkdir(process.env.RELEASE_EVIDENCE_DIR, { recursive: true });
      await writeFile(join(process.env.RELEASE_EVIDENCE_DIR, target + '.json'), JSON.stringify(report, null, 2) + '\n');
    }
    return report;
  }));
  console.log(JSON.stringify(reports, null, 2));
  if (reports.some((report) => !['expected', 'repository-pending'].includes(report.status))) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

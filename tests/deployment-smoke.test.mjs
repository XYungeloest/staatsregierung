import assert from 'node:assert/strict';
import test from 'node:test';

import { checkDeployment, extractHtmlBuildCommit } from '../scripts/check-deployment.mjs';

const portalOrigin = 'https://portal.test.invalid';
const lawOrigin = 'https://recht.test.invalid';
const commit = '1234567890abcdef1234567890abcdef12345678';
const representativeNorm = '/norm/testgesetz/';

function html(buildCommit = commit) {
  return `<!doctype html><html><head><meta name="build-commit" content="${buildCommit}" /></head></html>`;
}

function createFetch({ portalCommit = commit, lawCommit = commit, redirectTarget = `${lawOrigin}${representativeNorm}` } = {}) {
  return async (input, init = {}) => {
    const url = String(input);
    if (url === `${portalOrigin}/recht${representativeNorm}` && init.redirect === 'manual') {
      return new Response(null, { status: 301, headers: { location: redirectTarget } });
    }
    if (url.startsWith(portalOrigin)) {
      return new Response(url === `${portalOrigin}/` ? html(portalCommit) : 'ok', {
        status: 200,
        headers: { 'x-portal-commit': portalCommit },
      });
    }
    if (url.startsWith(lawOrigin)) {
      return new Response(url === `${lawOrigin}/` ? html(lawCommit) : 'ok', {
        status: 200,
        headers: { 'x-portal-commit': lawCommit },
      });
    }
    return new Response('not found', { status: 404 });
  };
}

test('Buildkennung wird aus dem HTML-Kopf gelesen', () => {
  assert.equal(extractHtmlBuildCommit(html()), commit);
  assert.equal(extractHtmlBuildCommit('<html></html>'), '');
});

test('Produktions-Smoketest prüft beide Sites, Altpfad und gemeinsame Commitkennung', async () => {
  const result = await checkDeployment({
    portalSiteUrl: portalOrigin,
    lawSiteUrl: lawOrigin,
    expectedCommit: commit, representativeNorm,
    fetchImpl: createFetch(),
  });

  assert.ok(result.checkedRoutes > 0);
  assert.deepEqual(result.redirect, {
    source: `${portalOrigin}/recht${representativeNorm}`,
    target: `${lawOrigin}${representativeNorm}`,
    status: 301,
  });
});

test('Produktions-Smoketest kennzeichnet seine Abrufe und umgeht keine veralteten Cacheantworten', async () => {
  const requests = [];
  const baseFetch = createFetch();
  await checkDeployment({
    portalSiteUrl: portalOrigin,
    lawSiteUrl: lawOrigin,
    expectedCommit: commit, representativeNorm,
    fetchImpl: async (input, init) => {
      requests.push(init);
      return baseFetch(input, init);
    },
  });

  assert.ok(requests.length > 0);
  for (const request of requests) {
    assert.match(request.headers.get('user-agent'), /^OstRecht-Deployment-Smoke\//u);
    assert.equal(request.headers.get('cache-control'), 'no-cache');
  }
});

test('unterschiedliche ausgelieferte Commits lassen den Smoketest klar scheitern', async () => {
  await assert.rejects(
    checkDeployment({
      portalSiteUrl: portalOrigin,
      lawSiteUrl: lawOrigin,
      expectedCommit: commit, representativeNorm,
      fetchImpl: createFetch({ lawCommit: 'abcdef1234567890abcdef1234567890abcdef12' }),
    }),
    /X-Portal-Commit.*erwartet/u,
  );
});

test('Portal-only-Deployment prüft keinen unveränderten Rechtsportal-Commit', async () => {
  const requests = [];
  const result = await checkDeployment({
    portalSiteUrl: portalOrigin,
    lawSiteUrl: lawOrigin,
    expectedCommit: commit, representativeNorm,
    targets: ['portal'],
    fetchImpl: async (input, init) => {
      requests.push(String(input));
      return createFetch({ lawCommit: 'abcdef1234567890abcdef1234567890abcdef12' })(input, init);
    },
  });

  assert.deepEqual(result.targets, ['portal']);
  assert.ok(result.redirect);
  assert.equal(requests.some((url) => url.startsWith(`${lawOrigin}/`)), false);
});

test('ein falsches Ziel des permanenten Altpfads wird abgewiesen', async () => {
  await assert.rejects(
    checkDeployment({
      portalSiteUrl: portalOrigin,
      lawSiteUrl: lawOrigin,
      expectedCommit: commit, representativeNorm,
      fetchImpl: createFetch({ redirectTarget: `${lawOrigin}/suche/` }),
    }),
    /erwartet wurde.*testgesetz/u,
  );
});

const release = {
  schemaVersion: 1, target: 'law', commit, buildId: 'law-840.1', builtAt: '2032-10-03T10:00:00.000Z',
  referenceDate: '2032-09-01', projectionFingerprint: 'a'.repeat(64),
};

function inspect({ live = release, actual = live.projectionFingerprint, mixedPath, unavailable, ...options } = {}) {
  return checkDeployment({
    lawSiteUrl: lawOrigin, targets: ['law'], expectedBuilds: { law: release }, representativeNorm, verifyProjection: true,
    fetchImpl: async (input) => {
      const path = new URL(input).pathname;
      const headers = { 'x-portal-commit': live.commit, 'x-portal-build': path === mixedPath ? 'anderer-build' : live.buildId };
      if (path === unavailable) return new Response(null, { status: 503 });
      if (path === '/build-info.json') return Response.json(live, { headers });
      if (path === '/api/projektionsstand.json') return Response.json({ fingerprint: actual }, { headers });
      return new Response(html(live.commit).replace('</head>', '<meta name="build-id" content="' + live.buildId + '"></head>'), { headers });
    }, ...options,
  });
}

test('Freigabeartefakt bestätigt Build, Stichtag und D1 auch bei einem neueren Repository-Stand', async () => {
  assert.equal((await inspect()).releases[0].status, 'expected');
  const { releases } = await inspect({ repositoryCommit: 'b'.repeat(40), isAncestor: () => true });
  assert.equal(releases[0].status, 'repository-pending');
  assert.equal(releases[0].verifiedProjection, release.projectionFingerprint);
});

test('Nachkontrolle trennt ausstehende Auslieferung und widersprüchliche Freigabedaten', async () => {
  await assert.rejects(inspect({ unavailable: '/suche/' }), { status: 'deployment-incomplete' });
  await assert.rejects(inspect({ live: { ...release, commit: 'c'.repeat(40) }, isAncestor: () => true }), { status: 'deployment-incomplete' });
  for (const options of [
    { mixedPath: '/robots.txt' }, { actual: 'b'.repeat(64) },
    { live: { ...release, referenceDate: '2032-09-02' } },
    { live: { ...release, buildId: 'law-999.1' } },
  ]) await assert.rejects(inspect(options), { status: 'inconsistent' });
});

test('eine spätere unabhängige D1-Projektion ändert den archivierten Buildnachweis nicht', async () => {
  const { releases } = await inspect({ verifyProjection: false, actual: 'b'.repeat(64) });
  assert.equal(releases[0].status, 'expected');
  assert.equal(releases[0].verifiedProjection, null);
});

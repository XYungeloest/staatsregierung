import assert from 'node:assert/strict';
import test from 'node:test';

import { checkDeployment, extractHtmlBuildCommit } from '../scripts/check-deployment.mjs';

const portalOrigin = 'https://portal.test.invalid';
const lawOrigin = 'https://recht.test.invalid';
const commit = '1234567890abcdef1234567890abcdef12345678';
const representativeNorm = '/norm/erstes-gesetz-zur-grossen-staatsreform/';

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
    expectedCommit: commit,
    fetchImpl: createFetch(),
  });

  assert.equal(result.checkedRoutes, 10);
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
    expectedCommit: commit,
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
      expectedCommit: commit,
      fetchImpl: createFetch({ lawCommit: 'abcdef1234567890abcdef1234567890abcdef12' }),
    }),
    /X-Portal-Commit.*erwartet/u,
  );
});

test('ein falsches Ziel des permanenten Altpfads wird abgewiesen', async () => {
  await assert.rejects(
    checkDeployment({
      portalSiteUrl: portalOrigin,
      lawSiteUrl: lawOrigin,
      expectedCommit: commit,
      fetchImpl: createFetch({ redirectTarget: `${lawOrigin}/suche/` }),
    }),
    /erwartet wurde.*erstes-gesetz/u,
  );
});

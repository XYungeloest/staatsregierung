import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  GitHubAdapterError,
  GitHubAppRepository,
  MemoryEditorialRepository,
  type EditorialSubmission,
  type GitHubEditorialEnv,
} from '../src/editorial-worker/github.ts';

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const env: GitHubEditorialEnv = {
  APP_ENV: 'test',
  GITHUB_APP_ID: '123',
  GITHUB_APP_INSTALLATION_ID: '456',
  GITHUB_APP_PRIVATE_KEY: privateKey,
  GITHUB_OWNER: 'land',
  GITHUB_REPOSITORY: 'portal',
  GITHUB_BASE_BRANCH: 'main',
};

function submission(overrides: Partial<EditorialSubmission> = {}): EditorialSubmission {
  return {
    type: 'home', slug: 'home', title: 'Startseite ändern', editorEmail: 'redaktion@example.test', expectedBaseSha: 'sha-base',
    changes: [{ path: 'content/portal/home.json', content: '{"title":"Neu"}\n' }, { path: 'public/images/editorial/bild.jpg', content: new Uint8Array([0xff, 0xd8, 0xff]) }],
    routes: ['/'], checks: ['npm run content:check'], ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('der Mock-Adapter schreibt mehrere Dateien atomar und erkennt eine veraltete Basis-SHA', async () => {
  const repository = new MemoryEditorialRepository({ 'content/portal/home.json': '{}\n' }, 'sha-base');
  const result = await repository.submit(submission());
  assert.equal(result.pullRequestNumber, 1);
  assert.equal(repository.submissions[0].changes.length, 2);
  assert.equal(await repository.readFile('content/portal/home.json'), '{"title":"Neu"}\n');
  await assert.rejects(() => repository.submit(submission({ expectedBaseSha: 'veraltet' })), (error: unknown) => error instanceof GitHubAdapterError && error.code === 'conflict');
  assert.equal(repository.submissions.length, 1);
});

test('der GitHub-App-Adapter erstellt einen einzigen Multi-Datei-Commit und einen Draft Pull Request', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  let blobNumber = 0;
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input); const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
    calls.push({ url, method, body });
    if (url.includes('/app/installations/')) return jsonResponse({ token: 'installation-token', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    if (url.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'sha-base' } });
    if (url.includes('/git/ref/heads/redaktion/')) return jsonResponse({ message: 'Not Found' }, 404);
    if (url.endsWith('/git/refs') && method === 'POST') return jsonResponse({});
    if (url.endsWith('/git/blobs') && method === 'POST') return jsonResponse({ sha: `blob-${++blobNumber}` });
    if (url.endsWith('/git/commits/sha-base')) return jsonResponse({ tree: { sha: 'tree-base' } });
    if (url.endsWith('/git/trees') && method === 'POST') return jsonResponse({ sha: 'tree-new' });
    if (url.endsWith('/git/commits') && method === 'POST') return jsonResponse({ sha: 'commit-new' });
    if (url.includes('/git/refs/heads/redaktion/') && method === 'PATCH') return jsonResponse({});
    if (url.includes('/pulls?state=open')) return jsonResponse([]);
    if (url.endsWith('/pulls') && method === 'POST') {
      assert.equal((body as Record<string, unknown>).draft, true);
      return jsonResponse({ number: 17, html_url: 'https://github.example/pr/17' });
    }
    return jsonResponse({ message: `Unerwartet: ${method} ${url}` }, 500);
  };
  const repository = new GitHubAppRepository(env, fetcher);
  const result = await repository.submit(submission());
  assert.equal(result.pullRequestNumber, 17);
  assert.equal(result.updated, false);
  const treeCall = calls.find((call) => call.url.endsWith('/git/trees') && call.method === 'POST');
  assert.equal(((treeCall?.body as { tree: unknown[] }).tree).length, 2);
  assert.equal(calls.filter((call) => call.url.endsWith('/git/commits') && call.method === 'POST').length, 1);
  assert.equal(calls.filter((call) => call.url.endsWith('/git/refs/heads/redaktion/home/home-sha-bas') && call.method === 'PATCH').length, 1);
});

test('ein vorhandener Draft Pull Request wird aktualisiert', async () => {
  let pullPatchSeen = false;
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input); const method = init.method ?? 'GET';
    if (url.includes('/app/installations/')) return jsonResponse({ token: 'token', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    if (url.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'sha-base' } });
    if (url.includes('/git/ref/heads/redaktion/')) return jsonResponse({ object: { sha: 'sha-branch' } });
    if (url.endsWith('/git/blobs')) return jsonResponse({ sha: 'blob' });
    if (url.endsWith('/git/commits/sha-branch')) return jsonResponse({ tree: { sha: 'tree-base' } });
    if (url.endsWith('/git/trees')) return jsonResponse({ sha: 'tree-new' });
    if (url.endsWith('/git/commits')) return jsonResponse({ sha: 'commit-new' });
    if (url.includes('/git/refs/heads/redaktion/') && method === 'PATCH') return jsonResponse({});
    if (url.includes('/pulls?state=open')) return jsonResponse([{ number: 4, html_url: 'https://github.example/pr/4' }]);
    if (url.endsWith('/pulls/4') && method === 'PATCH') { pullPatchSeen = true; return jsonResponse({ number: 4, html_url: 'https://github.example/pr/4' }); }
    return jsonResponse({ message: 'Unerwartet' }, 500);
  };
  const result = await new GitHubAppRepository(env, fetcher).submit(submission({ changes: submission().changes.slice(0, 1) }));
  assert.equal(result.updated, true);
  assert.equal(pullPatchSeen, true);
});

test('Tokenfehler der GitHub App werden eindeutig gemeldet', async () => {
  const fetcher: typeof fetch = async () => jsonResponse({ message: 'Bad credentials' }, 401);
  const repository = new GitHubAppRepository(env, fetcher);
  await assert.rejects(() => repository.getBaseRevision(), (error: unknown) => error instanceof GitHubAdapterError && error.code === 'token' && error.status === 401);
});

test('bei einem Basiswechsel nach den Blob-Uploads entsteht kein Teil-Commit', async () => {
  let mainReads = 0; let commitCreated = false;
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input); const method = init.method ?? 'GET';
    if (url.includes('/app/installations/')) return jsonResponse({ token: 'token', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    if (url.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: ++mainReads === 1 ? 'sha-base' : 'sha-neu' } });
    if (url.includes('/git/ref/heads/redaktion/')) return jsonResponse({ message: 'Not Found' }, 404);
    if (url.endsWith('/git/refs') && method === 'POST') return jsonResponse({});
    if (url.endsWith('/git/blobs')) return jsonResponse({ sha: 'blob' });
    if (url.endsWith('/git/commits') && method === 'POST') commitCreated = true;
    return jsonResponse({});
  };
  await assert.rejects(() => new GitHubAppRepository(env, fetcher).submit(submission({ changes: submission().changes.slice(0, 1) })), (error: unknown) => error instanceof GitHubAdapterError && error.code === 'conflict');
  assert.equal(commitCreated, false);
});

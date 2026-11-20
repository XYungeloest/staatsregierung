import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkKnowledgeAssets, internalKnowledgeGuard } from '../scripts/lib/internal-knowledge.mjs';

test('Öffentliche Builds prüfen Modulimporte und kopierte Wissensdateien', async (t) => {
  const { load } = internalKnowledgeGuard();
  for (const name of ['knowledge/projects.json?raw', 'packages/knowledge-query/query.mjs']) {
    assert.throws(() => load(resolve(name)), /öffentlichen Modulgraphen/);
  }
  assert.equal(load(resolve('content/portal/home.json')), null);
  const client = await mkdtemp(join(tmpdir(), 'public-knowledge-'));
  t.after(() => rm(client, { recursive: true, force: true }));
  await mkdir(join(client, 'api'));
  await checkKnowledgeAssets(client);
  await writeFile(join(client, 'api/conversation-candidates.json'), '{}');
  await assert.rejects(checkKnowledgeAssets(client), /conversation-candidates/);
});

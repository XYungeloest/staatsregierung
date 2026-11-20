import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import test from 'node:test';

test('Lokaler MCP-Transport bietet begrenzte Leseabfragen und weist Pfadparameter zurück', { timeout: 15_000 }, async (t) => {
  const entry = `
    import { serveStdio } from '@modelcontextprotocol/server/stdio';
    import { createServer } from './packages/knowledge-query/mcp.mjs';
    import { createKnowledgeQuery } from './packages/knowledge-query/query.mjs';
    import { syntheticKnowledge } from './tests/helpers/knowledge-query-fixture.mjs';
    serveStdio(() => createServer(createKnowledgeQuery(syntheticKnowledge())));
  `;
  const proc = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', entry], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => proc.kill());
  const lines = createInterface({ input: proc.stdout })[Symbol.asyncIterator]();
  async function call(id, method, params) {
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    const line = await lines.next();
    assert.equal(line.done, false);
    const response = JSON.parse(line.value);
    assert.equal(response.id, id);
    return response;
  }
  const opening = await call(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.ok(opening.result.capabilities.tools);
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const listed = await call(2, 'tools/list', {});
  assert.ok(listed.result.tools.some((tool) => tool.name === 'analyze_publication_impact'));
  assert.ok(listed.result.tools.every((tool) => tool.annotations.readOnlyHint && !tool.annotations.openWorldHint));
  const invalid = await call(3, 'tools/call', { name: 'get_legal_state', arguments: { norm: '../fremd' } });
  assert.ok(invalid.error || invalid.result.isError);
  const searched = await call(4, 'tools/call', { name: 'search_knowledge', arguments: { query: 'Bauwesen' } });
  assert.equal(searched.result.structuredContent.total, 2);
  proc.stdin.end();
});

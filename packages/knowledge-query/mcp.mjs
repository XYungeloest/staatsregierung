import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createKnowledgeQuery } from './query.mjs';
import { tools } from './tools.mjs';

export function createServer(query) {
  const server = new McpServer({ name: 'staatsregierung-wissenshub', version: '1.0.0' });
  for (const [name, config] of Object.entries(tools)) {
    server.registerTool(name, {
      ...config, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, (params) => {
      const result = (query ?? createKnowledgeQuery())(name, params);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    });
  }
  return server;
}

if (import.meta.main) serveStdio(() => createServer());

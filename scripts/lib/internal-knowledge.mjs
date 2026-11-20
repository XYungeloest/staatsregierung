import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function privateKnowledgeModule(id) {
  const file = relative(root, id.split('?')[0]).split(sep).join('/');
  return ['knowledge/', 'packages/knowledge-query/'].some((prefix) => file.startsWith(prefix));
}

export function internalKnowledgeGuard() {
  return { name: 'internal-knowledge', enforce: 'pre', load(id) {
    if (privateKnowledgeModule(id)) throw new Error('Interne Wissensquelle im öffentlichen Modulgraphen: ' + id);
    return null;
  } };
}

// Auch unverarbeitet kopierte Quellen in den statischen Assets erfassen.
export async function checkKnowledgeAssets(client) {
  const names = new Set(['implementation-mandates.json', 'conversation-candidates.json', 'LLM_CONTEXT.md']);
  for (const item of await readdir(client, { recursive: true, withFileTypes: true })) {
    const path = relative(client, join(item.parentPath ?? item.path, item.name)).split(sep);
    if (path.includes('knowledge') || path.includes('knowledge-query') || names.has(item.name)) {
      throw new Error('Interne Wissensdatei im öffentlichen Build: ' + path.join('/'));
    }
  }
}

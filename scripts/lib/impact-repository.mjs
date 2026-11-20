import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNormHistory, parseNormMeta } from '@ostrecht/shared/lib/norms/schema.ts';
import { loadModel } from '../knowledge.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const validId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,219}$/u.test(value);
export const normFile = (slug, file) => 'content/normen/' + slug + '/' + file;
export const versionFile = (slug, id) => normFile(slug, 'versions/' + id + '.json');

export function readVersion(slug, id, root = repositoryRoot) {
  if (!validId(slug) || !validId(id)) throw new Error('Ungültige Norm- oder Fassungskennung.');
  try {
    const version = JSON.parse(readFileSync(join(root, versionFile(slug, id)), 'utf8'));
    if (version.versionId !== id) throw new Error('Fassungskennung weicht vom Dateinamen ab: ' + id);
    return version;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Für Rückverweise genügen Metadaten und Historien. Nur tatsächlich betroffene Fassungen öffnen.
export function loadImpactRepository(root = repositoryRoot, knowledge = loadModel(root)) {
  const read = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
  const documents = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).sort()
    .map((file) => read(dir + '/' + file));
  const slugs = readdirSync(join(root, 'content/normen'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const norms = slugs.map((slug) => {
    const meta = normFile(slug, 'meta.json');
    const history = normFile(slug, 'history.json');
    const record = { meta: parseNormMeta(read(meta), meta), history: parseNormHistory(read(history), history), versions: [] };
    if (record.meta.slug !== slug) throw new Error('Normkennung weicht vom Verzeichnis ab: ' + slug);
    return record;
  });
  return {
    norms, publications: documents('content/verkuendungen'), topics: documents('content/themen'),
    coverage: read('content/portal/topic-coverage.json'), knowledge,
    consolidation: read('data/recht/consolidation-manifest.json'), readVersion: (slug, id) => readVersion(slug, id, root),
  };
}

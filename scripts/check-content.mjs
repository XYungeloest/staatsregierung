import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const contentRoot = join(root, 'content');
const publicRoot = join(root, 'public');
const problems = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path);
    }
  }

  return files.sort((left, right) => left.localeCompare(right, 'de'));
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    problems.push(`${relative(root, path)}: enthält ungültiges JSON (${error.message})`);
    return undefined;
  }
}

function addProblem(path, message) {
  problems.push(`${relative(root, path)}: ${message}`);
}

function collectImagePaths(value, paths = []) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectImagePaths(entry, paths);
    }
    return paths;
  }

  if (!value || typeof value !== 'object') {
    return paths;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === 'string' &&
      /^(?:bild|image|hero)$/iu.test(key) &&
      entry.startsWith('/images/')
    ) {
      paths.push(entry);
    }
    collectImagePaths(entry, paths);
  }

  return paths;
}

function slugFromFile(path) {
  return basename(path, extname(path));
}

const files = await listJsonFiles(contentRoot);
const records = [];

for (const file of files) {
  const json = await readJson(file);
  if (json !== undefined) {
    records.push({ file, json });
  }
}

const byPrefix = (prefix) =>
  records.filter(({ file }) => relative(contentRoot, file).startsWith(prefix));

const ministrySlugs = new Set(byPrefix('ressorts/').map(({ json }) => json.slug).filter(Boolean));
const topicSlugs = new Set(byPrefix('themen/').map(({ json }) => json.slug).filter(Boolean));
const pressSlugs = new Set(byPrefix('presse/mitteilungen/').map(({ json }) => json.slug).filter(Boolean));
const normSlugs = new Set(
  byPrefix('normen/')
    .filter(({ file }) => basename(file) === 'meta.json')
    .map(({ json }) => json.slug)
    .filter(Boolean),
);

for (const { file, json } of records) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    addProblem(file, 'muss ein JSON-Objekt enthalten');
    continue;
  }

  const rel = relative(contentRoot, file);
  if ('slug' in json) {
    if (typeof json.slug !== 'string' || json.slug.length === 0) {
      addProblem(file, 'slug fehlt oder ist leer');
    } else if (basename(file) === 'meta.json') {
      const directorySlug = basename(dirname(file));
      if (json.slug !== directorySlug) {
        addProblem(file, `slug "${json.slug}" passt nicht zum Normordner "${directorySlug}"`);
      }
    } else if (json.slug !== slugFromFile(file)) {
      addProblem(file, `slug "${json.slug}" passt nicht zum Dateinamen "${slugFromFile(file)}"`);
    }
  }

  for (const imagePath of collectImagePaths(json)) {
    const absoluteImagePath = join(publicRoot, imagePath.replace(/^\//u, ''));
    if (!await exists(absoluteImagePath)) {
      addProblem(file, `Bildpfad fehlt: ${imagePath}`);
    }
  }

  if (rel.startsWith('themen/')) {
    if (typeof json.federfuehrendesRessort === 'string' && !ministrySlugs.has(json.federfuehrendesRessort)) {
      addProblem(file, `federfuehrendesRessort verweist auf unbekanntes Ressort: ${json.federfuehrendesRessort}`);
    }
    for (const reference of json.rechtsgrundlagen ?? []) {
      if (reference?.normSlug && !normSlugs.has(reference.normSlug)) {
        addProblem(file, `rechtsgrundlagen.normSlug verweist auf unbekannte Norm: ${reference.normSlug}`);
      }
    }
  }

  if (rel.startsWith('presse/mitteilungen/')) {
    for (const slug of json.relatedTopicSlugs ?? []) {
      if (!topicSlugs.has(slug)) {
        addProblem(file, `relatedTopicSlugs verweist auf unbekanntes Thema: ${slug}`);
      }
    }
    for (const slug of json.relatedNormSlugs ?? []) {
      if (!normSlugs.has(slug)) {
        addProblem(file, `relatedNormSlugs verweist auf unbekannte Norm: ${slug}`);
      }
    }
    for (const slug of json.relatedPressSlugs ?? []) {
      if (!pressSlugs.has(slug)) {
        addProblem(file, `relatedPressSlugs verweist auf unbekannte Pressemitteilung: ${slug}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('Content-QA hat Probleme gefunden:\n');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exitCode = 1;
} else {
  console.log('Content-QA erfolgreich.');
}

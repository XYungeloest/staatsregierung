import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const contentRoot = join(root, 'content');
const publicRoot = join(root, 'public');
const problems = [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const allowedNormTypes = new Set([
  'gesetz',
  'verordnung',
  'verwaltungsvorschrift',
  'foerderrichtlinie',
  'allgemeinverfuegung',
  'bekanntmachung',
  'staatsvertrag',
  'zustimmungsgesetz',
  'aenderungsvorschrift',
]);
const allowedNormStatuses = new Set(['in-force', 'repealed', 'planned']);
const allowedNormMinistries = new Set([
  'Freistaat Ostdeutschland',
  'Landtag des Freistaates Ostdeutschland',
  'Staatskanzlei des Freistaates Ostdeutschland',
  'Staatsministerium des Innern, Bau und für kommunale Angelegenheiten',
  'Staatsministerium für Kultus, Jugend und Sport',
  'Staatsministerium für Umwelt, Energie und Klimaschutz',
  'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik',
  'Staatsministerium für Wirtschaft, Nachhaltigkeit und Mobilität',
]);

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
const normVersionIds = new Map();

for (const { file, json } of byPrefix('normen/').filter(({ file }) => relative(contentRoot, file).includes('/versions/'))) {
  const [, normSlug, , fileName] = relative(contentRoot, file).split('/');
  const versionId = typeof json.versionId === 'string' ? json.versionId : basename(fileName, extname(fileName));
  const versions = normVersionIds.get(normSlug) ?? new Set();
  versions.add(versionId);
  normVersionIds.set(normSlug, versions);
}

for (const { file, json } of records) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    addProblem(file, 'muss ein JSON-Objekt enthalten');
    continue;
  }

  const rel = relative(contentRoot, file);
  if ('slug' in json) {
    if (typeof json.slug !== 'string' || json.slug.length === 0) {
      addProblem(file, 'slug fehlt oder ist leer');
    } else if (!slugPattern.test(json.slug)) {
      addProblem(file, `slug "${json.slug}" ist kein technischer ASCII-Slug`);
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

  if (rel.startsWith('normen/') && basename(file) === 'meta.json') {
    if (!allowedNormTypes.has(json.type)) {
      addProblem(file, `type ist kein erlaubter Normtyp: ${json.type}`);
    }

    if (!allowedNormStatuses.has(json.status)) {
      addProblem(file, `status ist kein erlaubter Normstatus: ${json.status}`);
    }

    if (!allowedNormMinistries.has(json.ministry)) {
      addProblem(file, `ministry ist nicht als Norm-Ressort zugelassen: ${json.ministry}`);
    }

    if (!Array.isArray(json.subjects) || json.subjects.length === 0) {
      addProblem(file, 'subjects muss mindestens ein Sachgebiet enthalten');
    }

    if (!Array.isArray(json.keywords) || json.keywords.length === 0) {
      addProblem(file, 'keywords muss mindestens ein Stichwort enthalten');
    }
  }

  if (rel.startsWith('verkuendungen/')) {
    if (typeof json.title !== 'string' || json.title.trim().length === 0) {
      addProblem(file, 'title fehlt oder ist leer');
    }

    if (!Number.isInteger(json.year)) {
      addProblem(file, 'year muss eine Jahreszahl sein');
    }

    if (typeof json.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(json.date)) {
      addProblem(file, 'date muss ein Datum im Format YYYY-MM-DD sein');
    } else if (Number.isInteger(json.year) && !json.date.startsWith(`${json.year}-`)) {
      addProblem(file, 'year muss zum Verkündungsdatum passen');
    }

    if (typeof json.issue !== 'string' || json.issue.trim().length === 0) {
      addProblem(file, 'issue fehlt oder ist leer');
    }

    if (typeof json.publication !== 'string' || json.publication.trim().length === 0) {
      addProblem(file, 'publication fehlt oder ist leer');
    }

    if (typeof json.pdf === 'string' && json.pdf.startsWith('/')) {
      const absolutePdfPath = join(publicRoot, json.pdf.replace(/^\//u, ''));
      if (!await exists(absolutePdfPath)) {
        addProblem(file, `PDF-Pfad fehlt: ${json.pdf}`);
      }
    }

    if (!Array.isArray(json.entries) || json.entries.length === 0) {
      addProblem(file, 'entries muss mindestens einen Eintrag enthalten');
    }

    const entryIds = new Set();
    for (const [index, entry] of (json.entries ?? []).entries()) {
      const entryPath = `entries[${index}]`;

      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        addProblem(file, `${entryPath} muss ein Objekt sein`);
        continue;
      }

      if (typeof entry.id !== 'string' || !slugPattern.test(entry.id)) {
        addProblem(file, `${entryPath}.id ist kein technischer ASCII-Slug`);
      } else if (entryIds.has(entry.id)) {
        addProblem(file, `${entryPath}.id ist innerhalb der Verkündung doppelt vergeben`);
      } else {
        entryIds.add(entry.id);
      }

      if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
        addProblem(file, `${entryPath}.title fehlt oder ist leer`);
      }

      if (typeof entry.type !== 'string' || entry.type.trim().length === 0) {
        addProblem(file, `${entryPath}.type fehlt oder ist leer`);
      }

      if (typeof entry.citation !== 'string' || entry.citation.trim().length === 0) {
        addProblem(file, `${entryPath}.citation fehlt oder ist leer`);
      }

      if (entry.versionId && !entry.normSlug) {
        addProblem(file, `${entryPath}.versionId setzt normSlug voraus`);
      }

      if (entry.normSlug) {
        if (!normSlugs.has(entry.normSlug)) {
          addProblem(file, `${entryPath}.normSlug verweist auf unbekannte Norm: ${entry.normSlug}`);
        } else if (entry.versionId && !normVersionIds.get(entry.normSlug)?.has(entry.versionId)) {
          addProblem(file, `${entryPath}.versionId verweist auf unbekannte Fassung: ${entry.normSlug}/${entry.versionId}`);
        }
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

import { access, readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
const allowedNormStatuses = new Set([
  'in-force',
  'future-effective',
  'pending-effective',
  'repealed',
  'historical',
  'one-time-act',
  'planned',
]);
const allowedEmailDomains = new Set(['freistaat-ostdeutschland.de']);
const allowedNormMinistries = new Set([
  'Freistaat Ostdeutschland',
  'Staatsregierung des Freistaates Ostdeutschland',
  'Landtag des Freistaates Ostdeutschland',
  'Staatskanzlei des Freistaates Ostdeutschland',
  'Staatsministerium für Volksbildung und Wissenschaft',
  'Staatsministerium des Innern, Bau und für kommunale Angelegenheiten',
  'Staatsministerium für Kultus, Jugend und Sport',
  'Staatsministerium für Umwelt, Energie und Klimaschutz',
  'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik',
  'Staatsministerium für Wirtschaft, Nachhaltigkeit und Mobilität',
]);
const execFileAsync = promisify(execFile);

async function loadTrackedFiles() {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return new Set(stdout.split('\0').filter(Boolean));
  } catch (error) {
    problems.push(`Quellenvertrag: versionierte Dateien konnten nicht über git ls-files ermittelt werden (${error.message})`);
    return new Set();
  }
}

const trackedFiles = await loadTrackedFiles();

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

function collectStrings(value, path = '', strings = []) {
  if (typeof value === 'string') {
    strings.push({ path, value });
    return strings;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectStrings(entry, `${path}[${index}]`, strings));
    return strings;
  }

  if (!value || typeof value !== 'object') {
    return strings;
  }

  for (const [key, entry] of Object.entries(value)) {
    collectStrings(entry, path ? `${path}.${key}` : key, strings);
  }

  return strings;
}

const genderedNounStem = '(?:Bürger|Schüler|Arbeitnehmer|Arbeitgeber|Weidetierhalter|Pendler|Forscher|Gastgeber|Vertreter|Expert|Vermieter|Mieter|Einwohner|Rentner|Kolleg|Referent|Sachbearbeiter|Mitarbeiter|Leser|Nutzer|Antragsteller|Teilnehmer|Bewohner)';
const masculineGenderedSuffix = '(?:e|en|er)?';

const disallowedGenderForms = [
  {
    pattern: new RegExp(`\\b${genderedNounStem}in(?:nen)?\\s*\\/\\s*[\\p{L}-]+\\b`, 'gu'),
    label: 'Schrägstrichform',
  },
  {
    pattern: new RegExp(`\\b${genderedNounStem}${masculineGenderedSuffix}\\s*\\/\\s*${genderedNounStem}in(?:nen)?\\b`, 'gu'),
    label: 'Schrägstrichform',
  },
  {
    pattern: new RegExp(`\\b${genderedNounStem}innen\\s+und\\s+[\\p{L}-]+\\b`, 'gu'),
    label: 'Paarform',
  },
  {
    pattern: new RegExp(`\\b[\\p{L}-]+\\s+und\\s+${genderedNounStem}innen\\b`, 'gu'),
    label: 'Paarform',
  },
  {
    pattern: new RegExp(`\\b${genderedNounStem}${masculineGenderedSuffix}\\s+und\\s+${genderedNounStem}in(?:nen)?\\b`, 'gu'),
    label: 'Paarform',
  },
  {
    pattern: /\b[\p{L}-]+\*[\p{L}-]+\b/gu,
    label: 'Sternchenform',
  },
  {
    pattern: /\b[\p{L}-]+_[\p{L}-]+\b/gu,
    label: 'Unterstrichform',
  },
  {
    pattern: /\b[\p{L}-]+Innen\b/gu,
    label: 'Binnen-I-Form',
  },
  {
    pattern: /\b(?:Damen und Herren|Frauen und Männer|Männer und Frauen)\b/gu,
    label: 'Paarform',
  },
];

const disallowedPublicCopy = [
  { pattern: /\b(?:vorläufige\s+platzhalterdatei|platzhalterbild|platzhaltergrafik)\b/giu, label: 'Platzhalterhinweis' },
  { pattern: /\bBITV-artig\b/giu, label: 'technische Umsetzungsbeschreibung' },
  { pattern: /\b(?:fiktive?\s+(?:website|seite)|politische\s+simulation)\b/giu, label: 'zusätzlicher Simulationshinweis' },
];

function validateGenderedLanguage(file, rel, json) {
  if (rel.startsWith('normen/') || rel.startsWith('verkuendungen/')) {
    return;
  }

  for (const entry of collectStrings(json)) {
    for (const { pattern, label } of disallowedGenderForms) {
      pattern.lastIndex = 0;
      const match = pattern.exec(entry.value);
      if (match) {
        addProblem(file, `${entry.path} enthält eine ${label}: „${match[0]}“`);
      }
    }
    for (const { pattern, label } of disallowedPublicCopy) {
      pattern.lastIndex = 0;
      const match = pattern.exec(entry.value);
      if (match) {
        addProblem(file, `${entry.path} enthält einen unzulässigen ${label}: „${match[0]}“`);
      }
    }
  }
}

function validateEmailDomains(file, json) {
  const emailPattern = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu;

  for (const entry of collectStrings(json)) {
    emailPattern.lastIndex = 0;
    for (const match of entry.value.matchAll(emailPattern)) {
      const domain = match[1].toLocaleLowerCase('de');
      if (!allowedEmailDomains.has(domain)) {
        addProblem(file, `${entry.path} enthält eine nicht zugelassene E-Mail-Domain: ${domain}`);
      }
    }
  }
}

function slugFromFile(path) {
  return basename(path, extname(path));
}

async function validateVersionedSource(file, fieldPath, sourcePath) {
  if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
    addProblem(file, `${fieldPath} muss einen nichtleeren Repository-Pfad enthalten`);
    return;
  }

  const normalizedPath = sourcePath.replaceAll('\\', '/').replace(/^\.\//u, '');
  if (normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    addProblem(file, `${fieldPath} muss relativ zum Repository liegen: ${sourcePath}`);
    return;
  }
  if (!trackedFiles.has(normalizedPath)) {
    addProblem(file, `${fieldPath} verweist nicht auf eine versionierte Datei: ${sourcePath}`);
    return;
  }
  if (!await exists(join(root, normalizedPath))) {
    addProblem(file, `${fieldPath} verweist auf eine im Checkout fehlende Datei: ${sourcePath}`);
  }
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
const legislationRecords = byPrefix('gesetzgebung/');
const governmentMemberRecords = byPrefix('regierung/mitglieder/');
const ministryRecords = byPrefix('ressorts/');

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
  validateGenderedLanguage(file, rel, json);
  validateEmailDomains(file, json);
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

    if (typeof json.initialCitation !== 'string' || json.initialCitation.trim().length === 0) {
      addProblem(file, 'initialCitation fehlt oder ist leer');
    } else if (/^(?:OGVBl|StAnzO|OABl|OVertrBl)\./u.test(json.initialCitation.trim())) {
      addProblem(file, 'initialCitation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben');
    }
  }

  if (rel.startsWith('normen/') && basename(file) === 'history.json') {
    for (const [index, entry] of (json.entries ?? []).entries()) {
      if (typeof entry.citation === 'string' && /^(?:OGVBl|StAnzO|OABl|OVertrBl)\./u.test(entry.citation.trim())) {
        addProblem(file, `entries[${index}].citation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben`);
      }
    }
  }

  if (rel.startsWith('normen/') && rel.includes('/versions/') && typeof json.citation === 'string'
    && /^(?:OGVBl|StAnzO|OABl|OVertrBl)\./u.test(json.citation.trim())) {
    addProblem(file, 'citation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben');
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

    for (const sourceFile of json.sourceFiles ?? []) {
      await validateVersionedSource(file, 'sourceFiles', sourceFile);
    }

    if (!Array.isArray(json.sourceReferences) || json.sourceReferences.length === 0) {
      addProblem(file, 'sourceReferences muss die Verfügbarkeit der Primärquelle dokumentieren');
    }
    for (const [index, source] of (json.sourceReferences ?? []).entries()) {
      const sourcePath = `sourceReferences[${index}]`;
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        addProblem(file, `${sourcePath} muss ein Objekt sein`);
        continue;
      }
      if (!['versioned', 'external', 'not-versioned'].includes(source.availability)) {
        addProblem(file, `${sourcePath}.availability ist unbekannt: ${source.availability}`);
      } else if (source.availability === 'versioned') {
        await validateVersionedSource(file, `${sourcePath}.localSource`, source.localSource);
      } else if (source.availability === 'external') {
        if (typeof source.url !== 'string' || !/^https:\/\//u.test(source.url)) {
          addProblem(file, `${sourcePath}.url muss für eine externe Quelle eine HTTPS-URL enthalten`);
        }
      } else if (source.localSource || source.url) {
        addProblem(file, `${sourcePath} darf für eine nicht mitversionierte Quelle keinen Pfad oder URL behaupten`);
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
      } else if (/^(?:OGVBl|StAnzO|OABl|OVertrBl)\./u.test(entry.citation.trim())) {
        addProblem(file, `${entryPath}.citation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben`);
      } else if (entry.documentDate && !/\bvom \d{1,2}\. [A-ZÄÖÜ][a-zäöüß]+ \d{4} \(/u.test(entry.citation)) {
        addProblem(file, `${entryPath}.citation muss Normart, Dokumentdatum und Fundstelle enthalten`);
      }

      if (entry.versionId && !entry.normSlug) {
        addProblem(file, `${entryPath}.versionId setzt normSlug voraus`);
      }

      if (entry.normSlug) {
        if (!normSlugs.has(entry.normSlug)) {
          addProblem(file, `${entryPath}.normSlug verweist auf unbekannte Norm: ${entry.normSlug}`);
        } else if (entry.versionId && !normVersionIds.get(entry.normSlug)?.has(entry.versionId)) {
          addProblem(file, `${entryPath}.versionId verweist auf unbekannte Fassung: ${entry.normSlug}/${entry.versionId}`);
        } else {
          const meta = byPrefix('normen/').find(({ file: normFile, json: normJson }) =>
            basename(normFile) === 'meta.json' && normJson.slug === entry.normSlug,
          )?.json;
          if (entry.documentDate && meta?.documentDate && entry.documentDate !== meta.documentDate) {
            addProblem(file, `${entryPath}.documentDate weicht vom Normdatensatz ${entry.normSlug} ab`);
          }
          if (meta?.publicationDate && meta.publicationDate !== json.date) {
            addProblem(file, `${entryPath} verweist auf eine Norm mit abweichendem Veröffentlichungsdatum`);
          }
        }
      }
    }
  }
}

const publicationSourceOwners = new Map();
const publicationKeys = new Set();
for (const { file, json } of byPrefix('verkuendungen/')) {
  const publicationKey = `${json.publication}:${json.year}:${json.issue}`;
  if (publicationKeys.has(publicationKey)) {
    addProblem(file, `Ausgabedatensatz ist doppelt vorhanden: ${publicationKey}`);
  }
  publicationKeys.add(publicationKey);
  for (const sourceFile of json.sourceFiles ?? []) {
    const owners = publicationSourceOwners.get(sourceFile) ?? [];
    owners.push(file);
    publicationSourceOwners.set(sourceFile, owners);
  }
  for (const [index, entry] of (json.entries ?? []).entries()) {
    if (!entry.documentDate && json.slug !== 'stanzo-2026-13') {
      addProblem(file, `entries[${index}].documentDate fehlt; Norm- und Veröffentlichungsdatum müssen getrennt bleiben`);
    }
  }
}
for (const [sourceFile, owners] of publicationSourceOwners) {
  if (owners.length !== 1) {
    addProblem(join(root, sourceFile), `ist mehreren Ausgabedatensätzen zugeordnet`);
  }
}

const normMetaRecords = byPrefix('normen/').filter(({ file }) => basename(file) === 'meta.json');
const normMetaBySlug = new Map(normMetaRecords.map(({ json }) => [json.slug, json]));
for (const { file, json } of normMetaRecords) {
  if (json.publicationDate && !json.documentDate && !json.dateNote) {
    addProblem(file, 'publicationDate ist gesetzt, aber documentDate oder eine begründete dateNote fehlt');
  }
  if (json.status === 'future-effective' && (!json.effectiveDate || json.effectiveDate <= '2026-07-19')) {
    addProblem(file, 'future-effective setzt ein Inkrafttreten nach dem Stichtag voraus');
  }
  if (json.status === 'pending-effective' && json.effectiveDate) {
    addProblem(file, 'pending-effective darf kein unbelegtes konkretes Inkrafttretensdatum enthalten');
  }
  if (json.status === 'repealed' && (!json.expiryDate || json.expiryDate > '2026-07-19')) {
    addProblem(file, 'repealed setzt ein Außerkrafttreten am oder vor dem Stichtag voraus');
  }

  for (const [relation, inverse] of [['enactedNorm', 'enactingNorm'], ['enactingNorm', 'enactedNorm']]) {
    const targetSlug = json[relation];
    if (!targetSlug) continue;
    const target = normMetaBySlug.get(targetSlug);
    if (!target) {
      addProblem(file, `${relation} verweist auf unbekannte Norm: ${targetSlug}`);
    } else if (target[inverse] !== json.slug) {
      addProblem(file, `${relation} ist bei ${targetSlug} nicht wechselseitig als ${inverse} hinterlegt`);
    }
  }
}

function normalizeDuplicateTitle(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\([^)]*\)/gu, ' ')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function citationFundstelle(value) {
  return typeof value === 'string' ? value.match(/\(([^)]+)\)/u)?.[1]?.trim() ?? value.trim() : '';
}

const possibleDuplicateNorms = new Map();
for (const { file, json } of normMetaRecords) {
  const duplicateKey = [
    normalizeDuplicateTitle(json.title ?? ''),
    citationFundstelle(json.initialCitation),
    json.effectiveDate ?? '',
  ].join('|');
  const candidates = possibleDuplicateNorms.get(duplicateKey) ?? [];
  candidates.push({ file, json });
  possibleDuplicateNorms.set(duplicateKey, candidates);
}
for (const candidates of possibleDuplicateNorms.values()) {
  if (candidates.length < 2) continue;
  for (const candidate of candidates) {
    const relatedSlugs = new Set([candidate.json.enactedNorm, candidate.json.enactingNorm].filter(Boolean));
    const unrelated = candidates.filter((other) => other !== candidate && !relatedSlugs.has(other.json.slug));
    if (unrelated.length > 0) {
      addProblem(
        candidate.file,
        `verdächtige Dublette zu ${unrelated.map(({ json }) => json.slug).join(', ')}: gleicher normalisierter Titel, gleiche Erstfundstelle und Wirksamkeit`,
      );
    }
  }
}

const documentNumbers = new Set();
const legislationSlugs = new Set();
for (const { file, json } of legislationRecords) {
  if (legislationSlugs.has(json.slug)) addProblem(file, `doppelter Verfahrens-Slug: ${json.slug}`);
  legislationSlugs.add(json.slug);
  if (documentNumbers.has(json.documentNumber)) addProblem(file, `doppelte Drucksachennummer: ${json.documentNumber}`);
  documentNumbers.add(json.documentNumber);
  for (const slug of json.relatedTopics ?? []) if (!topicSlugs.has(slug)) addProblem(file, `relatedTopics verweist auf unbekanntes Thema: ${slug}`);
  for (const slug of json.relatedMinistries ?? []) if (!ministrySlugs.has(slug)) addProblem(file, `relatedMinistries verweist auf unbekanntes Ressort: ${slug}`);
  for (const slug of json.relatedNorms ?? []) if (!normSlugs.has(slug)) addProblem(file, `relatedNorms verweist auf unbekannte Norm: ${slug}`);
  if (json.recommendation && ['beschlossen', 'verkuendet', 'in-kraft'].includes(json.stage)) {
    addProblem(file, 'eine Beschlussempfehlung darf ohne amtliches Ergebnis nicht als Beschluss, Verkündung oder Inkrafttreten geführt werden');
  }
  if (json.confirmedAsOf !== '2026-07-19') addProblem(file, 'confirmedAsOf muss dem redaktionellen Stichtag 2026-07-19 entsprechen');
  if (json.nextScheduledReading?.date !== '2026-07-20') {
    addProblem(file, 'nextScheduledReading.date muss für die dritte Plenarsitzung 2026-07-20 sein');
  }
  if (!['erste-lesung-angesetzt', 'zweite-lesung-angesetzt'].includes(json.stage)) {
    addProblem(file, 'darf ohne Ergebnisquelle nur als angesetzte erste oder zweite Lesung geführt werden');
  }
  const agendaSources = (json.sources ?? []).filter((source) => source.kind === 'tagesordnung');
  if (agendaSources.length !== 1) {
    addProblem(file, `muss genau einen Tagesordnungsnachweis enthalten, gefunden: ${agendaSources.length}`);
  }
  for (const [index, source] of (json.sources ?? []).entries()) {
    const sourcePath = `sources[${index}]`;
    if (source.availability === 'local') {
      await validateVersionedSource(file, `${sourcePath}.localSource`, source.localSource);
    } else if (source.availability === 'external') {
      if (typeof source.sourceUrl !== 'string' || !/^https:\/\//u.test(source.sourceUrl)) {
        addProblem(file, `${sourcePath}.sourceUrl muss für eine externe Quelle eine HTTPS-URL enthalten`);
      }
    } else if (source.availability !== 'missing') {
      addProblem(file, `${sourcePath}.availability ist unbekannt: ${source.availability}`);
    } else if (source.localSource || source.sourceUrl) {
      addProblem(file, `${sourcePath} darf für eine fehlende Quelle keinen Pfad oder URL behaupten`);
    }
  }
}

if (legislationRecords.length !== 12) {
  addProblem(join(contentRoot, 'gesetzgebung'), `muss zwölf Vorgänge der dritten Plenarsitzung enthalten, gefunden: ${legislationRecords.length}`);
}

const plenaryEvent = byPrefix('presse/termine/').find(({ json }) => json.slug === 'dritte-plenarsitzung-7-landtag');
if (!plenaryEvent) {
  addProblem(join(contentRoot, 'presse', 'termine'), 'Termin der dritten Plenarsitzung fehlt');
} else {
  const linkedProcedures = new Set(plenaryEvent.json.relatedLegislationSlugs ?? []);
  for (const { file, json } of legislationRecords) {
    if (!linkedProcedures.has(json.slug)) addProblem(file, 'ist nicht mit dem Termin der dritten Plenarsitzung verknüpft');
  }
  if (linkedProcedures.size !== 12) {
    addProblem(plenaryEvent.file, `muss genau zwölf Gesetzgebungsvorgänge verknüpfen, gefunden: ${linkedProcedures.size}`);
  }
}

for (const { file, json } of byPrefix('presse/termine/')) {
  for (const slug of json.relatedLegislationSlugs ?? []) {
    if (!legislationSlugs.has(slug)) addProblem(file, `relatedLegislationSlugs verweist auf unbekanntes Verfahren: ${slug}`);
  }
}

const currentMembers = governmentMemberRecords.filter(({ json }) => json.current === true);
const currentStateMinisters = currentMembers.filter(({ json }) => json.slug !== 'emma-mueller');
if (currentStateMinisters.length !== 11) {
  addProblem(join(contentRoot, 'regierung', 'mitglieder'), `muss genau elf aktuelle Staatsminister:innen enthalten, gefunden: ${currentStateMinisters.length}`);
}
if (currentMembers.some(({ json }) => json.slug === 'mia-wollrath')) {
  addProblem(join(contentRoot, 'regierung', 'mitglieder', 'mia-wollrath.json'), 'darf nicht als aktuelles Kabinettsmitglied geführt werden');
}
const expectedLeaders = new Map([
  ['inneres-bau-und-kommunale-angelegenheiten', 'Volker Bagdadi'],
  ['umwelt-energie-und-klimaschutz', 'Yannik Schmäle'],
  ['grenzschutz-faschismusbekaempfung-und-bewaffnete-organe', 'Thomas Henry Barlow'],
]);
for (const { file, json } of ministryRecords) {
  const matchingLeaders = currentMembers.filter(({ json: member }) => json.leitung?.includes(member.name));
  if (matchingLeaders.length !== 1) addProblem(file, `muss genau eine aktive Leitung haben, gefunden: ${matchingLeaders.length}`);
  const expectedLeader = expectedLeaders.get(json.slug);
  if (expectedLeader && !json.leitung?.includes(expectedLeader)) addProblem(file, `aktuelle Leitung muss ${expectedLeader} sein`);
}
const emma = currentMembers.find(({ json }) => json.slug === 'emma-mueller')?.json;
if (!emma || emma.amt !== 'Chefin der Staatskanzlei') {
  addProblem(join(contentRoot, 'regierung', 'mitglieder', 'emma-mueller.json'), 'muss getrennt als Chefin der Staatskanzlei geführt werden');
}

const schoolSystemAsset = join(publicRoot, 'images/ui/schulsystem.svg');
if (await exists(schoolSystemAsset)) {
  const [assetSource, assetStats] = await Promise.all([
    readFile(schoolSystemAsset, 'utf8'),
    stat(schoolSystemAsset),
  ]);
  const forbiddenAssetFragments = ['<mxfile', '&lt;mxfile', 'app.diagrams.net', '<!DOCTYPE', 'data:image/'];

  if (assetStats.size > 200_000) {
    addProblem(schoolSystemAsset, `ist mit ${assetStats.size} Byte größer als das festgelegte SVG-Budget von 200000 Byte`);
  }
  for (const fragment of forbiddenAssetFragments) {
    if (assetSource.includes(fragment)) {
      addProblem(schoolSystemAsset, `enthält nicht bereinigte Editor- oder Rasterdaten: ${fragment}`);
    }
  }
} else {
  addProblem(schoolSystemAsset, 'fehlt');
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

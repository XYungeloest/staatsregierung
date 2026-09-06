import { access, readdir, readFile, stat } from 'node:fs/promises';
import {
  abbreviationProblem,
  isAbbreviationLikeLabel,
  isDerivedSummary,
  isTitleFormulaSummary,
  UNVERIFIED_GENERATED_ABBREVIATIONS as unverifiedGeneratedAbbreviations,
} from './lib/norm-title-rules.mjs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';

import { hasSpacedLetters } from './lib/norm-html-parser.mjs';
import {
  citationLabelMatchesNormType,
  isCompatiblePublicationEntryType,
} from './lib/publication-entry-types.mjs';

const root = resolve(process.cwd());
const contentRoot = join(root, 'content');
const publicRoot = join(root, 'public');
const editorialConfig = JSON.parse(await readFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), 'utf8'));
const referenceDate = editorialConfig.referenceDate;
// Amtliche Sachgebietssystematik; die Prüfung liest die Konfigurationsdatei unmittelbar,
// damit dieses Audit ohne TypeScript-Auflösung läuft.
const lawSubjectsConfig = JSON.parse(await readFile(join(root, 'packages', 'shared', 'src', 'config', 'law-subjects.json'), 'utf8'));
const allowedSubjects = new Set(lawSubjectsConfig.groups.flatMap((group) => group.subjects.map((subject) => subject.title)));
const allowedFundingAreas = new Set(lawSubjectsConfig.fundingAreas.map((area) => area.number));
const fsnNumberPattern = /^\d{1,4}(?:-[0-9A-Za-z.,:/]{1,16})?$/u;
const problems = [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
/** Befristung im Wortlaut einer Verkündung („bis zum 1. Januar 2026“, „mit Ablauf des …“). */
const LIMITED_PERIOD_PATTERN = /\b(?:bis\s+zum|mit\s+Ablauf\s+des)\s+\d{1,2}\.\s*[A-ZÄÖÜ][a-zäöüß]+\s+\d{4}/u;
const allowedNormTypes = new Set([
  'gesetz',
  'verordnung',
  'verwaltungsvorschrift',
  'foerderrichtlinie',
  'allgemeinverfuegung',
  'bekanntmachung',
  'berichtigung',
  'staatsvertrag',
  'verwaltungsabkommen',
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
  'Staatsregierung des Freistaates Ostdeutschland',
  'Staatsrat des Freistaates Ostdeutschland',
  'Staatskanzlei des Freistaates Ostdeutschland',
  'Staatsministerium für Volksbildung und Wissenschaft',
  'Staatsministerium des Innern, Bau und für kommunale Angelegenheiten',
  'Staatsministerium für Kultus, Jugend und Sport',
  'Staatsministerium für Umwelt, Energie und Klimaschutz',
  'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik',
  'Staatsministerium für Wirtschaft, Nachhaltigkeit und Mobilität',
  'Staatssekretariat des Innern und für Wohnungswirtschaft',
  'Staatssekretariat der Finanzen',
  'Staatssekretariat für Wirtschaft und Arbeit',
  'Staatssekretariat für Gesundheits- und Sozialwesen',
  'Staatssekretariat für Nachhaltigkeit und Energie',
  'Staatssekretariat für Mobilität und regionale Entwicklung',
  'Staatssekretariat für Volksbildung und Wissenschaft',
  'Staatssekretariat für Staats- und Grenzsicherheit',
  'Staatssekretariat für Rechtsstaatlichkeit und kulturelle Emanzipation',
  'Ministerium für freistaatliche Sicherheit',
  'Büro des Staatspräsidenten',
  'Gemeingut Wohnen AöR',
  'Landesenergiewerke Ost AöR',
  'Ostdeutsche Eisenbahn AöR',
  'Ostdeutscher Verkehrsverbund',
]);
const allowedEnactingBodies = new Set([
  'Sächsischer Landtag',
  'Sächsische Staatsregierung',
  'Sächsisches Staatsministerium für Kultus',
  'Sächsisches Staatsministerium des Innern',
  'Sächsisches Staatsministerium der Finanzen',
  'Sächsisches Staatsministerium für Kultus und Sächsisches Staatsministerium des Innern',
  'Landtag des Freistaates Ostdeutschland',
  'Volkskammer des Freistaates Ostdeutschland',
  'Staatsregierung des Freistaates Ostdeutschland',
  'Staatsrat des Freistaates Ostdeutschland',
  'Staatspräsident des Freistaates Ostdeutschland',
  'Bundesministerium des Innern und für Heimat und Ostdeutscher Staatsrat',
  'Verwaltungsrat der Gemeingut Wohnen AöR',
  'Verwaltungsrat der Landesenergiewerke Ost',
  'Verwaltungsrat der Ostdeutschen Eisenbahn',
  'Verbandsversammlung des Ostdeutschen Verkehrsverbundes',
  'Gründungsvorstand der Interflug',
  'Staatssekretariat für Mobilität und regionale Entwicklung',
  'Ministerium für freistaatliche Sicherheit',
]);
const execFileAsync = promisify(execFile);

async function loadTrackedFiles() {
  try {
    // Vor einem Commit müssen neu hinzugefügte, nicht ignorierte Quellen bereits durch
    // dieselbe QA laufen können, ohne den Git-Index als Nebeneffekt zu verändern.
    const { stdout } = await execFileAsync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
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

// Quellen werden von mehreren Datensätzen referenziert (Norm, Fassungen, Verkündung); jede Datei
// wird höchstens einmal gehasht.
const fileHashes = new Map();
async function fileSha256(path) {
  let hash = fileHashes.get(path);
  if (!hash) {
    hash = readFile(path).then((bytes) => createHash('sha256').update(bytes).digest('hex'));
    fileHashes.set(path, hash);
  }
  return hash;
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
    // Technische Enum-, ID- und Referenzwerte sind keine öffentlichen Personenbezeichnungen.
    if (/(?:^|\.)(?:id|slug|status|type|icon|kind|normSlug|personSlug|officeSlug|ministrySlug|governmentSlug)$/u.test(entry.path)) {
      continue;
    }
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
  // Amtliche REVOSax-Fassungen enthalten die im Original genannten Adressen (auch
  // ausländischer Behörden); dort ist nur ein unangepasster Sachsen-Rest ein Fehler.
  const officialSnapshot = Array.isArray(json?.sourceReferences)
    && json.sourceReferences.some((reference) => reference?.kind === 'revosax-snapshot');

  for (const entry of collectStrings(json)) {
    emailPattern.lastIndex = 0;
    for (const match of entry.value.matchAll(emailPattern)) {
      const domain = match[1].toLocaleLowerCase('de');
      if (officialSnapshot) {
        if (domain === 'sachsen.de' || domain.endsWith('.sachsen.de')) {
          addProblem(file, `${entry.path} enthält eine nicht angepasste sächsische E-Mail-Domain: ${domain}`);
        }
        continue;
      }
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

async function validateNormSourceReference(file, source, sourcePath) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    addProblem(file, `${sourcePath} muss ein Objekt sein`);
    return;
  }

  const extensionPattern = {
    'structured-html-transcription': /\.html$/iu,
    'legacy-markdown-transcription': /\.md$/iu,
    'supplementary-markdown-transcription': /\.md$/iu,
    'revosax-snapshot': /\.html$/iu,
    'amendment-source': /\.(?:html|md|pdf)$/iu,
    'primary-pdf': /\.pdf$/iu,
    'structured-docx-source': /\.docx$/iu,
  }[source.kind];
  if (!extensionPattern) {
    addProblem(file, `${sourcePath}.kind ist für eine Normquelle unbekannt: ${source.kind}`);
    return;
  }
  if (source.fsnNumber !== undefined) {
    if (source.kind !== 'revosax-snapshot') {
      addProblem(file, `${sourcePath}.fsnNumber ist nur für eine amtliche REVOSax-Quelle zulässig`);
    } else if (typeof source.fsnNumber !== 'string' || !fsnNumberPattern.test(source.fsnNumber)) {
      addProblem(file, `${sourcePath}.fsnNumber muss eine Fundstellennummer wie „612-3.10/2“ sein`);
    }
  }
  if (source.availability === 'r2-archived') {
    await validateArchivedNormSourceReference(file, source, sourcePath);
    return;
  }
  if (source.availability !== 'versioned') {
    addProblem(file, `${sourcePath}.availability muss versioned oder r2-archived sein`);
  }
  if (source.objectKey !== undefined || source.bucket !== undefined) {
    addProblem(file, `${sourcePath}.objectKey ist nur für eine in R2 archivierte Quelle zulässig`);
  }
  if (typeof source.localSource !== 'string' || !extensionPattern.test(source.localSource)) {
    addProblem(file, `${sourcePath}.localSource besitzt kein für ${source.kind} zulässiges Quellformat`);
    return;
  }
  await validateVersionedSource(file, `${sourcePath}.localSource`, source.localSource);

  if (source.kind === 'structured-html-transcription' && source.sourceRole !== undefined && source.sourceRole !== 'structure-bearing') {
    addProblem(file, `${sourcePath}.sourceRole muss für die strukturierte HTML-Fassung structure-bearing sein`);
  }
  if (source.kind === 'supplementary-markdown-transcription' && source.sourceRole !== 'supplementary-transcription') {
    addProblem(file, `${sourcePath}.sourceRole muss für die zusätzliche Markdown-Fassung supplementary-transcription sein`);
  }
  const expectedTextMediaType = {
    'structured-html-transcription': 'text/html',
    'legacy-markdown-transcription': 'text/markdown',
    'supplementary-markdown-transcription': 'text/markdown',
  }[source.kind];
  if (source.mediaType !== undefined && expectedTextMediaType && source.mediaType !== expectedTextMediaType) {
    addProblem(file, `${sourcePath}.mediaType muss ${expectedTextMediaType} sein`);
  }

  if (['primary-pdf', 'structured-docx-source'].includes(source.kind)) {
    const expectedMediaType = source.kind === 'primary-pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (source.mediaType !== expectedMediaType) {
      addProblem(file, `${sourcePath}.mediaType muss ${expectedMediaType} sein`);
    }
    if (typeof source.verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(source.verifiedAt)) {
      addProblem(file, `${sourcePath}.verifiedAt muss als ISO-Datum dokumentiert sein`);
    }
    if (!['structure-bearing', 'visual-control'].includes(source.sourceRole)) {
      addProblem(file, `${sourcePath}.sourceRole muss structure-bearing oder visual-control sein`);
    }
    if (source.kind === 'primary-pdf' && (!Number.isInteger(source.pageCount) || source.pageCount < 1)) {
      addProblem(file, `${sourcePath}.pageCount muss die Seitenzahl des PDFs enthalten`);
    }
    if (source.derivedSource !== undefined) {
      await validateVersionedSource(file, `${sourcePath}.derivedSource`, source.derivedSource);
    }
  }

  if (source.sha256 !== undefined || ['primary-pdf', 'structured-docx-source', 'revosax-snapshot'].includes(source.kind)) {
    if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(source.sha256)) {
      addProblem(file, `${sourcePath}.sha256 muss einen SHA-256 enthalten`);
    } else if (await exists(resolve(root, source.localSource))) {
      const actualHash = await fileSha256(resolve(root, source.localSource));
      if (actualHash !== source.sha256) {
        addProblem(file, `${sourcePath}.sha256 stimmt nicht mit der unveränderten Quelle überein`);
      }
    }
  }

  if (source.kind !== 'revosax-snapshot') return;
  validateRevosaxProvenanceFields(file, source, sourcePath);
}

const REVOSAX_VERSION_URL = /^https:\/\/www\.revosax\.sachsen\.de\/vorschrift\/(\d+)(?:\.(\d+))?$/u;
// Fassungsseiten (<lawId>[.<Fassung>].html) und nachgeladene Mantelvorschriften (envelope-<lawId>.html).
const R2_REVOSAX_OBJECT_KEY = /^revosax\/\d{4}-\d{2}-\d{2}\/(?:envelope-)?(\d+)(?:\.(\d+))?\.html$/u;
const R2_MANIFEST_PATH = join(root, 'data', 'recht', 'revosax-r2-manifest.json');
let r2ManifestCache;

async function loadR2Manifest() {
  if (r2ManifestCache !== undefined) return r2ManifestCache;
  try {
    r2ManifestCache = JSON.parse(await readFile(R2_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    r2ManifestCache = null;
  }
  return r2ManifestCache;
}

function validateRevosaxProvenanceFields(file, source, sourcePath) {
  // Die Mantelvorschrift einer Komponente wird mit dem Artikelanker zitiert (…#a44).
  const officialUrl = source.sourceRole === 'envelope-snapshot' && typeof source.url === 'string' ? source.url.replace(/#[A-Za-z0-9_-]+$/u, '') : source.url;
  if (typeof officialUrl !== 'string' || !REVOSAX_VERSION_URL.test(officialUrl)) {
    addProblem(file, `${sourcePath}.url muss eine konkrete amtliche REVOSax-Fassungs-URL sein`);
  }
  if (typeof source.lawId !== 'string' || !/^\d+$/u.test(source.lawId)) {
    addProblem(file, `${sourcePath}.lawId muss die REVOSax-Vorschriften-ID enthalten`);
  }
  for (const field of ['retrievedAt', 'sourceValidFrom']) {
    if (typeof source[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(source[field])) {
      addProblem(file, `${sourcePath}.${field} muss als ISO-Datum dokumentiert sein`);
    }
  }
  if (source.sourceValidTo !== undefined &&
      (typeof source.sourceValidTo !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(source.sourceValidTo))) {
    addProblem(file, `${sourcePath}.sourceValidTo muss als ISO-Datum dokumentiert sein`);
  }
}

/**
 * Eine in R2 archivierte Quelle ist derselbe unveränderte amtliche Snapshot an
 * einem anderen Speicherort. Statt der lokalen Datei wird der Objektschlüssel
 * gegen das versionierte R2-Manifest geprüft; Hash, amtliche Fassungs-URL und
 * Gültigkeitsdaten bleiben in gleicher Strenge Pflicht.
 */
async function validateArchivedNormSourceReference(file, source, sourcePath) {
  if (source.kind !== 'revosax-snapshot') {
    addProblem(file, `${sourcePath}.availability r2-archived ist nur für revosax-snapshot zulässig`);
    return;
  }
  if (source.localSource !== undefined) {
    addProblem(file, `${sourcePath}.localSource darf bei einer in R2 archivierten Quelle nicht gesetzt sein`);
  }
  const keyMatch = typeof source.objectKey === 'string' ? source.objectKey.match(R2_REVOSAX_OBJECT_KEY) : null;
  if (!keyMatch) {
    addProblem(file, `${sourcePath}.objectKey muss dem Muster revosax/<Stichtag>/<lawId>[.<Fassung>].html entsprechen`);
  }
  if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(source.sha256)) {
    addProblem(file, `${sourcePath}.sha256 muss einen SHA-256 enthalten`);
  }
  // official-snapshot: eigene amtliche Fassungsseite; envelope-snapshot: Mantelvorschrift,
  // aus deren Artikel der Text einer eigenständig geführten Änderungsvorschrift stammt.
  if (source.sourceRole !== 'official-snapshot' && source.sourceRole !== 'envelope-snapshot') {
    addProblem(file, `${sourcePath}.sourceRole muss für eine in R2 archivierte REVOSax-Quelle official-snapshot oder envelope-snapshot sein`);
  }
  if (source.mediaType !== 'text/html') {
    addProblem(file, `${sourcePath}.mediaType muss für eine in R2 archivierte REVOSax-Quelle text/html sein`);
  }
  validateRevosaxProvenanceFields(file, source, sourcePath);
  if (!keyMatch) return;

  if (keyMatch[1] !== source.lawId) {
    addProblem(file, `${sourcePath}.objectKey nennt die lawId ${keyMatch[1]}, die Quelle ${source.lawId}`);
  }
  const urlMatch = typeof source.url === 'string' ? source.url.replace(/#[A-Za-z0-9_-]+$/u, '').match(REVOSAX_VERSION_URL) : null;
  if (urlMatch && (urlMatch[1] !== keyMatch[1] || (urlMatch[2] ?? null) !== (keyMatch[2] ?? null))) {
    addProblem(file, `${sourcePath}.objectKey passt nicht zur amtlichen Fassungs-URL ${source.url}`);
  }
  const manifest = await loadR2Manifest();
  if (!manifest) {
    addProblem(file, `${sourcePath}.objectKey kann ohne data/recht/revosax-r2-manifest.json nicht gegen das R2-Archiv geprüft werden`);
    return;
  }
  const entry = manifest.objects?.[source.objectKey];
  if (!entry) {
    addProblem(file, `${sourcePath}.objectKey ${source.objectKey} ist im R2-Manifest nicht verzeichnet`);
    return;
  }
  if (entry.sha256 !== source.sha256) {
    addProblem(file, `${sourcePath}.sha256 stimmt nicht mit dem im R2-Manifest verzeichneten Objekt überein`);
  }
  // Die Mantelvorschrift einer Komponente wird mit Artikelanker zitiert; das Manifest kennt die Seite ohne Anker.
  const manifestComparableUrl = source.sourceRole === 'envelope-snapshot' && typeof source.url === 'string' ? source.url.replace(/#[A-Za-z0-9_-]+$/u, '') : source.url;
  if (entry.url !== undefined && entry.url !== manifestComparableUrl) {
    addProblem(file, `${sourcePath}.url weicht von der im R2-Manifest verzeichneten amtlichen URL ab`);
  }
  if (source.bucket !== undefined && manifest.bucket !== undefined && source.bucket !== manifest.bucket) {
    addProblem(file, `${sourcePath}.bucket ${source.bucket} entspricht nicht dem R2-Manifest (${manifest.bucket})`);
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

// Relativpfade einmal je Datei; byPrefix wird in Schleifen über den Bestand aufgerufen (vorher
// O(n²) Pfadberechnungen, über zwei Minuten bei 20.000 Dateien).
for (const record of records) record.relativePath = relative(contentRoot, record.file);
const byPrefixCache = new Map();
const byPrefix = (prefix) => {
  let matches = byPrefixCache.get(prefix);
  if (!matches) {
    matches = records.filter(({ relativePath }) => relativePath.startsWith(prefix));
    byPrefixCache.set(prefix, matches);
  }
  return matches;
};

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

  if (rel.startsWith('presse/termine/')) {
    for (const slug of json.relatedTopicSlugs ?? []) {
      if (!topicSlugs.has(slug)) {
        addProblem(file, `relatedTopicSlugs verweist auf unbekanntes Thema: ${slug}`);
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

    if (json.ministry !== undefined) {
      addProblem(file, 'das unspezifische Altbestandsfeld ministry ist unzulässig; enactingBody und responsibleMinistry getrennt pflegen');
    }

    const responsibility = json.responsibleMinistry;
    if (responsibility !== undefined && !allowedNormMinistries.has(responsibility)) {
      addProblem(file, `fachliche Zuständigkeit ist nicht als Norm-Ressort zugelassen: ${responsibility}`);
    }

    if (json.originEnactingBody && !allowedEnactingBodies.has(json.originEnactingBody)) {
      addProblem(file, `originEnactingBody ist nicht als Ursprungsorgan zugelassen: ${json.originEnactingBody}`);
    }
    if (json.enactingBody && !allowedEnactingBodies.has(json.enactingBody)) {
      addProblem(file, `enactingBody ist nicht als erlassendes Organ zugelassen: ${json.enactingBody}`);
    }

    if (typeof json.summary !== 'string' || json.summary.trim().length < 24) {
      addProblem(file, 'summary muss eine verständliche redaktionelle Kurzbeschreibung enthalten');
    } else {
      const summary = json.summary.trim();
      if (/^(?:§|Abschnitt\b|Artikel\b|OABl\.|OGVBl\.|StAnzO\.|GVBl\.|Aufgrund\b|Auf Grund\b|\d+\.)/u.test(summary)) {
        addProblem(file, 'summary beginnt mit einem typischen Normtext- oder Verkündungsfragment');
      }
      if (/(?:\.\.\.|…)$/u.test(summary)) {
        addProblem(file, 'summary endet als abgeschnittener Importtext');
      }
      if (/§§?\s*\d+[\s\S]*\bunverändert\b/iu.test(summary)
        || /(?:Der (?:Ostdeutsche )?Landtag hat|wird wie folgt geändert|Dresden, den|Seite \d)/iu.test(summary)) {
        addProblem(file, 'summary enthält eine typische Verkündungsformel oder Änderungsanweisung');
      }
    }

    // Titelmodell: Kurzbezeichnung und Abkürzung nach der gemeinsamen Regel
    // (scripts/lib/norm-title-rules.mjs); Prüfung über den Bestand statt im Einzelfall.
    if (json.shortTitle !== undefined && typeof json.shortTitle !== 'string') {
      addProblem(file, 'shortTitle muss eine Zeichenkette sein');
    }
    if (typeof json.shortTitle === 'string' && json.shortTitle.trim() === String(json.title ?? '').trim()) {
      addProblem(file, 'shortTitle wiederholt den Titel; die Kurzbezeichnung entfällt dann');
    }
    if (typeof json.shortTitle === 'string' && isAbbreviationLikeLabel(json.shortTitle)) {
      addProblem(file, `shortTitle ist eine Abkürzungsform und gehört in keywords: ${json.shortTitle}`);
    }
    if (json.shortTitleSource !== undefined && !json.shortTitle) {
      addProblem(file, 'shortTitleSource ohne shortTitle');
    }
    const abbrProblem = abbreviationProblem(json.abbr, { title: json.title, shortTitle: json.shortTitle });
    if (abbrProblem) {
      addProblem(file, `abbr ${abbrProblem}: ${String(json.abbr).replace(/\s+/gu, ' ')}`);
    }

    if (!Array.isArray(json.subjects) || json.subjects.length === 0) {
      addProblem(file, 'subjects muss mindestens ein Sachgebiet enthalten');
    } else {
      if (json.subjects.length > 3) {
        addProblem(file, 'subjects darf höchstens drei Sachgebiete nennen');
      }
      if (new Set(json.subjects).size !== json.subjects.length) {
        addProblem(file, 'subjects darf kein Sachgebiet doppelt nennen');
      }
      for (const subject of json.subjects) {
        if (!allowedSubjects.has(subject)) {
          addProblem(file, `subjects nennt „${subject}“; zulässig sind nur die Untergruppen der amtlichen Systematik (packages/shared/src/config/law-subjects.json)`);
        }
      }
    }
    if (typeof json.primarySubject !== 'string' || json.primarySubject.length === 0) {
      addProblem(file, 'primarySubject fehlt');
    } else if (json.primarySubject !== json.subjects?.[0]) {
      addProblem(file, 'primarySubject muss das erste Sachgebiet in subjects sein');
    }
    if (json.fundingArea !== undefined) {
      if (json.type !== 'foerderrichtlinie') {
        addProblem(file, 'fundingArea ist nur für eine Förderrichtlinie zulässig');
      } else if (!allowedFundingAreas.has(json.fundingArea)) {
        addProblem(file, `fundingArea nennt „${json.fundingArea}“; zulässig sind nur die Förderbereiche der amtlichen Systematik`);
      }
    }

    if (!Array.isArray(json.keywords) || json.keywords.length === 0) {
      addProblem(file, 'keywords muss mindestens ein Stichwort enthalten');
    }

    if (typeof json.initialCitation !== 'string' || json.initialCitation.trim().length === 0) {
      addProblem(file, 'initialCitation fehlt oder ist leer');
    } else if (/^(?:OGVBl|StAnzO|OABl|OVertrBl|GMBl)\./u.test(json.initialCitation.trim())) {
      addProblem(file, 'initialCitation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben');
    }

    for (const [index, source] of (json.sourceReferences ?? []).entries()) {
      await validateNormSourceReference(file, source, `sourceReferences[${index}]`);
    }
    if (json.type === 'verwaltungsabkommen') {
      const details = json.agreementDetails;
      if (!details || typeof details !== 'object' || Array.isArray(details)) {
        addProblem(file, 'agreementDetails ist für ein Verwaltungsabkommen erforderlich');
      } else {
        for (const [field, expected] of [
          ['signedOn', json.documentDate],
          ['publishedOn', json.publicationDate],
          ['effectiveOn', json.effectiveDate],
        ]) {
          if (details[field] !== expected) {
            addProblem(file, `agreementDetails.${field} muss mit dem zugehörigen Normdatum übereinstimmen`);
          }
        }
        if (details.signedAt !== 'Leipzig') addProblem(file, 'agreementDetails.signedAt muss den belegten Unterzeichnungsort Leipzig enthalten');
        if (!Array.isArray(details.parties) || details.parties.length < 2) addProblem(file, 'agreementDetails.parties muss beide Vertragspartner enthalten');
        if (!Array.isArray(details.signatories) || details.signatories.length < 2) addProblem(file, 'agreementDetails.signatories muss beide Unterzeichner enthalten');
        if (!Array.isArray(details.legalBases) || details.legalBases.length === 0) addProblem(file, 'agreementDetails.legalBases muss die Rechtsgrundlage enthalten');
        for (const [index, basis] of (details.legalBases ?? []).entries()) {
          if (basis.url && !/^https:\/\//u.test(basis.url)) addProblem(file, `agreementDetails.legalBases[${index}].url muss eine HTTPS-URL sein`);
        }
      }
    }
  }

  if (rel.startsWith('normen/') && basename(file) === 'history.json') {
    for (const [index, entry] of (json.entries ?? []).entries()) {
      if (typeof entry.citation === 'string' && /^(?:OGVBl|StAnzO|OABl|OVertrBl|GMBl)\./u.test(entry.citation.trim())) {
        addProblem(file, `entries[${index}].citation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben`);
      }
    }
  }

  if (rel.startsWith('normen/') && rel.includes('/versions/')) {
    if (typeof json.citation === 'string'
      && /^(?:OGVBl|StAnzO|OABl|OVertrBl|GMBl)\./u.test(json.citation.trim())) {
      addProblem(file, 'citation darf nicht nur aus der Fundstelle bestehen; Normart und Dokumentdatum müssen erhalten bleiben');
    }
    for (const [index, source] of (json.sourceReferences ?? []).entries()) {
      await validateNormSourceReference(file, source, `sourceReferences[${index}]`);
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
        if (['primary-pdf', 'structured-docx-source'].includes(source.kind)) {
          const expectedExtension = source.kind === 'primary-pdf' ? /\.pdf$/iu : /\.docx$/iu;
          if (typeof source.localSource !== 'string' || !expectedExtension.test(source.localSource)) {
            addProblem(file, `${sourcePath}.localSource besitzt nicht das für ${source.kind} erwartete Format`);
          }
          if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(source.sha256)) {
            addProblem(file, `${sourcePath}.sha256 muss einen SHA-256 enthalten`);
          } else if (await exists(resolve(root, source.localSource))) {
            const actualHash = await fileSha256(resolve(root, source.localSource));
            if (actualHash !== source.sha256) {
              addProblem(file, `${sourcePath}.sha256 stimmt nicht mit der unveränderten Quelle überein`);
            }
          }
          if (typeof source.verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(source.verifiedAt)) {
            addProblem(file, `${sourcePath}.verifiedAt muss als ISO-Datum dokumentiert sein`);
          }
          if (!['structure-bearing', 'visual-control'].includes(source.sourceRole)) {
            addProblem(file, `${sourcePath}.sourceRole muss structure-bearing oder visual-control sein`);
          }
          if (source.kind === 'primary-pdf' && (!Number.isInteger(source.pageCount) || source.pageCount < 1)) {
            addProblem(file, `${sourcePath}.pageCount muss die Seitenzahl des PDFs enthalten`);
          }
          if (source.derivedSource !== undefined) {
            await validateVersionedSource(file, `${sourcePath}.derivedSource`, source.derivedSource);
          }
        }
        if (source.kind === 'structured-html-transcription' && source.sourceRole !== undefined && source.sourceRole !== 'structure-bearing') {
          addProblem(file, `${sourcePath}.sourceRole muss für die strukturierte HTML-Fassung structure-bearing sein`);
        }
        if (source.kind === 'supplementary-markdown-transcription' && source.sourceRole !== 'supplementary-transcription') {
          addProblem(file, `${sourcePath}.sourceRole muss für die zusätzliche Markdown-Fassung supplementary-transcription sein`);
        }
        if (source.derivedSource !== undefined) {
          await validateVersionedSource(file, `${sourcePath}.derivedSource`, source.derivedSource);
        }
        if (source.sha256 !== undefined) {
          if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(source.sha256)) {
            addProblem(file, `${sourcePath}.sha256 muss einen SHA-256 enthalten`);
          } else if (await exists(resolve(root, source.localSource))) {
            const actualHash = await fileSha256(resolve(root, source.localSource));
            if (actualHash !== source.sha256) {
              addProblem(file, `${sourcePath}.sha256 stimmt nicht mit der unveränderten Quelle überein`);
            }
          }
        }
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
    if (json.publication === 'GMBl.') {
      if (json.place !== 'Bonn') addProblem(file, 'place muss für GMBl. 2026 Nr. 14 den Ausgabeort Bonn enthalten');
      if (json.publisher !== 'Bundesministerium des Innern und für Heimat') {
        addProblem(file, 'publisher muss das herausgebende Bundesministerium enthalten');
      }
      const requiredKinds = new Set(['structured-html-transcription', 'primary-pdf', 'supplementary-markdown-transcription']);
      for (const source of json.sourceReferences ?? []) requiredKinds.delete(source.kind);
      if (requiredKinds.size > 0) addProblem(file, `GMBl.-Ausgabe enthält nicht alle drei Quellenrollen: ${[...requiredKinds].join(', ')}`);
    }

    const entryIds = new Set();
    const startPageOwners = new Map();
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

      if (entry.startPage && entry.pages) {
        addProblem(file, `${entryPath} darf nicht zugleich startPage und pages verwenden`);
      }
      if (entry.startPage) {
        const owners = startPageOwners.get(entry.startPage) ?? [];
        owners.push(index);
        startPageOwners.set(entry.startPage, owners);
      }

      if (typeof entry.citation !== 'string' || entry.citation.trim().length === 0) {
        addProblem(file, `${entryPath}.citation fehlt oder ist leer`);
      } else if (/^(?:OGVBl|StAnzO|OABl|OVertrBl|GMBl)\./u.test(entry.citation.trim())) {
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
          const history = byPrefix(`normen/${entry.normSlug}/`).find(({ file: normFile }) =>
            basename(normFile) === 'history.json',
          )?.json;
          // Verkündungseintrag und Norm bezeichnen dieselbe Rechtsvorschrift: Eintragsart und
          // Zitierbezeichnung müssen zum Normtyp passen.
          if (meta?.type && typeof entry.type === 'string' && !isCompatiblePublicationEntryType(entry.type, meta.type)) {
            addProblem(file, `${entryPath}.type „${entry.type}“ passt nicht zum Normtyp „${meta.type}“ von ${entry.normSlug}`);
          }
          if (meta?.type && typeof entry.citation === 'string' && !citationLabelMatchesNormType(entry.citation, meta.type)) {
            addProblem(file, `${entryPath}.citation nennt keine zum Normtyp „${meta.type}“ passende Rechtsaktbezeichnung: „${entry.citation}“`);
          }
          const referencesInitialVersion = !entry.versionId || history?.initialVersionId === entry.versionId;
          if (referencesInitialVersion && entry.documentDate && meta?.documentDate && entry.documentDate !== meta.documentDate) {
            addProblem(file, `${entryPath}.documentDate weicht vom Normdatensatz ${entry.normSlug} ab`);
          }
          if (referencesInitialVersion && meta?.publicationDate && meta.publicationDate !== json.date) {
            addProblem(file, `${entryPath} verweist auf eine Norm mit abweichendem Veröffentlichungsdatum`);
          }
        }
      }
    }

    if (/^ogvbl-2026-(?:4[6-9]|5\d)$/u.test(json.slug)) {
      for (const [page, owners] of startPageOwners) {
        if (owners.length > 1) addProblem(file, `Anfangsseite ${page} wurde pauschal mehreren Einträgen zugeordnet`);
      }
      for (const [index, entry] of (json.entries ?? []).entries()) {
        if (entry.pages === '2') addProblem(file, `entries[${index}].pages darf eine bloße Anfangsseite nicht als Seitenbereich modellieren`);
        if (index > 0 && /\bS\.\s*2\b/u.test(entry.citation) && !entry.startPage && !entry.pages) {
          addProblem(file, `entries[${index}].citation enthält eine unbelegte pauschale Seite 2`);
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
  for (const relationField of ['predecessorSlug', 'successorSlug']) {
    if (json[relationField] && !normSlugs.has(json[relationField])) {
      addProblem(file, `${relationField} verweist auf unbekannte Norm: ${json[relationField]}`);
    }
    if (json[relationField] === json.slug) {
      addProblem(file, `${relationField} darf nicht auf die Vorschrift selbst verweisen`);
    }
  }
  if (json.publicationDate && !json.documentDate && !json.dateNote) {
    addProblem(file, 'publicationDate ist gesetzt, aber documentDate oder eine begründete dateNote fehlt');
  }
  if (json.status === 'future-effective' && (!json.effectiveDate || json.effectiveDate <= referenceDate)) {
    addProblem(file, 'future-effective setzt ein Inkrafttreten nach dem Stichtag voraus');
  }
  if (json.status === 'in-force' && json.effectiveDate && json.effectiveDate > referenceDate) {
    addProblem(file, 'in-force setzt ein Inkrafttreten am oder vor dem Stichtag voraus');
  }
  if (json.status === 'pending-effective' && json.effectiveDate) {
    addProblem(file, 'pending-effective darf kein unbelegtes konkretes Inkrafttretensdatum enthalten');
  }
  if (json.status === 'repealed' && (!json.expiryDate || json.expiryDate > referenceDate)) {
    addProblem(file, 'repealed setzt ein Außerkrafttreten am oder vor dem Stichtag voraus');
  }
  // Eine befristete Allgemeinverfügung nennt ihr Ende im Titel oder im Wortlaut; das
  // Außerkrafttreten wird als expiryDate geführt (validTo der letzten Fassung prüft die
  // allgemeine Fassungsregel weiter unten).
  if (json.type === 'allgemeinverfuegung' && !json.expiryDate) {
    const bodyText = byPrefix(`normen/${json.slug}/versions/`)
      .flatMap(({ json: version }) => collectStrings(version.body ?? []).map((entry) => entry.value))
      .join('\n');
    if (LIMITED_PERIOD_PATTERN.test(`${json.title ?? ''}\n${bodyText}`)) {
      addProblem(file, 'befristete Allgemeinverfügung benötigt ein belegtes expiryDate');
    }
  }

  for (const relation of ['enactedNorm', 'enactingNorm', 'containedIn']) {
    const targetSlug = json[relation];
    if (!targetSlug) continue;
    const target = normMetaBySlug.get(targetSlug);
    if (!target) {
      addProblem(file, `${relation} verweist auf unbekannte Norm: ${targetSlug}`);
    }
    if (targetSlug === json.slug) addProblem(file, `${relation} darf nicht auf die Vorschrift selbst verweisen`);
  }
  for (const targetSlug of json.enactedNorms ?? []) {
    const target = normMetaBySlug.get(targetSlug);
    if (!target) {
      addProblem(file, `enactedNorms verweist auf unbekannte Norm: ${targetSlug}`);
    }
    if (targetSlug === json.slug) addProblem(file, 'enactedNorms darf die Vorschrift selbst nicht enthalten');
  }
  for (const targetSlug of json.relatedNorms ?? []) {
    if (!normSlugs.has(targetSlug)) {
      addProblem(file, `relatedNorms verweist auf unbekannte Norm: ${targetSlug}`);
    }
    if (targetSlug === json.slug) addProblem(file, 'relatedNorms darf die Vorschrift selbst nicht enthalten');
  }
  for (const targetSlug of json.affectedNorms ?? []) {
    const target = normMetaBySlug.get(targetSlug);
    if (!target) {
      addProblem(file, `affectedNorms verweist auf unbekannte Norm: ${targetSlug}`);
    }
    if (targetSlug === json.slug) addProblem(file, 'affectedNorms darf die Vorschrift selbst nicht enthalten');
  }
  for (const amendmentSlug of json.affectedByNorms ?? []) {
    const amendment = normMetaBySlug.get(amendmentSlug);
    if (!amendment) {
      addProblem(file, `affectedByNorms verweist auf unbekannte Norm: ${amendmentSlug}`);
    }
    if (amendmentSlug === json.slug) addProblem(file, 'affectedByNorms darf die Vorschrift selbst nicht enthalten');
  }
}

for (const { file, json } of byPrefix('normen/').filter(({ file }) => basename(file) === 'history.json')) {
  const normSlug = relative(contentRoot, file).split('/')[1];
  const versionIds = normVersionIds.get(normSlug) ?? new Set();
  if (json.initialVersionId !== null && !versionIds.has(json.initialVersionId)) {
    addProblem(file, `initialVersionId verweist auf unbekannte Fassung: ${json.initialVersionId}`);
  }
  for (const [index, entry] of (json.entries ?? []).entries()) {
    if (entry.affectingVersionId && !versionIds.has(entry.affectingVersionId)) {
      addProblem(file, `entries[${index}].affectingVersionId verweist auf unbekannte Fassung: ${entry.affectingVersionId}`);
    }
    if (!entry.relatedNorm) continue;
    const amendment = normMetaBySlug.get(entry.relatedNorm);
    if (!amendment) {
      addProblem(file, `entries[${index}].relatedNorm verweist auf unbekannte Norm: ${entry.relatedNorm}`);
    }
    if (entry.relatedNorm === normSlug) addProblem(file, `entries[${index}].relatedNorm darf nicht auf die Vorschrift selbst verweisen`);
  }
}

// Titelmodell und Herkunft der Zusammenfassung über den ganzen Bestand: Fassungen spiegeln die
// Bezeichnungen der Norm, Formeln aus Typ und Titel bleiben als abgeleitet gekennzeichnet und
// werden öffentlich nicht ausgespielt (scripts/lib/norm-title-rules.mjs).
for (const { file, json: meta } of normMetaRecords) {
  const versionRecords = byPrefix(`normen/${meta.slug}/versions/`);
  const hasRevosaxProvenance = [
    ...(meta.sourceReferences ?? []),
    ...versionRecords.flatMap(({ json }) => json.sourceReferences ?? []),
  ].some((reference) => reference?.kind === 'revosax-snapshot');
  const summary = String(meta.summary ?? '').trim();
  const formula = isDerivedSummary(summary) || isTitleFormulaSummary(summary, meta.title);
  if (formula && !hasRevosaxProvenance) {
    addProblem(file, 'summary ist eine aus Typ und Titel gebildete Formel; eigene Vorschriften brauchen eine redaktionelle Kurzbeschreibung');
  } else if (formula && meta.summarySource !== 'derived') {
    addProblem(file, 'summary ist eine abgeleitete Formel und muss summarySource "derived" führen');
  }
  if (meta.summarySource === 'derived' && !formula) {
    addProblem(file, 'summarySource "derived" ohne eine der abgeleiteten Formeln');
  }

  for (const { file: versionFile, json: version } of versionRecords) {
    const versionTitle = String(version.title ?? meta.title ?? '').trim();
    if (typeof version.shortTitle === 'string' && version.shortTitle.trim() === versionTitle) {
      addProblem(versionFile, 'shortTitle wiederholt den Titel der Fassung; die Kurzbezeichnung entfällt dann');
    }
    if (typeof version.shortTitle === 'string' && isAbbreviationLikeLabel(version.shortTitle)) {
      addProblem(versionFile, `shortTitle ist eine Abkürzungsform und gehört in keywords: ${version.shortTitle}`);
    }
    const versionAbbrProblem = abbreviationProblem(version.abbr, {
      title: versionTitle,
      shortTitle: version.shortTitle ?? meta.shortTitle,
    });
    if (versionAbbrProblem) {
      addProblem(versionFile, `abbr ${versionAbbrProblem}: ${String(version.abbr).replace(/\s+/gu, ' ')}`);
    }
  }
}

/**
 * Normkörper: Unterschriften stehen in einem eigenen Blocktyp, gesperrter Satz der amtlichen
 * Quelle wird als gewöhnliches Wort gespeichert, und die Überschrift einer Gliederungseinheit
 * steht genau einmal – nicht zusätzlich als erste Zeile ihres ersten Untergliederungspunktes.
 */
const comparableHeading = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('de');

function auditBodyBlocks(file, blocks, path = 'body') {
  for (const [index, block] of (blocks ?? []).entries()) {
    const blockPath = `${path}[${index}] (${block.type})`;
    for (const field of ['label', 'title', 'text']) {
      const value = block[field];
      if (typeof value !== 'string' || !hasSpacedLetters(value)) continue;
      if (block.type === 'signature' && field === 'text') continue;
      addProblem(file, `${blockPath}.${field} enthält gesperrt gesetzten Text „${value.slice(0, 60)}“; Unterschriften gehören in einen signature-Block, Hervorhebungen werden ohne Sperrung gespeichert`);
    }
    if (block.title && Array.isArray(block.children) && block.children.length > 0) {
      const first = block.children[0];
      if (typeof first?.text === 'string' && first.text) {
        const lines = first.text.split('\n');
        const title = comparableHeading(block.title);
        const label = comparableHeading(block.label);
        const labelAndTitle = label ? comparableHeading(`${block.label} ${block.title}`) : title;
        const firstLine = comparableHeading(lines[0]);
        const duplicated = firstLine === title || firstLine === labelAndTitle ||
          (label && firstLine === label && comparableHeading(lines[1]) === title);
        if (duplicated) {
          addProblem(file, `${blockPath}: Der Text des ersten Untergliederungspunktes beginnt mit der Überschrift der übergeordneten Einheit „${block.title}“`);
        }
      }
    }
    auditBodyBlocks(file, block.children, `${blockPath}`);
  }
}

for (const { file, json } of byPrefix('normen/').filter(({ relativePath }) => relativePath.includes('/versions/'))) {
  auditBodyBlocks(file, json.body);
}

for (const slug of normSlugs) {
  const versions = byPrefix(`normen/${slug}/versions/`)
    .map(({ file, json }) => ({ file, json }))
    .sort((left, right) => String(left.json.validFrom).localeCompare(String(right.json.validFrom)));
  const expiryDate = normMetaBySlug.get(slug)?.expiryDate;
  const lastVersion = versions.at(-1);
  if (expiryDate && lastVersion?.json.validTo !== expiryDate) {
    addProblem(
      lastVersion?.file ?? join(contentRoot, 'normen', slug),
      `validTo der letzten Fassung muss dem belegten expiryDate ${expiryDate} entsprechen`,
    );
  }
  for (const [index, { file, json }] of versions.entries()) {
    if (json.validTo && json.validTo < json.validFrom) {
      addProblem(file, 'validTo liegt vor validFrom');
    }
    const next = versions[index + 1];
    if (next && (!json.validTo || json.validTo >= next.json.validFrom)) {
      addProblem(file, `Gültigkeitsintervall überlappt mit ${relative(contentRoot, next.file)}`);
    } else if (next) {
      const expectedValidTo = new Date(`${next.json.validFrom}T00:00:00Z`);
      expectedValidTo.setUTCDate(expectedValidTo.getUTCDate() - 1);
      if (json.validTo !== expectedValidTo.toISOString().slice(0, 10)) {
        addProblem(file, `Gültigkeitsintervall besitzt eine Lücke vor ${relative(contentRoot, next.file)}`);
      }
    }
  }
}

for (const { file, json } of byPrefix('verkuendungen/').filter(({ json }) => /^ogvbl-2026-(?:4[6-9]|5\d)$/u.test(json.slug))) {
  const publicationSource = json.sourceReferences?.find((source) => source.kind === 'structured-html-transcription')?.localSource;
  for (const [index, entry] of (json.entries ?? []).entries()) {
    const meta = normMetaBySlug.get(entry.normSlug);
    if (!meta) continue;
    if (!publicationSource || !meta.sourceReferences?.some((source) => source.localSource === publicationSource)) {
      addProblem(file, `entries[${index}] und Normdatensatz ${entry.normSlug} verweisen nicht auf dieselbe HTML-Quelle`);
    }
  }
}

for (const { file, json } of byPrefix('verkuendungen/')) {
  const structuredSource = json.sourceReferences?.find((source) =>
    ['structured-html-transcription', 'legacy-markdown-transcription'].includes(source.kind)
  )?.localSource;
  if (!structuredSource) continue;
  for (const [index, entry] of (json.entries ?? []).entries()) {
    const meta = normMetaBySlug.get(entry.normSlug);
    if (!meta) continue;
    if (!meta.sourceReferences?.some((source) => source.localSource === structuredSource)) {
      addProblem(file, `entries[${index}] und Normdatensatz ${entry.normSlug} verweisen nicht auf dieselbe strukturtragende Quelle`);
    }
  }
}

const constitutionMeta = normMetaBySlug.get('staatsverfassung-des-freistaates-ostdeutschland');
if (!constitutionMeta?.sourceReferences?.some((source) => source.localSource === 'Gesetze/Staatsverfassung.html')) {
  addProblem(join(contentRoot, 'normen/staatsverfassung-des-freistaates-ostdeutschland/meta.json'), 'sourceReferences muss auf Gesetze/Staatsverfassung.html verweisen');
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
  if (typeof value !== 'string') return '';
  // Die Fundstelle ist die letzte Klammergruppe mit Seiten- oder Nummernangabe; eine
  // vorangestellte Abkürzungsklammer wie „(VwV-SäHO)“ ist keine Fundstelle.
  const groups = [...value.matchAll(/\(([^)]+)\)/gu)].map((match) => match[1].trim());
  const fundstelle = [...groups].reverse().find((group) => /\b(?:S\.|Nr\.)\s*\S/u.test(group)) ?? groups.at(-1);
  const issued = value.match(/\bvom\s+(\d{1,2}\.\s*[\p{L}]+\s+\d{4}|\d{1,2}\.\d{1,2}\.\d{4})/u)?.[1]?.replace(/\s+/gu, ' ') ?? '';
  return `${fundstelle ?? value.trim()}${issued ? ` vom ${issued}` : ''}`;
}

const possibleDuplicateNorms = new Map();
for (const { file, json } of normMetaRecords) {
  // Artikel derselben Mantelvorschrift können gleichlautende Titel und dieselbe Fundstelle
  // tragen (mehrere Artikel ändern dasselbe Gesetz); der Artikelanker unterscheidet sie.
  const envelopeAnchor = (json.sourceReferences ?? []).find((source) => source.sourceRole === 'envelope-snapshot')?.url ?? '';
  const duplicateKey = [
    normalizeDuplicateTitle(json.title ?? ''),
    citationFundstelle(json.initialCitation),
    json.effectiveDate ?? '',
    envelopeAnchor,
  ].join('|');
  const candidates = possibleDuplicateNorms.get(duplicateKey) ?? [];
  candidates.push({ file, json });
  possibleDuplicateNorms.set(duplicateKey, candidates);
}
for (const candidates of possibleDuplicateNorms.values()) {
  if (candidates.length < 2) continue;
  for (const candidate of candidates) {
    const relatedSlugs = new Set([
      candidate.json.enactedNorm,
      ...(candidate.json.enactedNorms ?? []),
      candidate.json.enactingNorm,
      candidate.json.containedIn,
    ].filter(Boolean));
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
  if ('confirmedAsOf' in json) addProblem(file, 'confirmedAsOf wird zentral aus packages/shared/src/config/editorial.json abgeleitet und darf nicht im Vorgang wiederholt werden');
  if (json.stage !== 'in-kraft') addProblem(file, 'muss nach der belegten Verkündung und dem Inkrafttreten als in-kraft geführt werden');
  if (json.nextScheduledReading) addProblem(file, 'darf nach Abschluss der Beratung keine nächste angesetzte Lesung mehr enthalten');
  if (json.decidedOn !== '2026-07-20' || json.promulgatedOn !== '2026-07-20') {
    addProblem(file, 'muss Beschluss- und Verkündungsdatum 20. Juli 2026 getrennt ausweisen');
  }
  const promulgationSources = (json.sources ?? []).filter((source) => source.kind === 'verkuendung');
  if (promulgationSources.length !== 1) addProblem(file, `muss genau einen Verkündungsnachweis enthalten, gefunden: ${promulgationSources.length}`);
  if (!publicationKeys.has(`OGVBl.:2026:${json.publicationSlug?.replace('ogvbl-2026-', '')}`)) {
    addProblem(file, `publicationSlug verweist auf keine vorhandene OGVBl.-Ausgabe: ${json.publicationSlug}`);
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

const legacyGovernmentFields = ['amt', 'ressort', 'reihenfolge', 'current', 'servingFrom', 'servingTo', 'currentOffices', 'formerOffices', 'appointmentSource'];
for (const { file, json } of governmentMemberRecords) {
  for (const field of legacyGovernmentFields) {
    if (Object.hasOwn(json, field)) addProblem(file, `${field} wird aus content/organisation abgeleitet und darf nicht im Personenprofil gepflegt werden`);
  }
}
for (const { file, json } of ministryRecords) {
  if (Object.hasOwn(json, 'leitung')) addProblem(file, 'leitung wird aus content/organisation abgeleitet und darf nicht im Ressortprofil gepflegt werden');
  for (const link of json.verknuepfteLinks ?? []) {
    if (/^\/staatsregierung\/mitglieder\//u.test(link.href ?? '')) {
      addProblem(file, 'Leitungsprofile werden aus content/organisation abgeleitet und dürfen nicht als Ressortlink gepflegt werden');
    }
  }
}

for (let issue = 46; issue <= 58; issue += 1) {
  const slug = `ogvbl-2026-${issue}`;
  const matches = byPrefix('verkuendungen/').filter(({ json }) => json.slug === slug);
  if (matches.length !== 1) addProblem(join(contentRoot, 'verkuendungen'), `${slug} muss genau einmal vorhanden sein, gefunden: ${matches.length}`);
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

// Eine mitversionierte Quelle darf nicht zugleich behaupten, nicht Bestandteil des Repositorys zu sein.
function collectSourceReferenceArrays(value, path = '', output = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectSourceReferenceArrays(entry, `${path}[${index}]`, output));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'sourceReferences' && Array.isArray(entry)) output.push({ path: path ? `${path}.${key}` : key, references: entry });
      else collectSourceReferenceArrays(entry, path ? `${path}.${key}` : key, output);
    }
  }
  return output;
}
for (const { file, json } of records) {
  for (const { path, references } of collectSourceReferenceArrays(json)) {
    references.forEach((reference, index) => {
      if (reference && reference.availability === 'versioned' && /nicht Bestandteil des Repositorys/iu.test(reference.note ?? '')) {
        addProblem(file, `${path}[${index}].note widerspricht der versionierten Verfügbarkeit der Quelle`);
      }
    });
  }
}

// Archivierte Anlagen (data/recht/revosax-attachments.json): jede verifiziert, hashbelegt und eindeutig.
const attachmentsManifestPath = join(root, 'data', 'recht', 'revosax-attachments.json');
if (await exists(attachmentsManifestPath)) {
  const manifest = await readJson(attachmentsManifestPath);
  const attachmentKeys = new Set();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(manifest?.baselineDate ?? '')) addProblem(attachmentsManifestPath, 'baselineDate muss ein ISO-Datum sein');
  for (const [attachmentId, record] of Object.entries(manifest?.attachments ?? {})) {
    const where = `attachments.${attachmentId}`;
    if (!/^[0-9a-f]{64}$/u.test(record.sha256 ?? '')) addProblem(attachmentsManifestPath, `${where}.sha256 muss ein SHA-256-Hexwert sein`);
    if (!(Number.isInteger(record.size) && record.size > 0)) addProblem(attachmentsManifestPath, `${where}.size muss positiv sein`);
    if (record.verified !== true) addProblem(attachmentsManifestPath, `${where} ist nicht verifiziert`);
    if (typeof record.objectKey !== 'string' || !record.objectKey.startsWith(`revosax/${manifest.baselineDate}/attachments/${record.lawId}/${record.attachmentId}-`)) addProblem(attachmentsManifestPath, `${where}.objectKey folgt nicht dem Muster revosax/<Stichtag>/attachments/<lawId>/<attachmentId>-<Datei>`);
    if (!['pdf', 'word', 'spreadsheet', 'image', 'other'].includes(record.kind)) addProblem(attachmentsManifestPath, `${where}.kind ist unbekannt: ${record.kind}`);
    if (!/^https:\/\/www\.revosax\.sachsen\.de\/attachments\/\d+$/u.test(record.url ?? '')) addProblem(attachmentsManifestPath, `${where}.url ist keine REVOSax-Anlagenadresse`);
    if (!/^\d+(?:\.\d+)?$/u.test(String(record.sourceId ?? ''))) addProblem(attachmentsManifestPath, `${where}.sourceId ist keine REVOSax-Quellkennung`);
    if (attachmentKeys.has(record.objectKey)) addProblem(attachmentsManifestPath, `${where}.objectKey ist doppelt: ${record.objectKey}`);
    attachmentKeys.add(record.objectKey);
  }
}

// Quelleninventar der Altquellen (data/recht/alt-source-inventory.json): Binärquellen unverändert.
const altSourceInventoryPath = join(root, 'data', 'recht', 'alt-source-inventory.json');
if (await exists(altSourceInventoryPath)) {
  const inventory = await readJson(altSourceInventoryPath);
  for (const source of inventory?.sources ?? []) {
    if (!source?.localSource || !source?.sha256) continue;
    const sourcePath = resolve(root, source.localSource);
    if (!(await exists(sourcePath))) {
      addProblem(altSourceInventoryPath, `${source.id}: Quelle fehlt im Checkout: ${source.localSource}`);
    } else if ((await fileSha256(sourcePath)) !== source.sha256) {
      addProblem(altSourceInventoryPath, `${source.id}: sha256 stimmt nicht mit der Quelle überein`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(source.verifiedAt ?? '')) addProblem(altSourceInventoryPath, `${source.id}: verifiedAt muss ein ISO-Datum sein`);
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

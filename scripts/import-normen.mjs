#!/usr/bin/env node

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

import {
  classifyMarkdownSource,
  parseConsolidatedMarkdown,
  parsePublicationMarkdown,
  summarizeParsedSource,
} from './lib/norm-markdown-parser.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const allValuesAfter = (flag) => args.flatMap((entry, index) => entry === flag && args[index + 1] ? [args[index + 1]] : []);
const sourceDir = resolve(ROOT, valueAfter('--source-dir') ?? 'Gesetze');
const outputDir = resolve(ROOT, 'content', 'normen');
const publicationDir = resolve(ROOT, 'content', 'verkuendungen');
const shouldWrite = args.includes('--write');
const allowExistingUpdate = args.includes('--update-existing');
const selectedFiles = new Set(allValuesAfter('--file').flatMap((value) => value.split(',')).map((value) => basename(value.trim())));
const editorialConfig = JSON.parse(await readFile(resolve(ROOT, 'src/config/editorial.json'), 'utf8'));
const asOf = valueAfter('--as-of') ?? editorialConfig.referenceDate;

if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) {
  throw new Error(`Ungültiger Stichtag „${asOf}“. Erwartet wird --as-of JJJJ-MM-TT.`);
}

const ISSUE_CONFIG = {
  '46': [
    ['kreis-und-bezirksneuordnungsgesetz', 'Kreis- und Bezirksneuordnungsgesetz', 'KrBzNOG'],
    ['ostdeutsches-kreis-und-bezirksneuordnungsgesetz', 'Ostdeutsches Kreis- und Bezirksneuordnungsgesetz', 'OstKrBzNG'],
    ['ostdeutsche-bezirksordnung', 'Ostdeutsche Bezirksordnung', 'BzO', '2026-08-01'],
  ],
  '47': [
    ['ostdeutsche-eisenbahn-neuordnungsgesetz', 'Gesetz zur gemeinwirtschaftlichen Neuordnung des öffentlichen Verkehrs', 'ÖVNeuOG'],
    ['ostdeutsches-eisenbahngesetz', 'Ostdeutsches Eisenbahngesetz', 'OstEisG'],
    ['ostdeutsches-verkehrsvergesellschaftungsgesetz', 'Ostdeutsches Verkehrsvergesellschaftungsgesetz', 'OstVerkVergG'],
    ['verkehrsbindungsgesetz', 'Verkehrsbindungsgesetz', 'VerkBindG'],
  ],
  '48': [
    ['boom-europe-umsetzungsgesetz', 'Boom-Europe-Umsetzungsgesetz', 'BoomEUmsG'],
    ['hochgeschwindigkeitsluftfahrt-standortgesetz', 'Hochgeschwindigkeitsluftfahrt-Standortgesetz', 'HGLStG'],
    ['hochgeschwindigkeitsluftfahrt-sondervermoegensgesetz', 'Hochgeschwindigkeitsluftfahrt-Sondervermögensgesetz', 'HGLSVermG'],
  ],
  '49': [
    ['energie-und-waermevergesellschaftungs-paketgesetz', 'Energie- und Wärmevergesellschaftungspaket', 'EnWärmeVergPaketG'],
    ['energie-und-waermevergesellschaftungsgesetz', 'Energie- und Wärmevergesellschaftungsgesetz', 'EnWärmeVergG'],
    ['ostdeutsche-netze-gesetz', 'Ostdeutsche-Netze-Gesetz', 'ON-Gesetz'],
    ['landesenergiewerke-gesetz', 'Landesenergiewerke-Gesetz', 'LEW-Gesetz'],
    ['energie-und-waermefinanzierungsgesetz', 'Energie- und Wärmefinanzierungsgesetz', 'EnWärmeFinG'],
  ],
  '50': [
    ['kasernierte-grenzpolizei-errichtungsgesetz', 'Grenzpolizei-Errichtungsgesetz', 'KGrPolErrG'],
    ['kasernierte-grenzpolizei-gesetz', 'Kasernierte-Grenzpolizei-Gesetz', 'KGrPolG'],
  ],
  '51': [
    ['gesetz-zur-staerkung-der-psychologischen-psychotherapeutischen-und-psychiatrischen-versorgung', 'Gesetz zur Stärkung der psychologischen Versorgung', 'PsychVersStG'],
  ],
  '52': [
    ['sportneuordnungsgesetz', 'Ostdeutsches Sportneuordnungsgesetz', 'OstSportNOG'],
    ['ostdeutsches-sportfoerdergesetz', 'Ostdeutsches Sportfördergesetz', 'OstSportFG'],
    ['landesagentur-spitzensport-gesetz', 'Landesagentur-Spitzensport-Gesetz', 'LASpOG'],
    ['sportstiftungs-und-sportfondsgesetz', 'Sportstiftungs- und Sportfondsgesetz', 'SportStFG'],
    ['athletenfoerder-und-versorgungsgesetz', 'Athletenförder- und Versorgungsgesetz', 'AthlFördVersG'],
    ['betriebssportgemeinschaftengesetz', 'Betriebssportgemeinschaftengesetz', 'BetrSpG'],
  ],
  '53': [['erstes-gesetz-zur-grossen-staatsreform', 'Erstes Gesetz zur Großen Staatsreform', '1. StaatsreformG']],
  '54': [['zweites-gesetz-zur-grossen-staatsreform', 'Zweites Gesetz zur Großen Staatsreform', '2. StaatsreformG']],
  '55': [['drittes-gesetz-zur-grossen-staatsreform', 'Drittes Gesetz zur Großen Staatsreform', '3. StaatsreformG']],
  '56': [['viertes-gesetz-zur-grossen-staatsreform', 'Viertes Gesetz zur Großen Staatsreform', '4. StaatsreformG']],
  '57': [['gesetz-ueber-die-einfuehrung-einer-zweitveroeffentlichungspflicht', 'Zweitveröffentlichungspflichtgesetz', 'ZweitVeröffG']],
  '58': [['sero-verordnung', 'SERO-Verordnung', 'SERO-VO']],
};

const ISSUE_SUBJECTS = {
  '46': ['Kommunal- und Verwaltungsrecht', 'Raumordnung und Landesplanung'],
  '47': ['Mobilität und öffentliche Infrastruktur'],
  '48': ['Wirtschaft und Förderung', 'Haushaltsrecht'],
  '49': ['Umwelt, Energie und Klimaschutz', 'Öffentliche Wirtschaft'],
  '50': ['Sicherheit und Ordnung'],
  '51': ['Gesundheit und Soziales'],
  '52': ['Sport und Bildung'],
  '53': ['Staats- und Verfassungsrecht'],
  '54': ['Staats- und Verfassungsrecht', 'Haushaltsrecht'],
  '55': ['Staats- und Verfassungsrecht'],
  '56': ['Staats- und Verfassungsrecht', 'Bildung und Weiterbildung'],
  '57': ['Bildung und Weiterbildung', 'Rundfunk und Medien'],
  '58': ['Umwelt, Energie und Klimaschutz', 'Kreislaufwirtschaft'],
};

function formatGermanDate(isoDate) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}

function citationFor(parsed) {
  const label = parsed.type === 'verordnung' ? 'Verordnung' : 'Gesetz';
  return `${label} vom ${formatGermanDate(parsed.documentDate)} (OGVBl. 2026 Nr. ${parsed.issue} S. 2)`;
}

function deriveStatus(norm, index) {
  if (index === 0 && norm.type === 'aenderungsvorschrift') return 'one-time-act';
  if (!norm.effectiveDate) return 'pending-effective';
  return norm.effectiveDate > asOf ? 'future-effective' : 'in-force';
}

function buildRecords(parsed) {
  const configs = ISSUE_CONFIG[parsed.issue];
  const parsedNorms = [parsed, ...parsed.introducedNorms];
  if (!configs) throw new Error(`${parsed.fileName}: Für Ausgabe ${parsed.issue} fehlt eine stabile Importkonfiguration.`);
  if (configs.length !== parsedNorms.length) {
    throw new Error(`${parsed.fileName}: ${parsedNorms.length} Normen erkannt, aber ${configs.length} stabile Slug-Zuordnungen hinterlegt.`);
  }
  const outerSlug = configs[0][0];
  const enactedNorms = configs.slice(1).map((config) => config[0]);
  return parsedNorms.map((norm, index) => {
    const [slug, shortTitle, abbr, effectiveOverride] = configs[index];
    const effectiveDate = effectiveOverride ?? norm.effectiveDate;
    const recordNorm = { ...norm, effectiveDate };
    const citation = citationFor({ ...parsed, type: norm.type });
    const status = deriveStatus(recordNorm, index);
    const versionId = effectiveDate ?? parsed.publicationDate;
    const ministry = parsed.issue === '58'
      ? 'Staatsrat des Freistaates Ostdeutschland'
      : 'Landtag des Freistaates Ostdeutschland';
    const meta = {
      id: slug,
      slug,
      title: norm.title,
      shortTitle,
      abbr,
      type: norm.type,
      ministry,
      subjects: ISSUE_SUBJECTS[parsed.issue],
      keywords: [...new Set([abbr, shortTitle, ...shortTitle.split(/\s+/u).filter((word) => word.length >= 5)])].slice(0, 12),
      initialCitation: citation,
      predecessor: null,
      successor: null,
      summary: `Regelt ${norm.title}.`,
      status,
      documentDate: parsed.documentDate,
      publicationDate: parsed.publicationDate,
      ...(effectiveDate ? { effectiveDate } : {}),
      ...(index === 0 && enactedNorms.length === 1 ? { enactedNorm: enactedNorms[0] } : {}),
      ...(index === 0 && enactedNorms.length > 1 ? { enactedNorms } : {}),
      ...(index > 0 ? { enactingNorm: outerSlug } : {}),
      ...(parsed.issue === '46' && index === 1
        ? { dateNote: 'Das Gesetz gilt seit 21. Juli 2026; wesentliche Gebietsänderungen werden am 1. August 2026 wirksam.' }
        : {}),
    };
    const version = {
      versionId,
      validFrom: versionId,
      validTo: null,
      isCurrent: true,
      citation,
      changeNote: index === 0 ? 'Verkündete Fassung.' : 'Eingeführte Stammfassung.',
      body: norm.body,
    };
    const history = {
      initialVersionId: versionId,
      entries: [{
        date: parsed.publicationDate,
        type: 'initial',
        title: index === 0 ? 'Verkündung.' : 'Stammfassung verkündet.',
        citation,
        affectingVersionId: versionId,
        ...(index > 0 ? { relatedNorm: outerSlug } : {}),
      }],
    };
    return { meta, history, versions: [version], source: parsed.fileName, issue: parsed.issue };
  });
}

function buildConstitutionRecord(parsed) {
  const slug = 'staatsverfassung-des-freistaates-ostdeutschland';
  const versionId = '2026-07-21';
  const citation = 'Verfassung vom 15. Oktober 2024 (OGVBl. 2024 Nr. II S. 5)';
  return {
    source: parsed.fileName,
    meta: {
      id: slug,
      slug,
      title: 'Verfassung des Freistaates Ostdeutschland',
      shortTitle: 'Ostdeutsche Staatsverfassung',
      abbr: 'OstVerf',
      type: 'gesetz',
      ministry: 'Freistaat Ostdeutschland',
      subjects: ['Staats- und Verfassungsrecht'],
      keywords: ['Verfassung', 'Volkskammer', 'Staatsrat', 'Staatspräsident', 'Grundrechte', 'Staatsziele'],
      initialCitation: citation,
      predecessor: null,
      successor: null,
      summary: 'Bestimmt die staatliche Ordnung, die Grundrechte, die Staatsziele und die Verfassungsorgane des Freistaates Ostdeutschland.',
      status: 'in-force',
      documentDate: '2024-10-15',
      publicationDate: '2024-10-15',
      effectiveDate: '2024-10-15',
      dateNote: 'Die konsolidierte Markdown-Lesefassung nennt in Artikel 121a die siebte Volkskammer; der verkündete Wortlaut des Ersten Gesetzes zur Großen Staatsreform nennt an derselben Stelle die achte Volkskammer. Der Widerspruch ist redaktionell ungeklärt.',
    },
    history: {
      initialVersionId: versionId,
      entries: [
        { date: '2024-10-15', type: 'initial', title: 'Verfassung in Kraft getreten.', citation, affectingVersionId: versionId },
        ['erstes-gesetz-zur-grossen-staatsreform', 'Erstes Gesetz zur Großen Staatsreform', '53'],
        ['zweites-gesetz-zur-grossen-staatsreform', 'Zweites Gesetz zur Großen Staatsreform', '54'],
        ['drittes-gesetz-zur-grossen-staatsreform', 'Drittes Gesetz zur Großen Staatsreform', '55'],
        ['viertes-gesetz-zur-grossen-staatsreform', 'Viertes Gesetz zur Großen Staatsreform', '56'],
      ].map((entry) => Array.isArray(entry) ? ({
        date: '2026-07-21',
        type: 'amendment',
        title: `${entry[1]} berücksichtigt.`,
        citation: `Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. ${entry[2]} S. 2)`,
        affectingVersionId: versionId,
        relatedNorm: entry[0],
      }) : entry),
    },
    versions: [{
      versionId,
      validFrom: versionId,
      validTo: null,
      isCurrent: true,
      citation: 'Verfassung vom 15. Oktober 2024, zuletzt geändert durch Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 56 S. 2)',
      changeNote: 'Konsolidierte Lesefassung unter Berücksichtigung der vier Gesetze zur Großen Staatsreform.',
      body: parsed.body,
    }],
  };
}

function publicationFrom(parsed, records) {
  return {
    slug: `ogvbl-2026-${parsed.issue}`,
    title: `Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. ${parsed.issue}`,
    year: 2026,
    issue: parsed.issue,
    date: parsed.publicationDate,
    publication: 'OGVBl.',
    sourceReferences: [{
      kind: 'transcription',
      label: 'Redaktionell geprüfte Markdown-Fassung der Ausgabe',
      availability: 'versioned',
      localSource: `Gesetze/${basename(parsed.fileName)}`,
    }],
    entries: records.map((record) => ({
      id: record.meta.slug,
      title: record.meta.title,
      type: record.meta.type === 'verordnung' ? 'verordnung' : 'gesetz',
      citation: record.meta.initialCitation,
      pages: '2',
      documentDate: record.meta.documentDate,
      normSlug: record.meta.slug,
      versionId: record.versions[0].versionId,
    })),
  };
}

function validateRecord(record) {
  if (!record.meta.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.meta.slug)) throw new Error(`${record.source}: instabiler oder ungültiger Slug ${record.meta.slug}`);
  if (!record.versions[0].body.length) throw new Error(`${record.source}: ${record.meta.slug} besitzt einen leeren Normkörper`);
  const text = JSON.stringify(record.versions[0].body);
  if (/data:image|;base64,|Inhaltsverzeichnis|Dresden, den|LANDTAGSPRÄSIDENT/iu.test(text)) {
    throw new Error(`${record.source}: ${record.meta.slug} enthält Kopf-, Bild- oder Signaturdaten`);
  }
}

async function readExistingRecord(slug) {
  const directory = join(outputDir, slug);
  try {
    const meta = JSON.parse(await readFile(join(directory, 'meta.json'), 'utf8'));
    const history = JSON.parse(await readFile(join(directory, 'history.json'), 'utf8'));
    return { directory, meta, history };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function mergeWithExisting(record, existing) {
  if (!existing) return record;
  const preservedMeta = {
    ...record.meta,
    subjects: [...new Set([...(record.meta.subjects ?? []), ...(existing.meta.subjects ?? [])])],
    keywords: [...new Set([...(record.meta.keywords ?? []), ...(existing.meta.keywords ?? [])])],
    summary: existing.meta.summary || record.meta.summary,
    predecessor: existing.meta.predecessor ?? record.meta.predecessor,
    successor: existing.meta.successor ?? record.meta.successor,
  };
  const generatedEntryKeys = new Set(record.history.entries.map((entry) => JSON.stringify([
    entry.date,
    entry.type,
    entry.citation,
    entry.relatedNorm ?? null,
  ])));
  const preservedEntries = (existing.history.entries ?? []).filter((entry) => !generatedEntryKeys.has(JSON.stringify([
    entry.date,
    entry.type,
    entry.citation,
    entry.relatedNorm ?? null,
  ])));
  return {
    ...record,
    meta: preservedMeta,
    history: {
      initialVersionId: existing.history.initialVersionId ?? record.history.initialVersionId,
      entries: [...preservedEntries, ...record.history.entries]
        .sort((left, right) => left.date.localeCompare(right.date)),
    },
  };
}

async function writeJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function duplicateIdentity(meta) {
  const title = String(meta.title ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
  return `${title}|${meta.initialCitation ?? ''}|${meta.effectiveDate ?? ''}`;
}

function areExplicitlyRelated(left, right) {
  const leftRelations = new Set([left.enactedNorm, ...(left.enactedNorms ?? []), left.enactingNorm].filter(Boolean));
  const rightRelations = new Set([right.enactedNorm, ...(right.enactedNorms ?? []), right.enactingNorm].filter(Boolean));
  return leftRelations.has(right.slug) || rightRelations.has(left.slug);
}

async function validateWriteSet(candidateRecords) {
  const candidateSlugs = new Set();
  for (const record of candidateRecords) {
    validateRecord(record);
    if (candidateSlugs.has(record.meta.slug)) throw new Error(`${record.source}: doppelter Slug im Importlauf: ${record.meta.slug}`);
    candidateSlugs.add(record.meta.slug);
  }
  const existingMetas = [];
  for (const entry of await readdir(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      existingMetas.push(JSON.parse(await readFile(join(outputDir, entry.name, 'meta.json'), 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const record of candidateRecords) {
    const collisions = existingMetas.filter((meta) =>
      meta.slug !== record.meta.slug &&
      duplicateIdentity(meta) === duplicateIdentity(record.meta) &&
      !areExplicitlyRelated(meta, record.meta)
    );
    if (collisions.length > 0) {
      throw new Error(`${record.source}: „${record.meta.title}“ würde vorhandene Norm unter anderem Slug duplizieren: ${collisions.map((meta) => meta.slug).join(', ')}`);
    }
  }
}

async function writeRecord(record, changes) {
  validateRecord(record);
  const existing = await readExistingRecord(record.meta.slug);
  if (existing) {
    if (existing.meta.title !== record.meta.title) throw new Error(`${record.source}: Slug-Kollision ${record.meta.slug} mit „${existing.meta.title}“`);
    if (!allowExistingUpdate) {
      changes.push({ slug: record.meta.slug, action: 'unchanged-existing', note: 'nur mit --update-existing überschreibbar' });
      return;
    }
  }
  const mergedRecord = mergeWithExisting(record, existing);
  validateRecord(mergedRecord);
  const directory = join(outputDir, record.meta.slug);
  await writeJson(join(directory, 'meta.json'), mergedRecord.meta);
  await writeJson(join(directory, 'history.json'), mergedRecord.history);
  for (const version of mergedRecord.versions) await writeJson(join(directory, 'versions', `${version.versionId}.json`), version);
  changes.push({
    slug: record.meta.slug,
    action: existing ? 'updated' : 'created',
    ...(existing ? { note: 'manuell gepflegte Zusammenfassung, Sachgebiete, Suchbegriffe und Historieneinträge wurden bewahrt' } : {}),
  });
}

await access(sourceDir).catch(() => { throw new Error(`Quellverzeichnis fehlt: ${sourceDir}`); });
const directoryEntries = await readdir(sourceDir, { withFileTypes: true });
const markdownFiles = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name)
  .filter((name) => selectedFiles.size === 0 || selectedFiles.has(name))
  .sort((left, right) => left.localeCompare(right, 'de'));

if (selectedFiles.size > 0) {
  const missing = [...selectedFiles].filter((name) => !markdownFiles.includes(name));
  if (missing.length) throw new Error(`Ausgewählte Markdown-Quelle fehlt: ${missing.join(', ')}`);
}

const report = { asOf, mode: shouldWrite ? 'incremental-write' : 'audit-only', recognized: [], skipped: [], ambiguous: [], changes: [] };
const records = [];
const publications = [];
for (const fileName of markdownFiles) {
  const sourcePath = join(sourceDir, fileName);
  const markdown = await readFile(sourcePath, 'utf8');
  const classification = classifyMarkdownSource(fileName, markdown);
  if (classification.kind === 'editorial') {
    report.skipped.push({ file: fileName, reason: classification.reason });
    continue;
  }
  if (classification.kind === 'ambiguous') {
    report.ambiguous.push({ file: fileName, reason: classification.reason });
    continue;
  }
  if (classification.kind === 'consolidated') {
    if (fileName === 'Staatsverfassung.md') {
      const parsed = parseConsolidatedMarkdown(fileName, markdown, { title: 'Verfassung des Freistaates Ostdeutschland' });
      report.recognized.push({ file: fileName, classification: classification.kind, norms: [{ title: parsed.title, type: 'gesetz' }] });
      records.push(buildConstitutionRecord(parsed));
    } else {
      report.recognized.push({ file: fileName, classification: classification.kind, norms: [] });
    }
    continue;
  }
  try {
    const parsed = parsePublicationMarkdown(fileName, markdown);
    const summaries = summarizeParsedSource(parsed);
    report.recognized.push({ file: fileName, classification: classification.kind, norms: summaries });
    if (ISSUE_CONFIG[parsed.issue]) {
      const issueRecords = buildRecords(parsed);
      issueRecords.forEach(validateRecord);
      records.push(...issueRecords);
      publications.push(publicationFrom(parsed, issueRecords));
    }
  } catch (error) {
    report.ambiguous.push({ file: fileName, reason: error.message });
    if (selectedFiles.has(fileName)) throw error;
  }
}

if (!shouldWrite) {
  for (const record of records) {
    const exists = Boolean(await readExistingRecord(record.meta.slug));
    report.changes.push({ slug: record.meta.slug, action: exists ? 'would-update' : 'would-create' });
  }
  for (const publication of publications) {
    const path = join(publicationDir, `${publication.slug}.json`);
    const exists = await access(path).then(() => true).catch(() => false);
    report.changes.push({ slug: publication.slug, action: exists ? 'would-update-publication' : 'would-create-publication' });
  }
}

if (shouldWrite) {
  if (selectedFiles.size === 0) throw new Error('Schreibmodus benötigt mindestens ein ausdrückliches --file. Ein unkontrollierter Gesamtimport ist gesperrt.');
  await validateWriteSet(records);
  for (const record of records) await writeRecord(record, report.changes);
  for (const publication of publications) {
    const path = join(publicationDir, `${publication.slug}.json`);
    const exists = await access(path).then(() => true).catch(() => false);
    if (exists && !allowExistingUpdate) throw new Error(`${relative(ROOT, path)} existiert bereits; Aktualisierung nur mit --update-existing.`);
    await writeJson(path, publication);
    report.changes.push({ slug: publication.slug, action: exists ? 'updated-publication' : 'created-publication' });
  }
}

console.log(JSON.stringify(report, null, 2));
if (!shouldWrite) console.error('Prüflauf: Es wurden keine Dateien geschrieben. Gezielt schreiben mit --write --file <Datei>.');

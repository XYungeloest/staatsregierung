#!/usr/bin/env node

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

import {
  classifyMarkdownSource,
  parseConsolidatedMarkdown,
  parsePublicationMarkdown,
  summarizeParsedSource,
} from './lib/norm-markdown-parser.mjs';
import {
  validateConstitutionParserContract,
  validatePublicationParserContract,
} from './lib/norm-parser-contract.mjs';

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
const strictMode = args.includes('--strict');
const quietMode = args.includes('--quiet');
const allowExistingUpdate = args.includes('--update-existing');
const selectedFiles = new Set(allValuesAfter('--file').flatMap((value) => value.split(',')).map((value) => basename(value.trim())));
const editorialConfig = JSON.parse(await readFile(resolve(ROOT, 'src/config/editorial.json'), 'utf8'));
const asOf = valueAfter('--as-of') ?? editorialConfig.referenceDate;

if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) {
  throw new Error(`Ungültiger Stichtag „${asOf}“. Erwartet wird --as-of JJJJ-MM-TT.`);
}
if (strictMode && shouldWrite) {
  throw new Error('--strict ist ein reiner Prüfmodus und kann nicht mit --write kombiniert werden.');
}

const ISSUE_CONFIG = {
  '46': [
    { slug: 'kreis-und-bezirksneuordnungsgesetz', shortTitle: 'Kreis- und Bezirksneuordnungsgesetz', responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft', summary: 'Führt die Kreis- und Bezirksneuordnung ein, ersetzt die Bezirksordnung und passt kommunal- und verwaltungsrechtliche Vorschriften an.' },
    { slug: 'ostdeutsches-kreis-und-bezirksneuordnungsgesetz', shortTitle: 'Ostdeutsches Kreis- und Bezirksneuordnungsgesetz', responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft', summary: 'Ordnet die Bezirke und Kreise neu und bestimmt deren Errichtung, Zuordnung, Rechtsnachfolge und Übergang zum 1. August 2026.' },
    { slug: 'ostdeutsche-bezirksordnung', shortTitle: 'Ostdeutsche Bezirksordnung', effectiveOverride: '2026-08-01', responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft', summary: 'Bestimmt Rechtsstellung, Aufgaben, Organe, Verwaltung und Aufsicht der Bezirke.' },
  ],
  '47': [
    { slug: 'ostdeutsche-eisenbahn-neuordnungsgesetz', shortTitle: 'Gesetz zur gemeinwirtschaftlichen Neuordnung des öffentlichen Verkehrs', responsibleMinistry: 'Staatssekretariat für Mobilität und regionale Entwicklung', summary: 'Errichtet die Ostdeutsche Eisenbahn und schafft die gesetzlichen Grundlagen für Verkehrsvergesellschaftung und dauerhafte Gemeinwohlbindung.' },
    { slug: 'ostdeutsches-eisenbahngesetz', shortTitle: 'Ostdeutsches Eisenbahngesetz', responsibleMinistry: 'Staatssekretariat für Mobilität und regionale Entwicklung', summary: 'Errichtet die Ostdeutsche Eisenbahn als Anstalt des öffentlichen Rechts und bestimmt Aufgaben, Organisation und gemeinwirtschaftliche Bindung.' },
    { slug: 'ostdeutsches-verkehrsvergesellschaftungsgesetz', shortTitle: 'Ostdeutsches Verkehrsvergesellschaftungsgesetz', responsibleMinistry: 'Staatssekretariat für Mobilität und regionale Entwicklung', summary: 'Regelt die Überführung privater Verkehrsproduktionsmittel in Gemeineigentum sowie Verfahren und Entschädigung.' },
    { slug: 'verkehrsbindungsgesetz', shortTitle: 'Verkehrsbindungsgesetz', responsibleMinistry: 'Staatssekretariat für Mobilität und regionale Entwicklung', summary: 'Sichert die dauerhafte öffentliche Zweckbindung vergesellschafteter Verkehrsproduktionsmittel.' },
  ],
  '48': [
    { slug: 'boom-europe-umsetzungsgesetz', shortTitle: 'Boom-Europe-Umsetzungsgesetz', responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit', summary: 'Schafft Standort- und Finanzierungsgrundlagen für das Vorhaben „Boom Europe Leipzig/Halle“.' },
    { slug: 'hochgeschwindigkeitsluftfahrt-standortgesetz', shortTitle: 'Hochgeschwindigkeitsluftfahrt-Standortgesetz', responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit', summary: 'Bestimmt das Vorhaben als Projekt besonderer Landesbedeutung und regelt Projektstelle, Koordinierung und Verfahrensunterstützung.' },
    { slug: 'hochgeschwindigkeitsluftfahrt-sondervermoegensgesetz', shortTitle: 'Hochgeschwindigkeitsluftfahrt-Sondervermögensgesetz', responsibleMinistry: 'Staatssekretariat der Finanzen', summary: 'Errichtet das Sondervermögen Hochgeschwindigkeitsluftfahrt Ost und bestimmt Zweck, Finanzierung und Wirtschaftsführung.' },
  ],
  '49': [
    { slug: 'energie-und-waermevergesellschaftungs-paketgesetz', shortTitle: 'Energie- und Wärmevergesellschaftungspaket', responsibleMinistry: 'Staatssekretariat für Nachhaltigkeit und Energie', summary: 'Führt die Vorschriften zur Vergesellschaftung, zu öffentlichen Energieträgern und zur Finanzierung der Energie- und Wärmeinfrastruktur ein.' },
    { slug: 'energie-und-waermevergesellschaftungsgesetz', shortTitle: 'Energie- und Wärmevergesellschaftungsgesetz', responsibleMinistry: 'Staatssekretariat für Nachhaltigkeit und Energie', summary: 'Bestimmt Gegenstand, Verfahren und Entschädigung bei der Überführung von Energie- und Wärmeinfrastruktur in Gemeineigentum.' },
    { slug: 'ostdeutsche-netze-gesetz', shortTitle: 'Ostdeutsche-Netze-Gesetz', responsibleMinistry: 'Staatssekretariat für Nachhaltigkeit und Energie', summary: 'Ordnet öffentliche Netzträger, Netzbetrieb und demokratische Kontrolle der Energie- und Wärmeinfrastruktur.' },
    { slug: 'landesenergiewerke-gesetz', shortTitle: 'Landesenergiewerke-Gesetz', responsibleMinistry: 'Staatssekretariat für Nachhaltigkeit und Energie', summary: 'Errichtet die Landesenergiewerke und bestimmt ihre Aufgaben, Organisation und Gemeinwohlbindung.' },
    { slug: 'energie-und-waermefinanzierungsgesetz', shortTitle: 'Energie- und Wärmefinanzierungsgesetz', responsibleMinistry: 'Staatssekretariat der Finanzen', summary: 'Regelt Finanzierung, Sondervermögen und haushaltsrechtliche Absicherung der Energie- und Wärmevergesellschaftung.' },
  ],
  '50': [
    { slug: 'kasernierte-grenzpolizei-errichtungsgesetz', shortTitle: 'Grenzpolizei-Errichtungsgesetz', responsibleMinistry: 'Staatssekretariat für Staats- und Grenzsicherheit', summary: 'Errichtet die Kasernierte Grenzpolizei und führt deren gesetzliche Aufgaben- und Organisationsgrundlage ein.' },
    { slug: 'kasernierte-grenzpolizei-gesetz', shortTitle: 'Kasernierte-Grenzpolizei-Gesetz', responsibleMinistry: 'Staatssekretariat für Staats- und Grenzsicherheit', summary: 'Bestimmt Auftrag, Befugnisse, Organisation und parlamentarische Kontrolle der Kasernierten Grenzpolizei.' },
  ],
  '51': [
    { slug: 'gesetz-zur-staerkung-der-psychologischen-psychotherapeutischen-und-psychiatrischen-versorgung', shortTitle: 'Gesetz zur Stärkung der psychologischen Versorgung', responsibleMinistry: 'Staatssekretariat für Gesundheits- und Sozialwesen', summary: 'Ändert das Gesundheitsdienstgesetz zur Stärkung psychologischer, psychotherapeutischer und psychiatrischer Versorgungsangebote.' },
  ],
  '52': [
    { slug: 'sportneuordnungsgesetz', shortTitle: 'Ostdeutsches Sportneuordnungsgesetz', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Ordnet Sportförderung, Spitzensport, Sportfonds, Athletenversorgung und Betriebssport durch mehrere Stammgesetze neu.' },
    { slug: 'ostdeutsches-sportfoerdergesetz', shortTitle: 'Ostdeutsches Sportfördergesetz', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Bestimmt Ziele, Grundsätze, Träger und Instrumente der öffentlichen Sportförderung.' },
    { slug: 'landesagentur-spitzensport-gesetz', shortTitle: 'Landesagentur-Spitzensport-Gesetz', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Errichtet die Landesagentur Spitzensport und bestimmt Aufgaben, Organisation und Aufsicht.' },
    { slug: 'sportstiftungs-und-sportfondsgesetz', shortTitle: 'Sportstiftungs- und Sportfondsgesetz', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Errichtet Sportstiftung und Sportfonds und regelt deren Finanzierung und Mittelverwendung.' },
    { slug: 'athletenfoerder-und-versorgungsgesetz', shortTitle: 'Athletenförder- und Versorgungsgesetz', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Bestimmt Förderung, soziale Absicherung und Versorgung von Athletinnen und Athleten.' },
    { slug: 'betriebssportgemeinschaftengesetz', shortTitle: 'Betriebssportgemeinschaftengesetz', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Schafft die rechtlichen Grundlagen für Betriebssportgemeinschaften und ihre Förderung.' },
  ],
  '53': [{ slug: 'erstes-gesetz-zur-grossen-staatsreform', shortTitle: 'Erstes Gesetz zur Großen Staatsreform', responsibleMinistry: 'Staatssekretariat für Rechtsstaatlichkeit und kulturelle Emanzipation', summary: 'Ändert die Staatsverfassung zur Neuordnung der Verfassungsorgane, Rechtsetzung und staatlichen Organisation.' }],
  '54': [{ slug: 'zweites-gesetz-zur-grossen-staatsreform', shortTitle: 'Zweites Gesetz zur Großen Staatsreform', responsibleMinistry: 'Staatssekretariat der Finanzen', summary: 'Ändert die Finanzverfassung und stärkt den Schutz gemeinwirtschaftlichen Vermögens.' }],
  '55': [{ slug: 'drittes-gesetz-zur-grossen-staatsreform', shortTitle: 'Drittes Gesetz zur Großen Staatsreform', responsibleMinistry: 'Staatssekretariat für Rechtsstaatlichkeit und kulturelle Emanzipation', summary: 'Erweitert die Staatsziele insbesondere zu Daseinsvorsorge, Wohnen, Gesundheit, Pflege und gesellschaftlicher Teilhabe.' }],
  '56': [{ slug: 'viertes-gesetz-zur-grossen-staatsreform', shortTitle: 'Viertes Gesetz zur Großen Staatsreform', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Ändert die Verfassungsvorschriften zu Bildung, Schulwesen, Wissenschaft und Religion.' }],
  '57': [{ slug: 'gesetz-ueber-die-einfuehrung-einer-zweitveroeffentlichungspflicht', shortTitle: 'Gesetz über die Einführung einer Zweitveröffentlichungspflicht', responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Ergänzt das Hochschulgesetz um eine satzungsrechtlich auszugestaltende Zweitveröffentlichungspflicht.' }],
  '58': [{ slug: 'sero-verordnung', shortTitle: 'SERO-Verordnung', responsibleMinistry: 'Staatssekretariat für Nachhaltigkeit und Energie', summary: 'Ordnet die Erfassung von Sekundärrohstoffen und die landeseigene Infrastruktur für Wiederverwendung, Reparatur und Kreislaufwirtschaft.' }],
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

// Frühere Importläufe hatten diese rein redaktionell gebildeten Kürzel als
// amtliche Suchbegriffe gespeichert. Sie sind in den Primärquellen nicht
// belegt und werden deshalb auch beim Zusammenführen mit Bestandsdaten entfernt.
const UNVERIFIED_GENERATED_ABBREVIATIONS = new Set([
  'KrBzNOG', 'ÖVNeuOG', 'BoomEUmsG', 'EnWärmeVergPaketG', 'KGrPolErrG',
  'PsychVersStG', '1. StaatsreformG', '2. StaatsreformG', '3. StaatsreformG',
  '4. StaatsreformG', 'ZweitVeröffG',
]);

function formatGermanDate(isoDate) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}

function citationFor(parsed, startPage) {
  const label = parsed.type === 'verordnung' ? 'Verordnung' : 'Gesetz';
  return `${label} vom ${formatGermanDate(parsed.documentDate)} (OGVBl. 2026 Nr. ${parsed.issue}${startPage ? ` S. ${startPage}` : ''})`;
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
  const outerSlug = configs[0].slug;
  const enactedNorms = configs.slice(1).map((config) => config.slug);
  return parsedNorms.map((norm, index) => {
    const config = configs[index];
    const { slug, shortTitle, responsibleMinistry, summary } = config;
    const effectiveDate = config.effectiveOverride ?? norm.effectiveDate;
    const recordNorm = { ...norm, effectiveDate };
    const startPage = index === 0 ? parsed.startPage : undefined;
    const citation = citationFor({ ...parsed, type: norm.type }, startPage);
    const status = deriveStatus(recordNorm, index);
    const versionId = effectiveDate ?? parsed.publicationDate;
    const enactingBody = parsed.issue === '58'
      ? 'Staatsrat des Freistaates Ostdeutschland'
      : 'Landtag des Freistaates Ostdeutschland';
    const abbr = norm.abbr;
    const meta = {
      id: slug,
      slug,
      title: norm.title,
      shortTitle,
      shortTitleSource: norm.shortTitle === shortTitle ? 'official' : 'editorial',
      ...(abbr ? { abbr } : {}),
      type: norm.type,
      enactingBody,
      responsibleMinistry,
      subjects: ISSUE_SUBJECTS[parsed.issue],
      keywords: [...new Set([abbr, shortTitle, ...shortTitle.split(/\s+/u).filter((word) => word.length >= 5)].filter(Boolean))].slice(0, 12),
      initialCitation: citation,
      predecessor: null,
      successor: null,
      summary,
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
    return { meta, history, versions: [version], source: parsed.fileName, issue: parsed.issue, startPage };
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
      shortTitleSource: 'official',
      type: 'gesetz',
      responsibleMinistry: 'Staatssekretariat für Rechtsstaatlichkeit und kulturelle Emanzipation',
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
      dateNote: 'Redaktionelle Lesefassung vom 21. Juli 2026. Artikel 121a gibt den bestätigten Wortlaut des Ersten Gesetzes zur Großen Staatsreform wieder.',
    },
    history: {
      initialVersionId: null,
      entries: [
        { date: '2024-10-15', type: 'initial', title: 'Ursprungsfassung verkündet; der vollständige Wortlaut ist nicht als versionierte Markdown-Quelle vorhanden.', citation, note: 'Keine historische Volltextfassung gespeichert.' },
        ['erstes-gesetz-zur-grossen-staatsreform', 'Erstes Gesetz zur Großen Staatsreform', '53'],
        ['zweites-gesetz-zur-grossen-staatsreform', 'Zweites Gesetz zur Großen Staatsreform', '54'],
        ['drittes-gesetz-zur-grossen-staatsreform', 'Drittes Gesetz zur Großen Staatsreform', '55'],
        ['viertes-gesetz-zur-grossen-staatsreform', 'Viertes Gesetz zur Großen Staatsreform', '56'],
      ].map((entry) => Array.isArray(entry) ? ({
        date: '2026-07-21',
        type: 'amendment',
        title: `${entry[1]} berücksichtigt.`,
        citation: `Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. ${entry[2]})`,
        affectingVersionId: versionId,
        relatedNorm: entry[0],
      }) : entry),
    },
    versions: [{
      versionId,
      validFrom: versionId,
      validTo: null,
      isCurrent: true,
      citation: 'Verfassung vom 15. Oktober 2024, zuletzt geändert durch Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 56)',
      changeNote: 'Redaktionelle konsolidierte Lesefassung unter Berücksichtigung der vier Gesetze zur Großen Staatsreform.',
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
      ...(record.startPage ? { startPage: record.startPage } : {}),
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
    keywords: [...new Set([
      ...(record.meta.keywords ?? []),
      ...(existing.meta.keywords ?? []).filter((keyword) => keyword !== existing.meta.abbr || keyword === record.meta.abbr),
    ])].filter((keyword) => !UNVERIFIED_GENERATED_ABBREVIATIONS.has(keyword)),
    summary: existing.meta.summary && !/^Regelt\s/u.test(existing.meta.summary)
      ? existing.meta.summary
      : record.meta.summary,
    predecessor: existing.meta.predecessor ?? record.meta.predecessor,
    successor: existing.meta.successor ?? record.meta.successor,
  };
  const generatedEntryKeys = new Set(record.history.entries.map((entry) => JSON.stringify([
    entry.date,
    entry.type,
    entry.relatedNorm ?? null,
  ])));
  const preservedEntries = (existing.history.entries ?? []).filter((entry) => !generatedEntryKeys.has(JSON.stringify([
    entry.date,
    entry.type,
    entry.relatedNorm ?? null,
  ])));
  return {
    ...record,
    meta: preservedMeta,
    history: {
      initialVersionId: record.history.initialVersionId === null
        ? null
        : existing.history.initialVersionId ?? record.history.initialVersionId,
      entries: [...preservedEntries, ...record.history.entries]
        .sort((left, right) => left.date.localeCompare(right.date)),
    },
  };
}

async function writeJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function jsonEquals(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

async function recordMatchesExisting(record, existing) {
  if (!existing) return false;
  const merged = mergeWithExisting(record, existing);
  if (!jsonEquals(merged.meta, existing.meta) || !jsonEquals(merged.history, existing.history)) return false;
  for (const version of merged.versions) {
    try {
      const currentVersion = JSON.parse(await readFile(join(existing.directory, 'versions', `${version.versionId}.json`), 'utf8'));
      if (!jsonEquals(version, currentVersion)) return false;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  return true;
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

function normalizedAuditTitle(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function flattenBody(blocks, output = []) {
  for (const block of blocks ?? []) {
    output.push(block);
    if (block.children) flattenBody(block.children, output);
  }
  return output;
}

async function loadExistingAuditRecords() {
  const result = new Map();
  for (const entry of await readdir(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const meta = JSON.parse(await readFile(join(outputDir, entry.name, 'meta.json'), 'utf8'));
      const history = JSON.parse(await readFile(join(outputDir, entry.name, 'history.json'), 'utf8'));
      const versionFiles = (await readdir(join(outputDir, entry.name, 'versions'))).filter((name) => name.endsWith('.json'));
      const versions = await Promise.all(versionFiles.map(async (name) => JSON.parse(await readFile(join(outputDir, entry.name, 'versions', name), 'utf8'))));
      result.set(entry.name, { meta, history, versions });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return result;
}

function compareGeneratedRecordToExisting(record, existing) {
  if (!existing) return { status: 'missing-content-record', issues: ['kein Datensatz unter dem stabilen Slug vorhanden'] };
  const version = existing.versions.find((entry) => entry.versionId === record.versions[0].versionId);
  if (!version) return { status: 'differs', issues: [`Fassung ${record.versions[0].versionId} fehlt`] };
  const issues = [];
  if (existing.meta.title !== record.meta.title) issues.push('Titel weicht von der Markdown-Quelle ab');
  if (existing.meta.documentDate !== record.meta.documentDate) issues.push('Dokumentdatum weicht ab');
  if (existing.meta.publicationDate !== record.meta.publicationDate) issues.push('Veröffentlichungsdatum weicht ab');
  if (JSON.stringify(version.body) !== JSON.stringify(record.versions[0].body)) issues.push('strukturierter Normtext weicht vom aktuellen Parsergebnis ab');
  const storedText = JSON.stringify(version.body);
  if (/data:image|;base64,|Inhaltsverzeichnis|LANDTAGSPRÄSIDENT|Dresden, den/iu.test(storedText)) issues.push('Vorblatt-, Bild-, Inhaltsverzeichnis- oder Signaturtext im Normkörper');
  return { status: issues.length ? 'differs' : 'matches', issues };
}

function compareParsedNormToExisting(norm, issue, existingRecords) {
  const normalizedTitle = normalizedAuditTitle(norm.title);
  const candidates = [...existingRecords.entries()].filter(([, existing]) =>
    normalizedAuditTitle(existing.meta.title) === normalizedTitle ||
    String(existing.meta.initialCitation ?? '').includes(`Nr. ${issue}`),
  );
  if (candidates.length === 0) return { status: 'unmatched', matchedSlugs: [], issues: ['kein eindeutiger Bestandsdatensatz gefunden'] };
  const sourceLabels = new Set(flattenBody(norm.body).map((block) => block.label).filter(Boolean));
  const ranked = candidates.map(([slug, existing]) => {
    const version = existing.versions.find((entry) => entry.isCurrent) ?? existing.versions.at(-1);
    const storedBlocks = flattenBody(version?.body ?? []);
    const storedLabels = new Set(storedBlocks.map((block) => block.label).filter(Boolean));
    const missingLabels = [...sourceLabels].filter((label) => !storedLabels.has(label));
    const contamination = /data:image|;base64,|Inhaltsverzeichnis|LANDTAGSPRÄSIDENT|Dresden, den/iu.test(JSON.stringify(version?.body ?? []));
    return { slug, missingLabels, contamination, score: missingLabels.length + (contamination ? 1000 : 0) };
  }).sort((left, right) => left.score - right.score || left.slug.localeCompare(right.slug));
  const best = ranked[0];
  const issues = [
    ...(best.missingLabels.length ? [`sichtbare Strukturmarker fehlen: ${best.missingLabels.slice(0, 12).join(', ')}`] : []),
    ...(best.contamination ? ['Vorblatt-, Bild-, Inhaltsverzeichnis- oder Signaturtext im Normkörper'] : []),
    ...(ranked.length > 1 && ranked[1].score === best.score ? ['Zuordnung zu mehreren Bestandsdatensätzen mehrdeutig'] : []),
  ];
  return { status: issues.length ? 'needs-review' : 'matches-structure', matchedSlugs: [best.slug], issues };
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

const existingAuditRecords = await loadExistingAuditRecords();
const report = { asOf, mode: shouldWrite ? 'incremental-write' : strictMode ? 'strict-audit' : 'audit-only', recognized: [], skipped: [], ambiguous: [], sourceAudit: [], changes: [] };
const records = [];
const publications = [];
for (const fileName of markdownFiles) {
  const sourcePath = join(sourceDir, fileName);
  const markdown = await readFile(sourcePath, 'utf8');
  const classification = classifyMarkdownSource(fileName, markdown);
  if (classification.kind === 'editorial') {
    report.skipped.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'skipped-editorial', issues: [classification.reason] });
    continue;
  }
  if (classification.kind === 'ambiguous') {
    report.ambiguous.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'needs-review', issues: [classification.reason] });
    continue;
  }
  if (classification.kind === 'consolidated') {
    if (fileName === 'Staatsverfassung.md') {
      const parsed = parseConsolidatedMarkdown(fileName, markdown, { title: 'Verfassung des Freistaates Ostdeutschland' });
      const parserContractIssues = validateConstitutionParserContract(parsed);
      report.recognized.push({ file: fileName, classification: classification.kind, norms: [{ title: parsed.title, type: 'gesetz' }] });
      const record = buildConstitutionRecord(parsed);
      records.push(record);
      report.sourceAudit.push({
        file: fileName,
        classification: classification.kind,
        parserContractIssues,
        norms: [{ slug: record.meta.slug, title: record.meta.title, ...compareGeneratedRecordToExisting(record, existingAuditRecords.get(record.meta.slug)) }],
      });
    } else {
      report.recognized.push({ file: fileName, classification: classification.kind, norms: [] });
      report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'recognized-unconfigured', issues: ['keine stabile Slug-Zuordnung hinterlegt; kein Schreibvorgang'] });
    }
    continue;
  }
  try {
    const parsed = parsePublicationMarkdown(fileName, markdown);
    const parserContractIssues = validatePublicationParserContract(parsed);
    const summaries = summarizeParsedSource(parsed);
    report.recognized.push({ file: fileName, classification: classification.kind, norms: summaries });
    if (ISSUE_CONFIG[parsed.issue]) {
      const issueRecords = buildRecords(parsed);
      issueRecords.forEach(validateRecord);
      records.push(...issueRecords);
      publications.push(publicationFrom(parsed, issueRecords));
      report.sourceAudit.push({
        file: fileName,
        classification: classification.kind,
        parserContractIssues,
        norms: issueRecords.map((record) => ({
          slug: record.meta.slug,
          title: record.meta.title,
          ...compareGeneratedRecordToExisting(record, existingAuditRecords.get(record.meta.slug)),
        })),
      });
    } else {
      report.sourceAudit.push({
        file: fileName,
        classification: classification.kind,
        norms: [parsed, ...parsed.introducedNorms].map((norm) => ({
          title: norm.title,
          ...compareParsedNormToExisting(norm, parsed.issue, existingAuditRecords),
        })),
        writeStatus: 'keine stabile Importkonfiguration; Altbestand bleibt unverändert',
      });
    }
  } catch (error) {
    report.ambiguous.push({ file: fileName, reason: error.message });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'parse-error', issues: [error.message] });
    if (selectedFiles.has(fileName)) throw error;
  }
}

if (!shouldWrite) {
  for (const record of records) {
    const existing = await readExistingRecord(record.meta.slug);
    const matches = await recordMatchesExisting(record, existing);
    report.changes.push({
      slug: record.meta.slug,
      action: !existing ? 'would-create' : matches ? 'unchanged' : 'would-update',
    });
  }
  for (const publication of publications) {
    const path = join(publicationDir, `${publication.slug}.json`);
    let existingPublication;
    try {
      existingPublication = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    report.changes.push({
      slug: publication.slug,
      action: !existingPublication
        ? 'would-create-publication'
        : jsonEquals(publication, existingPublication) ? 'unchanged-publication' : 'would-update-publication',
    });
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

const configuredSourceFiles = new Set([
  ...Object.keys(ISSUE_CONFIG).map((issue) => `OGVBl. 2026 Nr. ${issue}.md`),
  'Staatsverfassung.md',
]);
const strictFiles = selectedFiles.size > 0
  ? new Set([...selectedFiles].filter((fileName) => configuredSourceFiles.has(fileName)))
  : configuredSourceFiles;
const strictFailures = [];
if (strictMode) {
  for (const fileName of strictFiles) {
    if (!markdownFiles.includes(fileName)) strictFailures.push(`${fileName}: konfigurierte Quelle fehlt`);
  }
  for (const audit of report.sourceAudit.filter((entry) => strictFiles.has(entry.file))) {
    for (const issue of audit.parserContractIssues ?? []) strictFailures.push(`${audit.file}: Parservertrag: ${issue}`);
    if (audit.status === 'parse-error' || audit.status === 'needs-review') {
      for (const issue of audit.issues ?? ['Quelle konnte nicht eindeutig geprüft werden']) strictFailures.push(`${audit.file}: ${issue}`);
    }
    for (const norm of audit.norms ?? []) {
      if (norm.status !== 'matches') {
        strictFailures.push(`${audit.file}: ${norm.slug ?? norm.title ?? 'erwartete Norm'}: ${norm.issues?.join('; ') || norm.status || 'Abweichung'}`);
      }
    }
  }
  for (const change of report.changes) {
    if (/^would-(?:create|update)/u.test(change.action)) {
      strictFailures.push(`${change.slug}: ${change.action}`);
    }
  }
  report.strict = { passed: strictFailures.length === 0, failures: strictFailures };
}

if (quietMode) {
  console.log(`Normquellen-Audit: ${report.recognized.length} erkannt, ${report.skipped.length} übersprungen, ${report.ambiguous.length} mehrdeutig${strictMode ? `, ${strictFailures.length} strikte Abweichungen` : ''}.`);
} else {
  console.log(JSON.stringify(report, null, 2));
}
if (!shouldWrite) console.error('Prüflauf: Es wurden keine Dateien geschrieben. Gezielt schreiben mit --write --file <Datei>.');
if (strictFailures.length > 0) {
  for (const failure of strictFailures) console.error(`STRICT: ${failure}`);
  process.exitCode = 1;
}

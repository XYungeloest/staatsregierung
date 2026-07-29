#!/usr/bin/env node

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

import {
  classifyHtmlSource,
  parseConsolidatedHtml,
  parsePublicationHtml,
  summarizeHtmlAudit,
  summarizeParsedSource,
} from './lib/norm-html-parser.mjs';
import {
  classifyMarkdownSource,
  parseConsolidatedMarkdown,
  parsePublicationMarkdown,
  summarizeParsedSource as summarizeMarkdownSource,
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

function isHtmlSource(fileName) {
  return fileName.toLocaleLowerCase('de').endsWith('.html');
}

function normSourceReferences(fileName) {
  const html = isHtmlSource(fileName);
  return [{
    kind: html ? 'structured-html-transcription' : 'legacy-markdown-transcription',
    label: html ? 'Redaktionell geprüfte HTML-Fassung der Quelle' : 'Historische Markdown-Transkription (Altbestand)',
    availability: 'versioned',
    localSource: `Gesetze/${basename(fileName)}`,
  }];
}

function publicationSourceReference(fileName) {
  const html = isHtmlSource(fileName);
  return {
    kind: html ? 'structured-html-transcription' : 'legacy-markdown-transcription',
    label: html ? 'Redaktionell geprüfte HTML-Fassung der Ausgabe' : 'Historische Markdown-Transkription der Ausgabe (Altbestand)',
    availability: 'versioned',
    localSource: `Gesetze/${basename(fileName)}`,
  };
}

function publicationIdentityKey(publication, year, issue) {
  return `${publication}|${year}|${String(issue).replace(/^0+(?=\d)/u, '')}`;
}

function publicationIdentityFromLegacyFileName(fileName) {
  const match = fileName.match(/^(OABl|OGVBl|OVertrBl|StAnzO)\.?\s*(\d{4})\s*Nr\.?\s*(\d+)/iu);
  if (!match) return null;
  const publication = {
    oabl: 'OABl.', ogvbl: 'OGVBl.', overtrbl: 'OVertrBl.', stanzo: 'StAnzO.',
  }[match[1].toLocaleLowerCase('de')];
  return publicationIdentityKey(publication, Number(match[2]), match[3]);
}

function legacyTitleScore(left, right) {
  const normalizedLeft = normalizedAuditTitle(left);
  const normalizedRight = normalizedAuditTitle(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 100;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 80;
  const leftTokens = new Set(normalizedLeft.split(' '));
  const rightTokens = new Set(normalizedRight.split(' '));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? Math.round((intersection / union) * 60) : 0;
}

function relatedNormSlugs(meta) {
  return [meta?.enactedNorm, ...(meta?.enactedNorms ?? [])].filter(Boolean);
}

function legacyEntryCitation(previous, meta, publication, documentDate) {
  if (previous?.citation && /\bvom\s+\d{1,2}\.\s+[A-ZÄÖÜa-zäöüß]+\s+\d{4}/u.test(previous.citation)) return previous.citation;
  const labels = {
    gesetz: 'Gesetz',
    verordnung: 'Verordnung',
    verwaltungsvorschrift: 'Verwaltungsvorschrift',
    foerderrichtlinie: 'Förderrichtlinie',
    allgemeinverfuegung: 'Allgemeinverfügung',
    bekanntmachung: 'Bekanntmachung',
    staatsvertrag: 'Staatsvertrag',
    zustimmungsgesetz: 'Gesetz',
    aenderungsvorschrift: 'Gesetz',
  };
  const page = previous?.startPage ?? previous?.pages?.match(/\d+/u)?.[0];
  return `${labels[meta.type] ?? 'Veröffentlichung'} vom ${formatGermanDate(documentDate)} (${publication.publication} ${publication.year} Nr. ${publication.issue}${page ? ` S. ${page}` : ''})`;
}

function resolveLegacySourceRecords(parsed, existingPublication, existingRecords) {
  if (!existingPublication) {
    return { records: [], publication: null, issues: ['kein vorhandener Verkündungsdatensatz mit identischer interner Publikation, Jahr und Ausgabe'] };
  }
  if (existingPublication.date !== parsed.publicationDate) {
    return {
      records: [],
      publication: null,
      issues: [`internes Ausgabedatum ${parsed.publicationDate} widerspricht dem Verkündungsdatensatz ${existingPublication.date}`],
    };
  }

  const parsedNorms = [parsed, ...parsed.introducedNorms];
  const directSlugs = (existingPublication.entries ?? []).map((entry) => entry.normSlug).filter(Boolean);
  const candidateSlugs = [];
  const queue = [...directSlugs];
  while (queue.length > 0) {
    const slug = queue.shift();
    if (!slug || candidateSlugs.includes(slug)) continue;
    candidateSlugs.push(slug);
    const existing = existingRecords.get(slug);
    if (existing) queue.push(...relatedNormSlugs(existing.meta));
  }
  const candidates = candidateSlugs.flatMap((slug) => {
    const existing = existingRecords.get(slug);
    return existing ? [{ slug, existing }] : [];
  });
  const relationOuter = candidates.filter(({ slug, existing }) => directSlugs.includes(slug) && relatedNormSlugs(existing.meta).length > 0);
  const used = new Set();
  const mappings = [];
  const issues = [];

  for (let index = 0; index < parsedNorms.length; index += 1) {
    const norm = parsedNorms[index];
    let available = candidates.filter(({ slug }) => !used.has(slug));
    if (index === 0 && relationOuter.length === 1) available = [relationOuter[0], ...available.filter(({ slug }) => slug !== relationOuter[0].slug)];
    const ranked = available.map((candidate) => ({
      ...candidate,
      score: legacyTitleScore(norm.title, candidate.existing.meta.title) +
        (index === 0 && relationOuter.some(({ slug }) => slug === candidate.slug) ? 15 : 0),
    })).sort((left, right) => right.score - left.score || candidateSlugs.indexOf(left.slug) - candidateSlugs.indexOf(right.slug));
    const best = ranked[0];
    if (!best || best.score < 35 || (ranked[1] && ranked[1].score === best.score)) {
      issues.push(`${norm.title}: keine eindeutige stabile Slug-Zuordnung (${ranked.slice(0, 3).map((entry) => `${entry.slug}: ${entry.score}`).join(', ') || 'keine Kandidaten'})`);
      continue;
    }
    used.add(best.slug);
    mappings.push({ norm, slug: best.slug, existing: best.existing });
  }
  if (mappings.length !== parsedNorms.length) return { records: [], publication: null, issues };

  const records = mappings.map(({ norm, slug, existing }) => {
    const publicationEntry = (existingPublication.entries ?? []).find((entry) => entry.normSlug === slug);
    const currentVersion = existing.versions.find((entry) => entry.versionId === publicationEntry?.versionId) ??
      existing.versions.find((entry) => entry.isCurrent) ?? existing.versions.at(-1);
    if (!currentVersion) throw new Error(`${parsed.fileName}: ${slug} besitzt keine aktualisierbare Fassung`);
    return {
      source: parsed.fileName,
      startPage: publicationEntry?.startPage,
      meta: {
        ...existing.meta,
        sourceReferences: [
          ...(existing.meta.sourceReferences ?? []).filter((reference) =>
            !/\.(?:md|html)$/iu.test(String(reference.localSource ?? ''))
          ),
          ...normSourceReferences(parsed.fileName),
        ].filter((reference, index, references) =>
          references.findIndex((candidate) => candidate.localSource === reference.localSource) === index
        ),
      },
      history: existing.history,
      versions: [{ ...currentVersion, body: norm.body }],
    };
  });
  const mappedEntries = mappings.map(({ norm, slug, existing }, index) => {
    const previous = (existingPublication.entries ?? []).find((entry) => entry.normSlug === slug);
    const version = records[index].versions[0];
    const documentDate = previous?.documentDate ?? existing.meta.documentDate ?? norm.documentDate ?? parsed.documentDate;
    return {
      ...(previous ?? {}),
      id: previous?.id ?? slug,
      title: existing.meta.title,
      type: previous?.type ?? (existing.meta.type === 'verordnung' ? 'verordnung' : 'gesetz'),
      citation: legacyEntryCitation(previous, existing.meta, existingPublication, documentDate),
      documentDate,
      normSlug: slug,
      versionId: version.versionId,
    };
  });
  const mappedSlugs = new Set(mappedEntries.map((entry) => entry.normSlug));
  const publication = {
    ...existingPublication,
    ...(existingPublication.sourceFiles ? { sourceFiles: [`Gesetze/${basename(parsed.fileName)}`] } : {}),
    sourceReferences: [
      ...(existingPublication.sourceReferences ?? []).filter((reference) =>
        !['transcription', 'structured-html-transcription', 'legacy-markdown-transcription'].includes(reference.kind) &&
        !/\.(?:md|html)$/iu.test(String(reference.localSource ?? ''))
      ),
      publicationSourceReference(parsed.fileName),
    ].filter((reference, index, references) =>
      references.findIndex((candidate) =>
        candidate.kind === reference.kind && candidate.localSource === reference.localSource && candidate.url === reference.url
      ) === index
    ),
    entries: [...mappedEntries, ...(existingPublication.entries ?? []).filter((entry) => entry.normSlug && !mappedSlugs.has(entry.normSlug))],
  };
  return { records, publication, issues };
}

function resolveLegacyConsolidatedRecord(parsed, existingRecords) {
  const ranked = [...existingRecords.entries()].map(([slug, existing]) => ({
    slug,
    existing,
    score: legacyTitleScore(parsed.title, existing.meta.title),
  })).filter((entry) => entry.score >= 35)
    .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug));
  const best = ranked[0];
  if (!best || (ranked[1] && ranked[1].score === best.score)) {
    return { record: null, issues: [`keine eindeutige stabile Slug-Zuordnung (${ranked.slice(0, 3).map((entry) => `${entry.slug}: ${entry.score}`).join(', ') || 'keine Kandidaten'})`] };
  }
  const currentVersion = best.existing.versions.find((entry) => entry.isCurrent) ?? best.existing.versions.at(-1);
  if (!currentVersion) return { record: null, issues: [`${best.slug} besitzt keine aktualisierbare Fassung`] };
  return {
    record: {
      source: parsed.fileName,
      meta: {
        ...best.existing.meta,
        sourceReferences: [
          ...(best.existing.meta.sourceReferences ?? []).filter((reference) => !/\.(?:md|html)$/iu.test(String(reference.localSource ?? ''))),
          ...normSourceReferences(parsed.fileName),
        ],
      },
      history: best.existing.history,
      versions: [{ ...currentVersion, body: parsed.body }],
    },
    issues: [],
  };
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
      sourceReferences: normSourceReferences(parsed.fileName),
      ...(effectiveDate ? { effectiveDate } : {}),
      ...(index === 0 && enactedNorms.length === 1 ? { enactedNorm: enactedNorms[0] } : {}),
      ...(index === 0 && enactedNorms.length > 1 ? { enactedNorms } : {}),
      ...(index > 0 ? { enactingNorm: outerSlug } : {}),
      ...(parsed.issue === '46' && index === 1
        ? { dateNote: 'Das Gesetz gilt seit 21. Juli 2026; die wesentlichen Gebietsänderungen sind seit 1. August 2026 wirksam.' }
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
      sourceReferences: normSourceReferences(parsed.fileName),
      dateNote: 'Redaktionelle Lesefassung vom 21. Juli 2026.',
    },
    history: {
      initialVersionId: null,
      entries: [
        { date: '2024-10-15', type: 'initial', title: 'Ursprungsfassung verkündet; der vollständige Wortlaut ist nicht als versionierte HTML-Quelle vorhanden.', citation, note: 'Keine historische Volltextfassung gespeichert.' },
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
    sourceReferences: [publicationSourceReference(parsed.fileName)],
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
  if (hasNormContamination(text)) {
    throw new Error(`${record.source}: ${record.meta.slug} enthält Kopf-, Bild- oder Signaturdaten`);
  }
}

function hasNormContamination(text) {
  return /data:image|;base64,|Inhaltsverzeichnis|\bDresden,\s+den\s+\d/iu.test(text) ||
    /D\s+e\s+r\s+L\s+A\s+N\s+D\s+T\s+A\s+G\s+S\s+P\s+R/u.test(text);
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
    affectedNorms: existing.meta.affectedNorms ?? record.meta.affectedNorms,
    affectedByNorms: existing.meta.affectedByNorms ?? record.meta.affectedByNorms,
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

function summarizeLegacyMarkdownAudit(parsed) {
  const flat = flattenBody(parsed.body);
  return {
    outerStructure: (parsed.body ?? [])
      .filter((block) => ['part', 'chapter', 'section', 'subsection', 'article', 'paragraph', 'annex'].includes(block.type))
      .map((block) => block.label)
      .filter(Boolean),
    articleCount: flat.filter((block) => block.type === 'article').length,
    paragraphCount: flat.filter((block) => block.type === 'paragraph').length,
    listCount: flat.filter((block) => block.type === 'item' || block.type === 'subitem').length,
    tableCount: flat.filter((block) => block.type === 'table').length,
  };
}

function legacyMarkdownStructureIssues(parsed) {
  const flat = flattenBody(parsed.body);
  const denseNumberingCell = flat.find((block) =>
    ['tableCell', 'tableHeaderCell'].includes(block.type) &&
    (String(block.text ?? '').match(/\b\d+(?:\.\d+){1,}\b/gu) ?? []).length >= 10
  );
  return denseNumberingCell
    ? ['Nummerierung und Normtext sind in einer Layouttabelle getrennt; die Eltern-Kind-Zuordnung ist aus der Markdown-Transkription nicht zuverlässig rekonstruierbar']
    : [];
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

async function loadExistingPublications() {
  const result = new Map();
  for (const fileName of (await readdir(publicationDir)).filter((name) => name.endsWith('.json'))) {
    const publication = JSON.parse(await readFile(join(publicationDir, fileName), 'utf8'));
    const key = publicationIdentityKey(publication.publication, publication.year, publication.issue);
    const entries = result.get(key) ?? [];
    entries.push({ publication, fileName });
    result.set(key, entries);
  }
  return result;
}

function compareGeneratedRecordToExisting(record, existing) {
  if (!existing) return { status: 'missing-content-record', issues: ['kein Datensatz unter dem stabilen Slug vorhanden'] };
  const version = existing.versions.find((entry) => entry.versionId === record.versions[0].versionId);
  if (!version) return { status: 'differs', issues: [`Fassung ${record.versions[0].versionId} fehlt`] };
  const issues = [];
  if (existing.meta.title !== record.meta.title) issues.push('Titel weicht von der HTML-Quelle ab');
  // OGVBl. 2026 Nr. 46 enthält eine vollständige Ablösung der bereits 2025
  // eingeführten Bezirksordnung. Dokument- und Veröffentlichungsdatum des
  // Stammnormdatensatzes bleiben daher auf der Ursprungsfassung; die Quelle
  // wird gegen die unveränderliche Ersatzfassung vom 1. August 2026 geprüft.
  const replacementOfExistingStem =
    record.meta.slug === 'ostdeutsche-bezirksordnung' &&
    record.versions[0].versionId === '2026-08-01';
  if (!replacementOfExistingStem && existing.meta.documentDate !== record.meta.documentDate) issues.push('Dokumentdatum weicht ab');
  if (!replacementOfExistingStem && existing.meta.publicationDate !== record.meta.publicationDate) issues.push('Veröffentlichungsdatum weicht ab');
  let storedBodyForSourceComparison = version.body;
  if (replacementOfExistingStem) {
    try {
      storedBodyForSourceComparison = districtReplacementBeforeSportAmendment(version.body);
    } catch (error) {
      issues.push(`kombinierte Bezirksfassung ist nicht nachvollziehbar: ${error.message}`);
    }
  }
  if (JSON.stringify(storedBodyForSourceComparison) !== JSON.stringify(record.versions[0].body)) {
    issues.push('strukturierter Normtext weicht vom aktuellen Parsergebnis ab');
  }
  const storedText = JSON.stringify(version.body);
  if (hasNormContamination(storedText)) issues.push('Vorblatt-, Bild-, Inhaltsverzeichnis- oder Signaturtext im Normkörper');
  return { status: issues.length ? 'differs' : 'matches', issues };
}

function districtReplacementBeforeSportAmendment(body) {
  const sourceBody = JSON.parse(JSON.stringify(body));
  const paragraph13Index = sourceBody.findIndex((block) => block.label === '§ 13');
  const paragraph13aIndex = sourceBody.findIndex((block) => block.label === '§ 13a');
  if (paragraph13Index < 0 || paragraph13aIndex !== paragraph13Index + 1) {
    throw new Error('§ 13 und der unmittelbar folgende § 13a fehlen');
  }
  const paragraph13 = sourceBody[paragraph13Index];
  const items = paragraph13.children.filter((block) => block.type === 'item');
  const sportItem = items.find((block) =>
    block.label === '10.' &&
    block.text === 'bezirkliche Sportentwicklung und Sportkoordination nach Maßgabe des Ostdeutschen Sportfördergesetzes,'
  );
  const renumberedItem = items.find((block) => block.label === '11.');
  if (!sportItem || !renumberedItem) {
    throw new Error('Sportnummer 10 oder die nach Nummer 11 verschobene Schlussnummer fehlt');
  }
  paragraph13.children.splice(paragraph13.children.indexOf(sportItem), 1);
  renumberedItem.label = '10.';
  sourceBody.splice(paragraph13aIndex, 1);
  return sourceBody;
}

function preserveExistingHistoryForAudit(record, existing) {
  if (!existing) return record;
  if (
    record.meta.slug !== 'staatsverfassung-des-freistaates-ostdeutschland' &&
    record.meta.slug !== 'ostdeutsche-bezirksordnung' &&
    record.meta.slug !== 'kreis-und-bezirksneuordnungsgesetz'
  ) {
    return record;
  }
  return {
    source: record.source,
    issue: record.issue,
    startPage: record.startPage,
    meta: existing.meta,
    history: existing.history,
    versions: existing.versions,
  };
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
    const contamination = hasNormContamination(JSON.stringify(version?.body ?? []));
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
const allHtmlFiles = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase('de').endsWith('.html'))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, 'de'));
const allMarkdownFiles = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase('de').endsWith('.md'))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, 'de'));
const htmlFiles = allHtmlFiles.filter((name) => selectedFiles.size === 0 || selectedFiles.has(name));
const markdownFiles = allMarkdownFiles.filter((name) => selectedFiles.size === 0 || selectedFiles.has(name));

if (selectedFiles.size > 0) {
  const unsupportedSelection = [...selectedFiles].filter((name) => !/\.(?:html|md)$/iu.test(name));
  if (unsupportedSelection.length > 0) throw new Error(`Nicht unterstütztes Quellformat: ${unsupportedSelection.join(', ')}`);
  const availableFiles = new Set([...allHtmlFiles, ...allMarkdownFiles]);
  const missing = [...selectedFiles].filter((name) => !availableFiles.has(name));
  if (missing.length) throw new Error(`Ausgewählte Normquelle fehlt: ${missing.join(', ')}`);
}

const htmlPublicationIdentities = new Set();
for (const fileName of allHtmlFiles) {
  try {
    const html = await readFile(join(sourceDir, fileName), 'utf8');
    if (classifyHtmlSource(fileName, html).kind !== 'publication') continue;
    const parsed = parsePublicationHtml(fileName, html);
    htmlPublicationIdentities.add(publicationIdentityKey(parsed.publication, parsed.year, parsed.issue));
  } catch {
    // Eine fehlerhafte HTML-Datei darf keinen stillen Rückfall auf Markdown auslösen.
  }
}
const htmlStems = new Set(allHtmlFiles.map((name) => name.replace(/\.html$/iu, '').replace(/[ .]/gu, '').toLocaleLowerCase('de')));
const consolidationManagedSources = new Map([
  [
    'Ostdeutsches Feiertagsgesetz.md',
    'durch vollständige, quellengesicherte Fassungsfolge aus REVOSax-Snapshot und Änderungsvorschriften ersetzt',
  ],
  [
    'Sächsische Landkreisordnung.md',
    'durch vollständige, quellengesicherte Fassungsfolge aus REVOSax-Snapshot und redaktionell geprüften Änderungsvorschriften ersetzt',
  ],
]);

const existingAuditRecords = await loadExistingAuditRecords();
const existingPublications = await loadExistingPublications();
const report = {
  asOf,
  mode: shouldWrite ? 'incremental-write' : strictMode ? 'strict-audit' : 'audit-only',
  sourceFormat: 'structured-html-with-explicit-legacy-markdown',
  legacyMarkdownIgnored: [],
  recognized: [], skipped: [], unsupported: [], ambiguous: [], sourceAudit: [], changes: [],
};
const records = [];
const publications = [];
const recognizedConfiguredSources = new Map();
for (const fileName of htmlFiles) {
  const sourcePath = join(sourceDir, fileName);
  const html = await readFile(sourcePath, 'utf8');
  const classification = classifyHtmlSource(fileName, html);
  if (classification.kind === 'editorial') {
    report.skipped.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'skipped-editorial', issues: [classification.reason] });
    continue;
  }
  if (classification.kind === 'unsupported') {
    report.unsupported.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'unsupported', issues: [classification.reason] });
    continue;
  }
  if (classification.kind === 'ambiguous') {
    report.ambiguous.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'needs-review', issues: [classification.reason] });
    continue;
  }
  if (classification.kind === 'consolidated') {
    if (fileName === 'Staatsverfassung.html') {
      const parsed = parseConsolidatedHtml(fileName, html, { title: 'Verfassung des Freistaates Ostdeutschland' });
      const parserContractIssues = validateConstitutionParserContract(parsed);
      report.recognized.push({ file: fileName, classification: classification.kind, norms: [{ title: parsed.title, type: 'gesetz' }] });
      const record = buildConstitutionRecord(parsed);
      records.push(preserveExistingHistoryForAudit(record, existingAuditRecords.get(record.meta.slug)));
      recognizedConfiguredSources.set('constitution', fileName);
      report.sourceAudit.push({
        file: fileName,
        classification: classification.kind,
        detectedIssue: null,
        detectedNorms: [parsed.title],
        documentDate: record.meta.documentDate,
        publicationDate: record.meta.publicationDate,
        startPage: null,
        outerStructure: summarizeParsedSource(parsed)[0].outerArticles,
        articleCount: summarizeParsedSource(parsed)[0].outerArticles.length,
        paragraphCount: summarizeParsedSource(parsed)[0].outerParagraphs.length,
        listCount: summarizeParsedSource(parsed)[0].listCount,
        tableCount: summarizeParsedSource(parsed)[0].tableCount,
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
    const parsed = parsePublicationHtml(fileName, html);
    const parserContractIssues = validatePublicationParserContract(parsed);
    const summaries = summarizeParsedSource(parsed);
    const auditSummary = summarizeHtmlAudit(parsed);
    report.recognized.push({ file: fileName, classification: classification.kind, norms: summaries });
    if (ISSUE_CONFIG[parsed.issue]) {
      if (recognizedConfiguredSources.has(parsed.issue)) {
        throw new Error(`${fileName}: Ausgabe ${parsed.issue} wurde bereits aus ${recognizedConfiguredSources.get(parsed.issue)} erkannt; Quelle ist mehrdeutig.`);
      }
      recognizedConfiguredSources.set(parsed.issue, fileName);
      const issueRecords = buildRecords(parsed);
      issueRecords.forEach(validateRecord);
      records.push(...issueRecords.map((record) =>
        preserveExistingHistoryForAudit(record, existingAuditRecords.get(record.meta.slug))));
      publications.push(publicationFrom(parsed, issueRecords));
      report.sourceAudit.push({
        file: fileName,
        classification: classification.kind,
        detectedIssue: parsed.issue,
        detectedNorms: summaries.map((summary) => summary.title),
        documentDate: parsed.documentDate,
        publicationDate: parsed.publicationDate,
        startPage: parsed.startPage ?? null,
        outerStructure: auditSummary.outerStructure,
        articleCount: auditSummary.articleCount,
        paragraphCount: auditSummary.paragraphCount,
        listCount: auditSummary.listCount,
        tableCount: auditSummary.tableCount,
        parserContractIssues,
        norms: issueRecords.map((record) => ({
          slug: record.meta.slug,
          title: record.meta.title,
          ...compareGeneratedRecordToExisting(record, existingAuditRecords.get(record.meta.slug)),
        })),
      });
    } else {
      const publicationCandidates = existingPublications.get(publicationIdentityKey(parsed.publication, parsed.year, parsed.issue)) ?? [];
      const exactPublicationCandidates = publicationCandidates.filter(({ publication }) => publication.date === parsed.publicationDate);
      const existingPublication = exactPublicationCandidates.length === 1 ? exactPublicationCandidates[0].publication : null;
      const resolved = resolveLegacySourceRecords(parsed, existingPublication, existingAuditRecords);
      if (resolved.records.length > 0 && resolved.publication) {
        resolved.records.forEach(validateRecord);
        records.push(...resolved.records);
        publications.push(resolved.publication);
      }
      report.sourceAudit.push({
        file: fileName,
        classification: classification.kind,
        detectedIssue: parsed.issue,
        detectedNorms: summaries.map((summary) => summary.title),
        documentDate: parsed.documentDate,
        publicationDate: parsed.publicationDate,
        startPage: parsed.startPage ?? null,
        outerStructure: auditSummary.outerStructure,
        articleCount: auditSummary.articleCount,
        paragraphCount: auditSummary.paragraphCount,
        listCount: auditSummary.listCount,
        tableCount: auditSummary.tableCount,
        norms: resolved.records.length > 0
          ? resolved.records.map((record) => ({
              slug: record.meta.slug,
              title: record.meta.title,
              ...compareGeneratedRecordToExisting(record, existingAuditRecords.get(record.meta.slug)),
            }))
          : [parsed, ...parsed.introducedNorms].map((norm) => ({
              title: norm.title,
              ...compareParsedNormToExisting(norm, parsed.issue, existingAuditRecords),
            })),
        issues: [
          ...(exactPublicationCandidates.length > 1 ? ['mehrere Verkündungsdatensätze stimmen in Publikation, Ausgabe und Datum überein'] : []),
          ...(publicationCandidates.length > 0 && exactPublicationCandidates.length === 0
            ? [`internes Ausgabedatum ${parsed.publicationDate} stimmt mit keinem vorhandenen Verkündungsdatensatz überein`]
            : []),
          ...resolved.issues,
        ],
        writeStatus: resolved.records.length > 0
          ? 'stabile Bestandszuordnung; gezielte Aktualisierung mit --write --update-existing möglich'
          : 'keine eindeutige Bestandszuordnung; Altbestand bleibt unverändert',
      });
    }
  } catch (error) {
    report.ambiguous.push({ file: fileName, reason: error.message });
    report.sourceAudit.push({ file: fileName, classification: classification.kind, status: 'parse-error', issues: [error.message] });
    if (selectedFiles.has(fileName)) throw error;
  }
}

for (const fileName of markdownFiles) {
  if (consolidationManagedSources.has(fileName)) {
    const reason = consolidationManagedSources.get(fileName);
    report.legacyMarkdownIgnored.push({ file: fileName, reason });
    report.sourceAudit.push({
      file: fileName,
      classification: 'legacy-markdown',
      status: 'superseded-by-consolidation',
      issues: [reason],
    });
    if (selectedFiles.has(fileName)) throw new Error(`${fileName}: ${reason}`);
    continue;
  }
  const stem = fileName.replace(/\.md$/iu, '').replace(/[ .]/gu, '').toLocaleLowerCase('de');
  const filePublicationIdentity = publicationIdentityFromLegacyFileName(fileName);
  if (htmlStems.has(stem) || (filePublicationIdentity && htmlPublicationIdentities.has(filePublicationIdentity))) {
    const reason = filePublicationIdentity
      ? 'HTML-Quelle derselben Ausgabe vorhanden; Markdown-Altbestand wird nicht geöffnet'
      : 'gleichnamige HTML-Quelle vorhanden; Markdown-Altbestand wird nicht geöffnet';
    report.legacyMarkdownIgnored.push({ file: fileName, reason });
    report.sourceAudit.push({ file: fileName, classification: 'legacy-markdown', status: 'superseded-by-html', issues: [reason] });
    if (selectedFiles.has(fileName)) throw new Error(`${fileName}: ${reason}`);
    continue;
  }
  const sourcePath = join(sourceDir, fileName);
  const markdown = await readFile(sourcePath, 'utf8');
  const classification = classifyMarkdownSource(fileName, markdown);
  if (classification.kind === 'editorial') {
    report.skipped.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: 'legacy-markdown-editorial', status: 'skipped-editorial', issues: [classification.reason] });
    continue;
  }
  if (classification.kind === 'ambiguous') {
    report.ambiguous.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({ file: fileName, classification: 'legacy-markdown-ambiguous', status: 'needs-review', issues: [classification.reason] });
    if (selectedFiles.has(fileName)) throw new Error(`${fileName}: ${classification.reason}`);
    continue;
  }

  try {
    if (classification.kind === 'consolidated') {
      if (htmlStems.has(stem)) {
        const reason = 'gleichnamige HTML-Quelle vorhanden; Markdown-Altbestand wird nicht geöffnet';
        report.legacyMarkdownIgnored.push({ file: fileName, reason });
        report.sourceAudit.push({ file: fileName, classification: 'legacy-markdown', status: 'superseded-by-html', issues: [reason] });
        if (selectedFiles.has(fileName)) throw new Error(`${fileName}: ${reason}`);
        continue;
      }
      const parsed = parseConsolidatedMarkdown(fileName, markdown);
      const resolved = resolveLegacyConsolidatedRecord(parsed, existingAuditRecords);
      if (resolved.record) {
        validateRecord(resolved.record);
        records.push(resolved.record);
      }
      const auditSummary = summarizeLegacyMarkdownAudit(parsed);
      report.recognized.push({ file: fileName, classification: 'legacy-markdown-consolidated', norms: [{ title: parsed.title, type: 'gesetz' }] });
      report.sourceAudit.push({
        file: fileName,
        classification: 'legacy-markdown-consolidated',
        detectedIssue: null,
        detectedNorms: [parsed.title],
        documentDate: null,
        publicationDate: null,
        startPage: null,
        ...auditSummary,
        norms: resolved.record
          ? [{ slug: resolved.record.meta.slug, title: resolved.record.meta.title, ...compareGeneratedRecordToExisting(resolved.record, existingAuditRecords.get(resolved.record.meta.slug)) }]
          : [{ title: parsed.title, status: 'unmatched', issues: resolved.issues }],
        issues: resolved.issues,
        writeStatus: resolved.record
          ? 'stabile Bestandszuordnung; gezielte Legacy-Aktualisierung mit --write --update-existing möglich'
          : 'keine eindeutige Bestandszuordnung; Altbestand bleibt unverändert',
      });
      continue;
    }

    const parsed = parsePublicationMarkdown(fileName, markdown);
    const identity = publicationIdentityKey(parsed.publication, parsed.year, parsed.issue);
    if (htmlPublicationIdentities.has(identity)) {
      const reason = 'HTML-Quelle derselben intern erkannten Ausgabe vorhanden; Markdown-Altbestand wird nicht importiert';
      report.legacyMarkdownIgnored.push({ file: fileName, reason });
      report.sourceAudit.push({
        file: fileName,
        classification: 'legacy-markdown-publication',
        detectedIssue: parsed.issue,
        detectedNorms: [parsed.title, ...(parsed.introducedNorms ?? []).map((norm) => norm.title)],
        documentDate: parsed.documentDate,
        publicationDate: parsed.publicationDate,
        status: 'superseded-by-html',
        issues: [reason],
      });
      if (selectedFiles.has(fileName)) throw new Error(`${fileName}: ${reason}`);
      continue;
    }
    const publicationCandidates = existingPublications.get(identity) ?? [];
    const exactPublicationCandidates = publicationCandidates.filter(({ publication }) => publication.date === parsed.publicationDate);
    const existingPublication = exactPublicationCandidates.length === 1 ? exactPublicationCandidates[0].publication : null;
    const structuralIssues = legacyMarkdownStructureIssues(parsed);
    if (selectedFiles.has(fileName) && structuralIssues.length > 0) {
      throw new Error(`${fileName}: ${structuralIssues.join('; ')}`);
    }
    const resolved = structuralIssues.length === 0
      ? resolveLegacySourceRecords(parsed, existingPublication, existingAuditRecords)
      : { records: [], publication: null, issues: structuralIssues };
    if (resolved.records.length > 0 && resolved.publication) {
      resolved.records.forEach(validateRecord);
      records.push(...resolved.records);
      publications.push(resolved.publication);
    }
    const summaries = summarizeMarkdownSource(parsed);
    const auditSummary = summarizeLegacyMarkdownAudit(parsed);
    report.recognized.push({ file: fileName, classification: 'legacy-markdown-publication', norms: summaries });
    report.sourceAudit.push({
      file: fileName,
      classification: 'legacy-markdown-publication',
      detectedIssue: parsed.issue,
      detectedNorms: summaries.map((summary) => summary.title),
      documentDate: parsed.documentDate,
      publicationDate: parsed.publicationDate,
      startPage: parsed.startPage ?? null,
      ...auditSummary,
      norms: resolved.records.length > 0
        ? resolved.records.map((record) => ({
            slug: record.meta.slug,
            title: record.meta.title,
            ...compareGeneratedRecordToExisting(record, existingAuditRecords.get(record.meta.slug)),
          }))
        : [parsed, ...(parsed.introducedNorms ?? [])].map((norm) => ({
            title: norm.title,
            ...compareParsedNormToExisting(norm, parsed.issue, existingAuditRecords),
          })),
      issues: [
        ...(exactPublicationCandidates.length > 1 ? ['mehrere Verkündungsdatensätze stimmen in Publikation, Ausgabe und Datum überein'] : []),
        ...(publicationCandidates.length > 0 && exactPublicationCandidates.length === 0
          ? [`internes Ausgabedatum ${parsed.publicationDate} stimmt mit keinem vorhandenen Verkündungsdatensatz überein`]
          : []),
        ...resolved.issues,
      ],
      writeStatus: resolved.records.length > 0
        ? 'stabile Bestandszuordnung; gezielte Legacy-Aktualisierung mit --write --update-existing möglich'
        : 'keine eindeutige Bestandszuordnung; Altbestand bleibt unverändert',
    });
  } catch (error) {
    report.ambiguous.push({ file: fileName, reason: error.message });
    report.sourceAudit.push({ file: fileName, classification: `legacy-markdown-${classification.kind}`, status: 'parse-error', issues: [error.message] });
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
  ...Object.keys(ISSUE_CONFIG).map((issue) => `OGVBl. 2026 Nr. ${issue}.html`),
  'Staatsverfassung.html',
]);
const strictFiles = selectedFiles.size > 0
  ? new Set(selectedFiles)
  : configuredSourceFiles;
const strictFailures = [];
if (strictMode) {
  for (const fileName of strictFiles) {
    if (fileName === 'Staatsverfassung.html' && !htmlFiles.includes(fileName)) {
      strictFailures.push(`${fileName}: konfigurierte HTML-Quelle fehlt`);
      continue;
    }
    const configuredIssue = fileName.match(/^OGVBl\.\s*2026\s*Nr\.\s*(4[6-9]|5[0-8])\.html$/iu)?.[1];
    if (configuredIssue && !recognizedConfiguredSources.has(configuredIssue)) {
      strictFailures.push(`${fileName}: konfigurierte Ausgabe wurde in keiner HTML-Quelle anhand interner Metadaten erkannt`);
    } else if (selectedFiles.size > 0 && !htmlFiles.includes(fileName) && !markdownFiles.includes(fileName)) {
      strictFailures.push(`${fileName}: ausgewählte Normquelle fehlt`);
    }
  }
  for (const issue of Object.keys(ISSUE_CONFIG)) {
    if (selectedFiles.size === 0 && !recognizedConfiguredSources.has(issue)) strictFailures.push(`OGVBl. 2026 Nr. ${issue}: konfigurierte Norm wurde in keiner HTML-Quelle erkannt`);
  }
  if (selectedFiles.size === 0 && !recognizedConfiguredSources.has('constitution')) strictFailures.push('Staatsverfassung.html: konsolidierte Verfassung wurde nicht erkannt');
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
  console.log(`Normquellen-Audit: ${report.recognized.length} erkannt, ${report.skipped.length} redaktionell, ${report.unsupported.length} nicht unterstützt, ${report.ambiguous.length} mehrdeutig${strictMode ? `, ${strictFailures.length} strikte Abweichungen` : ''}.`);
} else {
  console.log(JSON.stringify(report, null, 2));
}
if (!shouldWrite) console.error('Prüflauf: Es wurden keine Dateien geschrieben. Gezielt schreiben mit --write --file <Datei>.');
if (strictFailures.length > 0) {
  for (const failure of strictFailures) console.error(`STRICT: ${failure}`);
  process.exitCode = 1;
}

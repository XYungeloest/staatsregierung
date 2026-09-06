#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { access, copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join, relative, resolve } from 'node:path';

import {
  classifyHtmlSource,
  hasSpacedLetters,
  parseConsolidatedHtml,
  parsePublicationHtml,
  summarizeHtmlAudit,
  summarizeParsedSource,
} from './lib/norm-html-parser.mjs';
import {
  citationLabelMatchesNormType,
  NORM_TYPE_CITATION_LABELS,
  publicationEntryTypeForNormType,
} from './lib/publication-entry-types.mjs';
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
import { applyCorrectionsToRecord, loadCorrectionBundles } from './lib/correction-engine.mjs';
import {
  abbreviationProblem,
  UNVERIFIED_GENERATED_ABBREVIATIONS as UNVERIFIED_ABBREVIATIONS,
} from './lib/norm-title-rules.mjs';
import {
  HISTORICAL_PUBLICATION_PAGE_RANGE_MAP,
  pageRangeForPublication,
  pdfPageCount,
  preserveVerifiedAt,
  publicationPdfFileName,
  publicationPdfPublicPath,
  publicationSourceReferences as buildPublicationSourceReferences,
  resolvePublicationPdf,
} from './lib/publication-pdf.mjs';

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
const editorialConfig = JSON.parse(await readFile(resolve(ROOT, 'packages/shared/src/config/editorial.json'), 'utf8'));
const asOf = valueAfter('--as-of') ?? editorialConfig.referenceDate;
const correctionBundles = await loadCorrectionBundles(ROOT);
const consolidationSources = JSON.parse(await readFile(resolve(ROOT, 'data/recht/consolidation-sources.json'), 'utf8'));
const consolidationManagedTargetSlugs = new Set(Object.keys(consolidationSources.targets ?? {}));
let availablePdfFileNames = [];

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
    { slug: 'ostdeutsche-bezirksordnung', shortTitle: 'Ostdeutsche Bezirksordnung', effectiveOverride: '2026-08-01', replacesExistingStem: true, responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft', summary: 'Bestimmt Rechtsstellung, Aufgaben, Organe, Verwaltung und Aufsicht der Bezirke.' },
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
    { slug: 'gesetz-zur-staerkung-der-psychologischen-psychotherapeutischen-und-psychiatrischen-versorgung', shortTitle: 'Gesetz zur Stärkung der psychologischen Versorgung', type: 'aenderungsvorschrift', affectedNorms: ['ostdeutsches-krankenhausgesetz'], responsibleMinistry: 'Staatssekretariat für Gesundheits- und Sozialwesen', summary: 'Ergänzt das Ostdeutsche Krankenhausgesetz um eine Vergütungsregelung für den psychotherapeutischen und psychiatrischen Dienst.' },
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
  '59': [{ slug: 'volksbefragungsverordnung-2026', shortTitle: 'Volksbefragungsverordnung 2026', responsibleMinistry: 'Staatsrat des Freistaates Ostdeutschland', summary: 'Ordnet für den 5. und 6. September 2026 eine freiwillige, rechtlich nicht bindende Volksbefragung mit fünf Fragen an und regelt Information, Durchführung, Ergebnisermittlung und politische Auswertung.' }],
};

// Sachgebiete der amtlichen Systematik (packages/shared/src/config/law-subjects.json)
// je Ausgabe des Gesetz- und Verordnungsblatts; das erste ist das Hauptsachgebiet.
const ISSUE_SUBJECTS = {
  '46': ['Kommunalrecht', 'Raumordnung, Landesplanung'],
  '47': ['Verkehr'],
  '48': ['Gewerbe- und Berufsrecht', 'Haushaltwesen, Rechnungshof'],
  '49': ['Umweltschutz, Abfallwirtschaft', 'Gewerbe- und Berufsrecht'],
  '50': ['Sicherheitsrecht und Polizeirecht'],
  '51': ['Allgemeines zum Sozialwesen'],
  '52': ['Sport'],
  '53': ['Verfassungsrecht'],
  '54': ['Verfassungsrecht', 'Haushaltwesen, Rechnungshof'],
  '55': ['Verfassungsrecht'],
  '56': ['Verfassungsrecht', 'Bildungswesen'],
  '57': ['Bildungswesen', 'Presse-, Rundfunk-, Filmwesen'],
  '58': ['Umweltschutz, Abfallwirtschaft'],
  '59': ['Verfassungsrecht'],
};

const SCHOOL_LAW_SUBJECTS = ['Bildungswesen'];
const NEW_PUBLICATION_CONFIG = {
  'OGVBl.|2026|68': [{
    slug: 'berichtigung-verschiedener-verkuendungen-2026',
    shortTitle: 'Berichtigung verschiedener Verkündungen',
    type: 'berichtigung',
    pageCount: 5,
    pdfFileName: 'OGVBl. 2026 Nr. 68.pdf',
    verifiedAt: '2026-08-27',
    enactingBody: 'Staatsrat des Freistaates Ostdeutschland',
    responsibleMinistry: 'Staatssekretariat für Rechtsstaatlichkeit und kulturelle Emanzipation',
    subjects: ['Kommunalrecht'],
    summary: 'Berichtigt acht frühere Verkündungen, ohne einen neuen materiellen Änderungszeitpunkt für die betroffenen Rechtsvorschriften zu begründen.',
    affectedNorms: [
      'dienstanordnung-momentane-terrorgefahr-2024',
      'organisationserlass-neueinteilung-fachbereiche-2024',
      'ostdeutsches-bezirkseinfuehrungsgesetz',
      'saechsische-landkreisordnung',
      'gesetz-zur-anderung-des-polizeigesetzes-zur-regelung-der-schmerzgriffe',
      'ostdeutsches-polizeivollzugsdienstgesetz',
      'erstes-gesetz-zur-grossen-staatsreform',
      'staatsverfassung-des-freistaates-ostdeutschland',
      'sportneuordnungsgesetz',
      'ostdeutsche-bezirksordnung',
      'verordnung-zur-aenderung-der-schulordnung-foerderschulen-2026',
      'schulordnung-foerderschulen',
      'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026',
      'schulordnung-berufsschule',
      'schulordnung-berufliche-gymnasien',
    ],
    dateNote: 'Am 27. August 2026 verkündet. Die Berichtigung stellt den richtigen Wortlaut früherer Verkündungen fest; sie erzeugt keinen eigenständigen materiellen Fassungswechsel zum Verkündungsdatum.',
  }],
  'OGVBl.|2026|60': [{
    slug: 'schulordnung-polytechnische-oberschulen', shortTitle: 'Schulordnung Polytechnische Oberschulen', abbr: 'SOPOS', type: 'verordnung', pageCount: 20,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Regelt Auftrag, Aufbau, Unterricht, Leistungsbewertung, Versetzung und Abschlüsse der Polytechnischen Oberschule in den Klassenstufen 1 bis 10.',
    effectiveOverride: '2026-09-01', relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems', 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026'],
    dateNote: 'Am 14. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die Ablösung bisheriger allgemeinbildender Schulordnungen wird ergänzend durch OGVBl. 2026 Nr. 67 geregelt.',
  }],
  'OGVBl.|2026|61': [{
    slug: 'schulordnung-erweiterte-oberschulen-und-abiturpruefung', shortTitle: 'Schulordnung Erweiterte Oberschulen und Abiturprüfung', abbr: 'SOEOSA', type: 'verordnung', pageCount: 23,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Regelt Aufnahme, Einführungs- und Qualifikationsphase sowie die Abiturprüfung an Erweiterten Oberschulen.',
    effectiveOverride: '2026-09-01', relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems', 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026'],
    dateNote: 'Am 14. August 2026 verkündet; Inkrafttreten am 1. September 2026. Übergang und Außerkrafttreten alter Gymnasial- und Abiturregelungen bestimmt ergänzend OGVBl. 2026 Nr. 67.',
  }],
  'OGVBl.|2026|62': [{
    slug: 'schulordnung-abendoberschulen', shortTitle: 'Schulordnung Abendoberschulen', abbr: 'SOAbO', type: 'verordnung', pageCount: 8,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Regelt Aufnahme, Ausbildung, Leistungsbewertung und Abschlussprüfungen an Abendoberschulen.',
    effectiveOverride: '2026-09-01', predecessor: 'Schulordnung Ober- und Abendoberschulen', relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems', 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026'],
    dateNote: 'Am 15. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die bisherige Schulordnung Ober- und Abendoberschulen tritt nach OGVBl. 2026 Nr. 67 mit Ablauf des 31. August 2026 außer Kraft.',
  }],
  'OGVBl.|2026|63': [{
    slug: 'abendgymnasien-und-kollegverordnung', shortTitle: 'Abendgymnasien- und Kollegverordnung', abbr: 'AGyKoVO', type: 'verordnung', pageCount: 8,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Regelt Ausbildung, Leistungsbewertung und Abiturprüfung an Abendgymnasien und Kollegs.',
    effectiveOverride: '2026-09-01', predecessor: 'Abendgymnasien- und Kollegverordnung vom 8. September 2008', relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung'],
    dateNote: 'Am 15. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die Abendgymnasien- und Kollegverordnung vom 8. September 2008 tritt mit Ablauf des 31. August 2026 außer Kraft.',
  }],
  'OGVBl.|2026|64': [{
    slug: 'verordnung-zur-aenderung-der-schulordnung-foerderschulen-2026', shortTitle: 'Änderungsverordnung Schulordnung Förderschulen 2026', type: 'aenderungsvorschrift', pageCount: 13,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Passt die Schulordnung Förderschulen an das neue Schulrecht, die Polytechnische und Erweiterte Oberschule sowie die neue Abschluss- und Prüfungsstruktur an.',
    effectiveOverride: '2026-09-01',
    dateNote: 'Am 15. August 2026 verkündet; Inkrafttreten am 1. September 2026. Eine konsolidierte Stammfassung kann erst nach Bereitstellung und Prüfung der übernommenen amtlichen Ausgangsfassung veröffentlicht werden.',
  }],
  'OGVBl.|2026|65': [{
    slug: 'sorbische-schulverordnung', shortTitle: 'Sorbische Schulverordnung', abbr: 'SorbSchulVO', type: 'verordnung', pageCount: 5,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Regelt sorbische Schulen, Sorbischunterricht, zweisprachige Angebote und Beteiligungsrechte im sorbischen Siedlungsgebiet.',
    effectiveOverride: '2026-09-01', predecessor: 'Verordnung über die Arbeit an sorbischen und anderen Schulen im deutsch-sorbischen Gebiet vom 22. Juni 1992', relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems'],
    dateNote: 'Am 15. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die Verordnung vom 22. Juni 1992 tritt mit Ablauf des 31. August 2026 außer Kraft.',
  }],
  'OGVBl.|2026|66': [{
    slug: 'ethik-und-religionsunterrichtverordnung', shortTitle: 'Ethik und Religionsunterrichtverordnung', abbr: 'ERWVO', type: 'verordnung', pageCount: 8,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Regelt Ethik als Pflichtfach sowie freiwilligen Religions- und Weltanschauungsunterricht, Anerkennung, Teilnahme, Aufsicht und Datenschutz.',
    effectiveOverride: '2026-09-01', relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems'],
    dateNote: 'Am 15. August 2026 verkündet; Inkrafttreten am 1. September 2026.',
  }],
  'OGVBl.|2026|67': [{
    slug: 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026', shortTitle: 'Bereinigungsverordnung Schulordnungsrecht 2026', type: 'aenderungsvorschrift', pageCount: 22,
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Bereinigt das allgemeinbildende Schulordnungsrecht, passt fortgeltende Schulverordnungen an und regelt Übergang, Außerkrafttreten alter Schulordnungen und den Rechtsstand der früheren Oberstufen- und Abiturprüfungsverordnung.',
    effectiveOverride: '2026-08-31', affectedNorms: [
      'verordnung-des-staatsministerium-fur-bildung-und-sportliche-193i80n',
      'oberstufenund-abiturprufungsverordnung',
      'saechsische-klassenbildungsverordnung',
      'schulnetzplanungsverordnung',
      'freie-trager-schulverordnung',
      'pruefungsverordnung-waldorfschulen',
      'schulordnung-grundschulen',
      'schulordnung-ober-und-abendoberschulen',
      'schulordnung-gemeinschaftsschulen',
      'schulordnung-gymnasien-abiturpruefung',
    ],
    relatedNorms: ['gesetz-zur-neuordnung-des-ostdeutschen-schulsystems', 'schulordnung-polytechnische-oberschulen', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung', 'schulordnung-abendoberschulen'],
    dateNote: 'Am 16. August 2026 verkündet. Artikel 4 tritt am 31. August 2026, die übrige Verordnung am 1. September 2026 in Kraft.',
  }],
  'StAnzO.|2026|16': [{ slug: 'vwv-stundentafel-eos', shortTitle: 'VwV Stundentafel EOS', abbr: 'VwV Stundentafel EOS', type: 'verwaltungsvorschrift', pageCount: 6, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Bestimmt Lehrpläne und Stundentafeln für Einführungsphase und Erweiterte Oberschule.', effectiveOverride: '2026-09-01', relatedNorms: ['schulordnung-erweiterte-oberschulen-und-abiturpruefung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026.' }],
  'StAnzO.|2026|17': [{ slug: 'vwv-ethik-religion-und-weltanschauung', shortTitle: 'VwV Ethik, Religion und Weltanschauung', abbr: 'VwV Ethik, Religion und Weltanschauung', type: 'verwaltungsvorschrift', pageCount: 6, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Konkretisiert den Vollzug von Ethik sowie Religions- und Weltanschauungsunterricht.', effectiveOverride: '2026-09-01', predecessor: 'VwV Religion und Ethik vom 29. September 2004', relatedNorms: ['ethik-und-religionsunterrichtverordnung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026, jedoch nicht vor der ERWVO. Die bisherige VwV Religion und Ethik tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|18': [{ slug: 'vwv-klassenarbeiten-pos', shortTitle: 'VwV Klassenarbeiten POS', abbr: 'VwV Klassenarbeiten POS', type: 'verwaltungsvorschrift', pageCount: 4, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Klassenarbeiten, komplexe Leistungen, Belastungssteuerung, Bewertung und Nachteilsausgleich an Polytechnischen Oberschulen.', effectiveOverride: '2026-09-01', predecessor: 'VwV Klassenarbeiten Oberschulen vom 9. Juni 2016', relatedNorms: ['schulordnung-polytechnische-oberschulen'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die VwV Klassenarbeiten Oberschulen tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|19': [{ slug: 'vwv-abschlusspruefungen-pos', shortTitle: 'VwV Abschlussprüfungen POS', abbr: 'VwV Abschlussprüfungen POS', type: 'verwaltungsvorschrift', pageCount: 4, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Planung, Durchführung, Korrektur und Feststellung der POS-Abschlussprüfungen nach den Klassenstufen 9 und 10.', effectiveOverride: '2026-09-01', predecessor: 'VwV Abschlussprüfung Haupt- und Realschulabschluss vom 20. August 2018', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'schulordnung-abendoberschulen'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die bisherige VwV Abschlussprüfung tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|20': [{ slug: 'vwv-pruefungsdokumentation-pos', shortTitle: 'VwV Prüfungsdokumentation POS', abbr: 'VwV Prüfungsdokumentation POS', type: 'verwaltungsvorschrift', pageCount: 4, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Bestimmt Formblätter, Führung, Berichtigung und Aufbewahrung der Dokumentation für POS-Abschlussprüfungen.', effectiveOverride: '2026-09-01', predecessor: 'VwV Prüfungsdokumentation vom 31. Juli 2023', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'vwv-abschlusspruefungen-pos'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die VwV Prüfungsdokumentation vom 31. Juli 2023 tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|21': [{ slug: 'vwv-eos-abitur', shortTitle: 'VwV EOS-Abitur', abbr: 'VwV EOS-Abitur', type: 'verwaltungsvorschrift', pageCount: 6, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Qualifikationsphase, Abiturprüfung, Formulare, Korrektur, Ergebnisfeststellung und Übergang an Erweiterten Oberschulen.', effectiveOverride: '2026-09-01', predecessor: 'VwV Durchführung Oberstufe und Abiturprüfung in der am 1. November 2023 übernommenen Fassung', relatedNorms: ['schulordnung-erweiterte-oberschulen-und-abiturpruefung', 'abendgymnasien-und-kollegverordnung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Für bestimmte Übergangskohorten gelten die bisherigen Formulare und Maßstäbe fort.' }],
  'StAnzO.|2026|22': [{ slug: 'vwv-zeugnismuster', shortTitle: 'VwV Zeugnismuster', abbr: 'VwV Zeugnismuster', type: 'verwaltungsvorschrift', pageCount: 6, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Gestaltung, Muster, Abschlussformeln und besondere Angaben auf Zeugnissen allgemeinbildender Schulen und des zweiten Bildungsweges.', effectiveOverride: '2026-09-01', predecessor: 'VwV Zeugnisformulare/Zeugnismuster in der am 1. November 2023 geltenden Fassung', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung', 'schulordnung-abendoberschulen', 'abendgymnasien-und-kollegverordnung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die bisherige VwV Zeugnisformulare/Zeugnismuster tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|23': [{ slug: 'aendvwv-schulformulare-2026', shortTitle: 'ÄndVwV Schulformulare', abbr: 'ÄndVwV Schulformulare', type: 'aenderungsvorschrift', pageCount: 3, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Passt die Verwaltungsvorschrift über Schulformulare an Polytechnische und Erweiterte Oberschulen sowie den Ethik-, Religions- und Weltanschauungsunterricht an.', effectiveOverride: '2026-09-01', dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Eine konsolidierte Stammfassung kann erst nach Bereitstellung und Prüfung der übernommenen amtlichen Ausgangsfassung veröffentlicht werden.' }],
  'StAnzO.|2026|24': [{ slug: 'vwv-sonderpaedagogische-formulare', shortTitle: 'VwV Sonderpädagogische Formulare', abbr: 'VwV Sonderpädagogische Formulare', type: 'verwaltungsvorschrift', pageCount: 4, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Bestimmt Muster, Formulare und Verfahrensgrundsätze zur Feststellung sonderpädagogischen Förderbedarfs und zur Beratung.', effectiveOverride: '2026-09-01', predecessor: 'VwV Muster sonderpädagogischer Förderbedarf und Beratung vom 13. Juli 2018', relatedNorms: ['verordnung-zur-aenderung-der-schulordnung-foerderschulen-2026'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die bisherige VwV tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|25': [{ slug: 'vwv-produktives-lernen-pos', shortTitle: 'VwV Produktives Lernen POS', abbr: 'VwV Produktives Lernen POS', type: 'verwaltungsvorschrift', pageCount: 5, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Aufnahme, Organisation, Lernen in der Praxis, Leistungsbewertung und Abschlüsse im Produktiven Lernen an Polytechnischen Oberschulen.', effectiveOverride: '2026-09-01', predecessor: 'VwV Produktives Lernen vom 11. Juli 2018', relatedNorms: ['schulordnung-polytechnische-oberschulen'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die bisherige VwV Produktives Lernen tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|26': [{ slug: 'vwv-ostdeutsche-sportschulen', shortTitle: 'VwV Ostdeutsche Sportschulen', abbr: 'VwV Ostdeutsche Sportschulen', type: 'verwaltungsvorschrift', pageCount: 4, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Anerkennung, Aufnahme, Unterricht, Training, Schutz und Leistungsbewertung an Ostdeutschen Sportschulen.', effectiveOverride: '2026-09-01', predecessor: 'VwV Sportbetonte Schulen vom 17. August 2022', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die VwV Sportbetonte Schulen tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|27': [{ slug: 'vwv-lrs-foerderung', shortTitle: 'VwV LRS-Förderung', abbr: 'VwV LRS-Förderung', type: 'verwaltungsvorschrift', pageCount: 3, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Diagnostik, Förderung, Leistungsbewertung und Nachteilsausgleich bei Schwierigkeiten im Lesen und Rechtschreiben.', effectiveOverride: '2026-09-01', predecessor: 'VwV LRS-Förderung vom 29. Juni 2006', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die bisherige VwV LRS-Förderung tritt mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|28': [{ slug: 'vwv-abschlussbildungsgang-lernen', shortTitle: 'VwV Abschlussbildungsgang Lernen', abbr: 'VwV Abschlussbildungsgang Lernen', type: 'verwaltungsvorschrift', pageCount: 3, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt die Empfehlung für einen lernzielgleichen Abschlussbildungsgang bei festgestelltem Förderschwerpunkt Lernen.', effectiveOverride: '2026-09-01', predecessor: 'VwV Bildungsempfehlung und Empfehlung Hauptschulbildungsgang vom 14. Dezember 2018', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'verordnung-zur-aenderung-der-schulordnung-foerderschulen-2026'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Die in der Vorschrift bezeichneten Teile der bisherigen VwV treten teils ersatzlos, im Übrigen mit Ablauf des 31. August 2026 außer Kraft.' }],
  'StAnzO.|2026|29': [{ slug: 'vwv-bedarf-2026-2027', shortTitle: 'VwV Bedarf 2026/2027', abbr: 'VwV Bedarf 2026/2027', type: 'verwaltungsvorschrift', pageCount: 5, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Regelt Bedarfsermittlung, Unterrichtsversorgung, Klassen- und Kursbildung sowie Schuljahresablauf für das Schuljahr 2026/2027.', effectiveOverride: '2026-09-01', expiryDate: '2027-07-31', relatedNorms: ['schulordnung-polytechnische-oberschulen', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026 und Außerkrafttreten mit Ablauf des 31. Juli 2027.' }],
  'StAnzO.|2026|30': [{ slug: 'aendvwv-beratungslehrer-2026', shortTitle: 'ÄndVwV Beratungslehrer', abbr: 'ÄndVwV Beratungslehrer', type: 'aenderungsvorschrift', pageCount: 3, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Passt die VwV Beratungslehrer an die neue Schulstruktur und die heutige Schulaufsicht an.', effectiveOverride: '2026-09-01', dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Eine konsolidierte Stammfassung kann erst nach Bereitstellung und Prüfung der übernommenen amtlichen Ausgangsfassung veröffentlicht werden.' }],
  'StAnzO.|2026|31': [{ slug: 'aendvwv-radfahrausbildung-2026', shortTitle: 'ÄndVwV Radfahrausbildung', abbr: 'ÄndVwV Radfahrausbildung', type: 'aenderungsvorschrift', pageCount: 3, responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft', summary: 'Passt die gemeinsame Verwaltungsvorschrift zur Radfahrausbildung an die Primarstufe der Polytechnischen Oberschule und an die neue Schulaufsicht an.', effectiveOverride: '2026-09-01', relatedNorms: ['schulordnung-polytechnische-oberschulen'], dateNote: 'Am 16. August 2026 verkündet; Inkrafttreten am 1. September 2026. Eine konsolidierte Stammfassung kann erst nach Bereitstellung und Prüfung der übernommenen amtlichen Ausgangsfassung veröffentlicht werden.' }],
  'StAnzO.|2026|32': [{
    slug: 'erlass-lehrplan-geschichte-2026',
    shortTitle: 'Erlass Lehrpläne Geschichte 2026',
    type: 'verwaltungsvorschrift',
    pageCount: 28,
    pdfFileName: 'StAnzO. 2026 Nr. 32.pdf',
    verifiedAt: '2026-08-20',
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
    summary: 'Führt die Lehrpläne Geschichte für die Polytechnische und die Erweiterte Oberschule fort und erweitert sie um Arbeiterbewegung, DDR-Geschichte sowie Friedliche Revolution und ostdeutsche Transformationsgeschichte.',
    effectiveOverride: '2026-09-01',
    relatedNorms: ['verwaltungsvorschrift-des-staatsministeriums-fur-volksbildung-und-wissenschaft-uber-lehrplane-und-stundentafel', 'vwv-stundentafel-eos', 'schulordnung-polytechnische-oberschulen', 'schulordnung-erweiterte-oberschulen-und-abiturpruefung'],
    dateNote: 'Am 19. August 2026 verkündet; Inkrafttreten am 1. September 2026. Der Erlass ist eine curriculare Verwaltungsvorschrift: Die fortgeführten Lehrpläne werden als fachliche Vorgaben dokumentiert, aber nicht als eigenständige Normen oder REVOSax-Stammnormen geführt.',
    sourceNotes: [
      {
        label: 'Ausgangslehrplan Polytechnische Oberschule',
        text: 'Der Erlass führt den Lehrplan Oberschule Geschichte 2004/2009/2019 fort und passt ihn für die Polytechnische Oberschule an. Die zugrunde liegende öffentliche Lehrplanfassung ist in der Lehrplan-Datenbank des sächsischen Schulportals dokumentiert: https://www.schulportal.sachsen.de/lplandb/index.php?lplanid=66&lplansc=gDx5PLSmVdrE0vN7n3G3&token=2f45b705e1df9828dc0200f3b43521a2 (abgerufen am 20. August 2026).',
      },
      {
        label: 'Ausgangslehrplan Erweiterte Oberschule',
        text: 'Der Erlass übernimmt Teile des Lehrplans Gymnasium Geschichte 2004/2007/2009/2011/2019 und führt sie für die Erweiterte Oberschule fort. Die zugrunde liegende öffentliche Lehrplanfassung ist in der Lehrplan-Datenbank des sächsischen Schulportals dokumentiert: https://www.schulportal.sachsen.de/lplandb/index.php?lplanid=65&lplansc=aCaTu4iKflh2vcW3XobR&token=9779f15fb00bd4de5c8df39a8982e3f1 (abgerufen am 20. August 2026).',
      },
      {
        label: 'Rechtsnatur der Lehrplanfassungen',
        text: 'Die beiden Lehrpläne sind fachliche Verwaltungsvorgaben und keine eigenständigen REVOSax-Stammnormen. Veröffentlichungs- und Änderungsnachweis des Portals ist deshalb der verkündete Erlass; konsolidierte Lesefassungen werden nur als nachgeordnete Arbeitsfassungen angekündigt.',
      },
    ],
  }],
  'StAnzO.|2026|33': [{
    slug: 'bekanntmachung-einsatzmedaille-monschau-2026',
    shortTitle: 'Einsatzmedaille „Monschau 2026“',
    type: 'bekanntmachung',
    pageCount: 6,
    pdfFileName: 'StAnzO. 2026 Nr. 33.pdf',
    verifiedAt: '2026-08-22',
    enactingBody: 'Staatspräsident des Freistaates Ostdeutschland',
    responsibleMinistry: 'Büro des Staatspräsidenten',
    subjects: ['Sicherheitsrecht und Polizeirecht'],
    summary: 'Stiftet die Einsatzmedaille „Monschau 2026“ für besondere Verdienste bei der Waldbrandkatastrophe vom 18. bis 20. August 2026 und regelt Voraussetzungen, Gestaltung und Verleihungsverfahren.',
    effectiveOverride: '2026-08-21',
    relatedNorms: ['bekanntmachung-des-ministerprasidenten-uber-die-stiftung-sta-1wxgxqu'],
    dateNote: 'Am 21. August 2026 verkündet und am selben Tag in Kraft getreten.',
    additionalPublicationEntries: [{
      id: 'bekanntmachung-des-ministerprasidenten-uber-die-stiftung-sta-1wxgxqu',
      title: 'Bekanntmachung des Staatspräsidenten über die Stiftung staatlicher Auszeichnungen des Freistaates Ostdeutschland',
      type: 'bekanntmachung',
      citation: 'Geändert durch Abschnitt I der Bekanntmachung vom 21. August 2026 (StAnzO. 2026 Nr. 33 S. 2)',
      pages: '2',
      documentDate: '2026-08-21',
      normSlug: 'bekanntmachung-des-ministerprasidenten-uber-die-stiftung-sta-1wxgxqu',
      versionId: '2026-08-21',
    }],
  }],
  'StAnzO.|2026|34': [{
    slug: 'bekanntmachung-gemeinwirtschaftliche-strompreisleitlinie',
    shortTitle: 'Gemeinwirtschaftliche Strompreisleitlinie',
    type: 'bekanntmachung',
    pageCount: 5,
    pdfFileName: 'StAnzO. 2026 Nr. 34.pdf',
    verifiedAt: '2026-08-22',
    enactingBody: 'Verwaltungsrat der Landesenergiewerke Ost',
    responsibleMinistry: 'Landesenergiewerke Ost AöR',
    subjects: ['Umweltschutz, Abfallwirtschaft', 'Gewerbe- und Berufsrecht'],
    summary: 'Legt die gemeinwirtschaftliche Strompreisbildung der Landesenergiewerke Ost fest und führt zum 1. September 2026 den Ost-Stromtarif sowie einen vergünstigten Grundbedarfstarif ein.',
    effectiveOverride: '2026-09-01',
    relatedNorms: ['landesenergiewerke-gesetz', 'energie-und-waermevergesellschaftungsgesetz'],
    dateNote: 'Am 22. August 2026 verkündet; Inkrafttreten am 1. September 2026.',
  }],
  'StAnzO.|2026|35': [{
    slug: 'bekanntmachung-gemeinwirtschaftliche-waermepreisleitlinie',
    shortTitle: 'Gemeinwirtschaftliche Wärmepreisleitlinie',
    type: 'bekanntmachung',
    pageCount: 5,
    pdfFileName: 'StAnzO. 2026 Nr. 35.pdf',
    verifiedAt: '2026-08-22',
    enactingBody: 'Verwaltungsrat der Landesenergiewerke Ost',
    responsibleMinistry: 'Landesenergiewerke Ost AöR',
    subjects: ['Umweltschutz, Abfallwirtschaft', 'Gewerbe- und Berufsrecht'],
    summary: 'Legt die gemeinwirtschaftliche Wärmepreisbildung der Landesenergiewerke Ost fest, senkt Haushaltswärmepreise und führt zum 1. September 2026 einen vergünstigten Grundwärmetarif ein.',
    effectiveOverride: '2026-09-01',
    relatedNorms: ['landesenergiewerke-gesetz', 'energie-und-waermevergesellschaftungsgesetz', 'energie-und-waermefinanzierungsgesetz'],
    dateNote: 'Am 22. August 2026 verkündet; Inkrafttreten am 1. September 2026.',
  }],
  'StAnzO.|2026|36': [{
    slug: 'bekanntmachung-ode-betriebsgrundsaetze',
    shortTitle: 'Leitlinie gemeinwirtschaftlicher Eisenbahnbetrieb',
    type: 'bekanntmachung',
    pageCount: 5,
    pdfFileName: 'StAnzO. 2026 Nr. 36.pdf',
    verifiedAt: '2026-08-23',
    enactingBody: 'Verwaltungsrat der Ostdeutschen Eisenbahn',
    responsibleMinistry: 'Ostdeutsche Eisenbahn AöR',
    subjects: ['Verkehr', 'Gewerbe- und Berufsrecht'],
    summary: 'Verankert gemeinwirtschaftliche Betriebsgrundsätze, Betriebs- und Personalreserven, eine Fahrgastgarantie, eine einheitliche Wagenklasse und monatliche Qualitätsberichte der Ostdeutschen Eisenbahn.',
    effectiveOverride: '2026-08-24',
    relatedNorms: [
      'ostdeutsches-eisenbahngesetz',
      'ostdeutsche-eisenbahn-neuordnungsgesetz',
      'bekanntmachung-ovv-tarif-und-anschlusssicherung',
      'bekanntmachung-landesnetz-ost-und-ostdeutschlandtakt',
    ],
    dateNote: 'Am 23. August 2026 verkündet; Inkrafttreten am 24. August 2026.',
  }],
  'StAnzO.|2026|37': [{
    slug: 'bekanntmachung-ovv-tarif-und-anschlusssicherung',
    shortTitle: 'OVV-Tarif und Anschlusssicherung',
    type: 'bekanntmachung',
    pageCount: 5,
    pdfFileName: 'StAnzO. 2026 Nr. 37.pdf',
    verifiedAt: '2026-08-23',
    enactingBody: 'Verbandsversammlung des Ostdeutschen Verkehrsverbundes',
    responsibleMinistry: 'Ostdeutscher Verkehrsverbund',
    subjects: ['Verkehr', 'Allgemeines zum Sozialwesen'],
    summary: 'Setzt das Ost-Ticket auf 15 Euro, führt einen unentgeltlichen Sozialtarif und die grundsätzlich unentgeltliche Fahrradmitnahme ein und bestimmt Standards für Fahrgastinformation und Anschlusssicherung.',
    effectiveOverride: '2026-08-01',
    relatedNorms: [
      'erstes-gesetz-zur-anderung-des-gesetzes-uber-den-offentlichen-personennahverkehr',
      'ostdeutsches-eisenbahngesetz',
      'bekanntmachung-ode-betriebsgrundsaetze',
      'bekanntmachung-landesnetz-ost-und-ostdeutschlandtakt',
    ],
    dateNote: 'Am 23. August 2026 verkündet. Nummer 1 gilt rückwirkend seit 1. August 2026; die Nummern 2, 4, 6 und 7 treten am 1. September 2026 in Kraft. Für die Nummern 3 und 5 bestimmt die Bekanntmachung jeweils einen gesonderten, noch nicht kalendarisch festgelegten Geltungsbeginn.',
  }],
  'StAnzO.|2026|38': [{
    slug: 'bekanntmachung-landesnetz-ost-und-ostdeutschlandtakt',
    shortTitle: 'Landesnetz Ost und Ostdeutschlandtakt',
    type: 'bekanntmachung',
    pageCount: 6,
    pdfFileName: 'StAnzO. 2026 Nr. 38.pdf',
    verifiedAt: '2026-08-23',
    enactingBody: 'Staatssekretariat für Mobilität und regionale Entwicklung',
    responsibleMinistry: 'Staatssekretariat für Mobilität und regionale Entwicklung',
    subjects: ['Verkehr', 'Raumordnung, Landesplanung'],
    summary: 'Bestimmt das Landesnetz Ost und legt Planungsgrundsätze für Ostdeutschlandtakt, Betriebszeiten, Mobilitätsgrundversorgung, Taktknoten, Anschlusssicherung und Angebotsausbau fest.',
    effectiveOverride: '2026-08-24',
    relatedNorms: [
      'erstes-gesetz-zur-anderung-des-gesetzes-uber-den-offentlichen-personennahverkehr',
      'ostdeutsches-eisenbahngesetz',
      'ostdeutsche-eisenbahn-neuordnungsgesetz',
      'bekanntmachung-ode-betriebsgrundsaetze',
      'bekanntmachung-ovv-tarif-und-anschlusssicherung',
    ],
    dateNote: 'Am 23. August 2026 verkündet; Inkrafttreten am 24. August 2026. Takt- und Betriebszeitstandards werden schrittweise zum jeweils nächstmöglichen betrieblich umsetzbaren Fahrplanwechsel verwirklicht.',
  }],
  'StAnzO.|2026|39': [{
    slug: 'bekanntmachung-bestellung-gruendungsvorstand-interflug',
    shortTitle: 'Bestellung des Gründungsvorstandes der Interflug',
    type: 'bekanntmachung',
    pageCount: 2,
    pdfFileName: 'StAnzO. 2026 Nr. 39.pdf',
    verifiedAt: '2026-09-04',
    enactingBody: 'Staatsrat des Freistaates Ostdeutschland',
    responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
    subjects: ['Gewerbe- und Berufsrecht', 'Verkehr'],
    keywords: ['Interflug', 'Gründungsvorstand', 'Joachim Hunold', 'Ralf Teckentrup', 'Klaus Wowereit'],
    summary: 'Bestellt Joachim Hunold, Ralf Teckentrup und Klaus Wowereit mit Wirkung vom 3. September 2026 zu Mitgliedern des Gründungsvorstandes der Interflug und begrenzt die Bestellung auf die Gründungsphase.',
    effectiveOverride: '2026-09-03',
    relatedNorms: ['interflug-gesetz', 'gesetz-zur-errichtung-der-interflug', 'bekanntmachung-beschaffung-anfangsflotte-interflug'],
    dateNote: 'Am 3. September 2026 verkündet; die Bestellung wirkt vom 3. September 2026 an und endet mit dem Amtsantritt des ersten vom Verwaltungsrat bestellten Vorstandes, spätestens mit Ablauf des 3. März 2027. Die Bekanntmachung zitiert § 24 Absatz 3 und 4 sowie § 10 Absatz 2 des Interflug-Gesetzes; im verkündeten Gesetz (OGVBl. 2026 Nr. 74) regeln § 23 Absatz 3 und 4 den Gründungsvorstand und § 14 Absatz 2 die Bestellung des Vorstandes durch den Verwaltungsrat. Der Wortlaut wird unverändert wiedergegeben.',
  }],
  'StAnzO.|2026|40': [{
    slug: 'bekanntmachung-beschaffung-anfangsflotte-interflug',
    shortTitle: 'Beschaffung der Anfangsflotte der Interflug',
    type: 'bekanntmachung',
    statusOverride: 'one-time-act',
    pageCount: 3,
    pdfFileName: 'StAnzO. 2026 Nr. 40.pdf',
    verifiedAt: '2026-09-04',
    enactingBody: 'Gründungsvorstand der Interflug',
    responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
    subjects: ['Gewerbe- und Berufsrecht', 'Verkehr'],
    keywords: ['Interflug', 'Anfangsflotte', 'Löschflugzeuge', 'AT-802F Fire Boss', 'Dash 8-400AT', 'Boeing 737-700 FireLiner', 'Beschaffungsprogramm'],
    summary: 'Macht die nach § 21 des Interflug-Gesetzes beschlossene Beschaffung der Anfangsflotte aus zehn Löschflugzeugen mit einem Beschaffungsvolumen von bis zu 105,5 Millionen Euro bekannt.',
    effectiveOverride: '2026-09-03',
    relatedNorms: ['interflug-gesetz', 'gesetz-zur-errichtung-der-interflug', 'bekanntmachung-bestellung-gruendungsvorstand-interflug'],
    dateNote: 'Am 3. September 2026 verkündet. Die Bekanntmachung dokumentiert einen abgeschlossenen Beschaffungsbeschluss des Gründungsvorstandes nach Zustimmung des Verwaltungsrates; sie begründet keine fortgeltende Regelung.',
  }],
  'OGVBl.|2026|69': [{
    slug: 'sicherheitsueberpruefungsfeststellungsverordnung',
    shortTitle: 'Sicherheitsüberprüfungsfeststellungsverordnung',
    abbr: 'SÜFV-O',
    type: 'verordnung',
    pageCount: 5,
    pdfFileName: 'OGVBl. 2026 Nr. 69.pdf',
    verifiedAt: '2026-09-02',
    enactingBody: 'Staatsrat des Freistaates Ostdeutschland',
    responsibleMinistry: 'Staatssekretariat für Staats- und Grenzsicherheit',
    subjects: ['Sicherheitsrecht und Polizeirecht'],
    summary: 'Bestimmt die lebens- und verteidigungswichtigen Einrichtungen, für deren Aufgabenwahrnehmung Sicherheitsüberprüfungen erforderlich sind.',
    dateNote: 'Am 31. August 2026 verkündet und am 1. September 2026 in Kraft getreten.',
  }],
  'OGVBl.|2026|70': [
    {
      slug: 'besonderes-gesetz-zur-neuregelung-des-hoheitszeichenrechts',
      shortTitle: 'Besonderes Gesetz zur Neuregelung des Hoheitszeichenrechts',
      type: 'aenderungsvorschrift',
      pageCount: 15,
      pdfFileName: 'OGVBl. 2026 Nr. 70.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
      subjects: ['Verfassungsrecht'],
      summary: 'Führt ein neues Gesetz über die Hoheitszeichen ein, hebt das bisherige Gesetz über die Hoheitszeichen auf und regelt Übergangsrecht sowie die Fortgeltung der Hoheitszeichenverordnung.',
      affectedNorms: ['gesetz-zur-einfuhrung-eines-hoheitszeichengesetzes', 'hoheitszeichenverordnung'],
      dateNote: 'Am 2. September 2026 verkündet und am selben Tag in Kraft getreten.',
    },
    {
      slug: 'ostdeutsches-hoheitszeichengesetz',
      shortTitle: 'Ostdeutsches Hoheitszeichengesetz',
      abbr: 'OHzG',
      type: 'gesetz',
      pageCount: 15,
      pdfFileName: 'OGVBl. 2026 Nr. 70.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
      subjects: ['Verfassungsrecht'],
      summary: 'Bestimmt die Hoheitszeichen des Freistaates Ostdeutschland und ihre Verwendung.',
      predecessor: 'Gesetz zur Einführung eines Hoheitszeichengesetzes',
      relatedNorms: ['besonderes-gesetz-zur-neuregelung-des-hoheitszeichenrechts', 'hoheitszeichenverordnung'],
      dateNote: 'Am 2. September 2026 verkündet und am selben Tag in Kraft getreten.',
    },
  ],
  'OGVBl.|2026|71': [
    {
      slug: 'gesetz-zur-einfuehrung-eines-besonderen-gesetzes-ueber-die-oeffentliche-daseinsvorsorge',
      shortTitle: 'Einführungsgesetz Daseinsvorsorge',
      type: 'aenderungsvorschrift',
      pageCount: 15,
      pdfFileName: 'OGVBl. 2026 Nr. 71.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
      subjects: ['Gewerbe- und Berufsrecht', 'Verfassungsrecht'],
      summary: 'Führt das Ostdeutsche Daseinsvorsorgegesetz ein und ergänzt die Ostdeutsche Haushaltsordnung um eine Regelung zur Überlassung landeseigener Liegenschaften.',
      affectedNorms: ['saechsische-haushaltsordnung'],
      dateNote: 'Am 2. September 2026 verkündet; Inkrafttreten am 3. September 2026.',
    },
    {
      slug: 'ostdeutsches-daseinsvorsorgegesetz',
      shortTitle: 'Ostdeutsches Daseinsvorsorgegesetz',
      abbr: 'OstDVG',
      type: 'gesetz',
      pageCount: 15,
      pdfFileName: 'OGVBl. 2026 Nr. 71.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
      subjects: ['Gewerbe- und Berufsrecht', 'Verfassungsrecht'],
      summary: 'Bestimmt die öffentliche Daseinsvorsorge als staatliche Aufgabe, ihre Verantwortungsträger und die Grundsätze ihrer Sicherstellung.',
      relatedNorms: ['gesetz-zur-einfuehrung-eines-besonderen-gesetzes-ueber-die-oeffentliche-daseinsvorsorge', 'saechsische-haushaltsordnung'],
      dateNote: 'Am 2. September 2026 verkündet; Inkrafttreten am 3. September 2026.',
    },
  ],
  'OGVBl.|2026|72': [{
    slug: 'gesetz-zur-einfuehrung-von-hinweisgebermeldestellen',
    shortTitle: 'Gesetz zur Einführung von Hinweisgebermeldestellen',
    type: 'aenderungsvorschrift',
    pageCount: 3,
    pdfFileName: 'OGVBl. 2026 Nr. 72.pdf',
    verifiedAt: '2026-09-02',
    enactingBody: 'Landtag des Freistaates Ostdeutschland',
    responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
    subjects: ['Kommunalrecht', 'Allgemeine Verwaltung'],
    summary: 'Führt bei Gemeinden, Landkreisen und Bezirken interne Meldestellen für Hinweisgeber:innen ein.',
    affectedNorms: ['saechsische-gemeindeordnung', 'saechsische-landkreisordnung', 'ostdeutsche-bezirksordnung'],
    dateNote: 'Am 2. September 2026 verkündet; Inkrafttreten am 1. Oktober 2026.',
  }],
  'OGVBl.|2026|73': [
    {
      slug: 'gesetz-zur-einfuehrung-eines-zinnwald-vergesellschaftungsgesetzes',
      shortTitle: 'Einführungsgesetz Zinnwald-Vergesellschaftung',
      type: 'aenderungsvorschrift',
      pageCount: 6,
      pdfFileName: 'OGVBl. 2026 Nr. 73.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
      subjects: ['Gewerbe- und Berufsrecht'],
      summary: 'Führt das Gesetz zur Vergesellschaftung des Lithiumprojekts Zinnwald ein.',
      dateNote: 'Am 2. September 2026 verkündet und am selben Tag in Kraft getreten.',
    },
    {
      slug: 'zinnwald-vergesellschaftungsgesetz',
      shortTitle: 'Zinnwald-Vergesellschaftungsgesetz',
      abbr: 'ZinnVG',
      type: 'gesetz',
      pageCount: 6,
      pdfFileName: 'OGVBl. 2026 Nr. 73.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
      subjects: ['Gewerbe- und Berufsrecht'],
      summary: 'Regelt die Vergesellschaftung des Lithiumprojekts Zinnwald.',
      relatedNorms: ['gesetz-zur-einfuehrung-eines-zinnwald-vergesellschaftungsgesetzes'],
      dateNote: 'Am 2. September 2026 verkündet und am selben Tag in Kraft getreten.',
    },
  ],
  'OGVBl.|2026|74': [
    {
      slug: 'gesetz-zur-errichtung-der-interflug',
      shortTitle: 'Gesetz zur Errichtung der Interflug',
      type: 'aenderungsvorschrift',
      pageCount: 14,
      pdfFileName: 'OGVBl. 2026 Nr. 74.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
      subjects: ['Gewerbe- und Berufsrecht', 'Verkehr'],
      summary: 'Errichtet die Interflug und führt das Gesetz über die Interflug ein.',
      dateNote: 'Am 2. September 2026 verkündet; Inkrafttreten am 3. September 2026.',
    },
    {
      slug: 'interflug-gesetz',
      shortTitle: 'Interflug-Gesetz',
      abbr: 'InterflugG',
      type: 'gesetz',
      pageCount: 14,
      pdfFileName: 'OGVBl. 2026 Nr. 74.pdf',
      verifiedAt: '2026-09-02',
      enactingBody: 'Landtag des Freistaates Ostdeutschland',
      responsibleMinistry: 'Staatssekretariat für Wirtschaft und Arbeit',
      subjects: ['Gewerbe- und Berufsrecht', 'Verkehr'],
      summary: 'Bestimmt Aufgaben, Organisation und Aufsicht der Interflug.',
      relatedNorms: ['gesetz-zur-errichtung-der-interflug', 'bekanntmachung-bestellung-gruendungsvorstand-interflug', 'bekanntmachung-beschaffung-anfangsflotte-interflug'],
      dateNote: 'Am 2. September 2026 verkündet; Inkrafttreten am 3. September 2026.',
    },
  ],
  'OVertrBl.|2026|4': [{
    slug: 'staatsvertrag-zur-anderung-des-staatsvertrages-uber-den-nord-122dpnt',
    shortTitle: 'Staatsvertrag zur Änderung des Staatsvertrages über den Norddeutschen Rundfunk und zur Überleitung der in Mecklenburg-Vorpommern belegenen NDR-Strukturen auf den Ostdeutschen Fernsehfunk',
    type: 'staatsvertrag',
    pageCount: 9,
    pdfFileName: 'OVertrBl. 2026 Nr. 4.pdf',
    verifiedAt: '2026-09-02',
    enactingBody: null,
    responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland',
    subjects: ['Presse-, Rundfunk-, Filmwesen', 'Staatsverträge, Abkommen, Durchführung völkerrechtlicher und zwischenstaatlicher Vereinbarungen, Auslandsbeziehungen'],
    summary: 'Ändert den Staatsvertrag über den Norddeutschen Rundfunk und regelt die Überleitung der in Mecklenburg-Vorpommern belegenen NDR-Strukturen auf den Ostdeutschen Fernsehfunk.',
    effectiveOverride: '2026-09-03',
    versionId: '2026-03-08',
    validFrom: '2026-09-03',
    historyDate: '2026-03-08',
    historyTitle: 'Staatsvertrag geschlossen.',
    relatedNorms: ['bekanntmachung-ueber-das-inkrafttreten-des-ndr-aenderungs-und-ueberleitungsstaatsvertrages'],
    dateNote: 'Am 8. März 2026 geschlossen und am 24. März 2026 verkündet. Nach der Bekanntmachung vom 2. September 2026 tritt der Staatsvertrag am 3. September 2026 in Kraft.',
    editorialResolutions: [{
      id: 'ndr-vertragsblatt-4-quellenkorrektur-2026-09-02',
      status: 'resolved-source-conflict',
      decisionDate: '2026-09-02',
      issue: 'Die zuvor versionierte und gesperrte Fassung von OVertrBl. 2026 Nr. 4 enthielt in Anlage 1 einen fehlerhaften unausgefüllten Mustergesetz-Platzhalter anstelle der tatsächlich geänderten Ausgangsnorm.',
      publishedText: 'Der Staatsvertrag über den Norddeutschen Rundfunk (NDR-Staatsvertrag) vom 4./9. März 2021 (GVOBl. M-V S. 797) wird wie folgt geändert:',
      resolvedApplication: 'Für die Erfassung des Änderungsstaatsvertrags ist ausschließlich die korrigierte Fassung von OVertrBl. 2026 Nr. 4 maßgeblich. Der frühere Mustergesetz-Platzhalter wird nicht als eigene Zielnorm ausgewertet.',
      rationale: 'Die frühere Fassung beruhte auf einem Fehler in den Quellen. Die korrigierte strukturtragende HTML-Fassung und die dazugehörige PDF-Fassung bezeichnen übereinstimmend den NDR-Staatsvertrag als Zielnorm und ersetzen die gesperrte fehlerhafte Ausgabe.',
      evidence: [
        'Gesetze/OVertrBl. 2026 Nr. 4.html',
        'Gesetze/OVertrBl. 2026 Nr. 4.pdf',
        'content/verkuendungen/overtrbl-2026-04.json',
        'content/normen/staatsvertrag-zur-anderung-des-staatsvertrages-uber-den-nord-122dpnt/versions/2026-03-08.json',
      ],
    }],
  }],
  'OVertrBl.|2026|5': [{
    slug: 'bekanntmachung-ueber-das-inkrafttreten-des-ndr-aenderungs-und-ueberleitungsstaatsvertrages',
    shortTitle: 'Bekanntmachung zum Inkrafttreten des NDR-Änderungs- und Überleitungsstaatsvertrages',
    type: 'bekanntmachung',
    statusOverride: 'one-time-act',
    pageCount: 2,
    pdfFileName: 'OVertrBl. 2026 Nr. 5.pdf',
    verifiedAt: '2026-09-02',
    enactingBody: 'Staatspräsident des Freistaates Ostdeutschland',
    responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland',
    subjects: ['Presse-, Rundfunk-, Filmwesen', 'Staatsverträge, Abkommen, Durchführung völkerrechtlicher und zwischenstaatlicher Vereinbarungen, Auslandsbeziehungen'],
    summary: 'Macht bekannt, dass der NDR-Änderungs- und Überleitungsstaatsvertrag nach Austausch der Ratifikationsurkunden am 3. September 2026 in Kraft tritt.',
    relatedNorms: ['staatsvertrag-zur-anderung-des-staatsvertrages-uber-den-nord-122dpnt'],
    dateNote: 'Am 2. September 2026 verkündet. Der Staatsvertrag tritt am 3. September 2026 in Kraft.',
  }],
};

function publicationConfigKey(parsed) {
  return publicationIdentityKey(parsed.publication, parsed.year, parsed.issue);
}

function configuredNormsFor(parsed) {
  return NEW_PUBLICATION_CONFIG[publicationConfigKey(parsed)] ??
    (parsed.publication === 'OGVBl.' && parsed.year === 2026 ? ISSUE_CONFIG[parsed.issue] : undefined);
}

function configuredSubjectsFor(parsed) {
  return NEW_PUBLICATION_CONFIG[publicationConfigKey(parsed)]
    ? SCHOOL_LAW_SUBJECTS
    : ISSUE_SUBJECTS[parsed.issue];
}

/**
 * Sachgebiete in der Speicherform: höchstens drei, ohne Wiederholung, das Hauptsachgebiet
 * an erster Stelle (primarySubject ist stets subjects[0]).
 */
function orderedSubjects(subjects, primarySubject) {
  const unique = [...new Set(subjects ?? [])];
  const ordered = primarySubject && unique.includes(primarySubject)
    ? [primarySubject, ...unique.filter((subject) => subject !== primarySubject)]
    : unique;
  return ordered.slice(0, 3);
}

const OGVBL_VOLKSBEFRAGUNG_SOURCE_REFERENCES = [
  {
    kind: 'structured-html-transcription',
    label: 'Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe',
    availability: 'versioned',
    localSource: 'Gesetze/OGVBl. 2026 Nr. 59.html',
    sha256: 'fe9661c8f84c05e00f1601db47ef390ada23c12e0ab7a2e8eb504f7179b97404',
    mediaType: 'text/html',
    pageRange: '2–7',
    verifiedAt: '2026-08-16',
    sourceRole: 'structure-bearing',
  },
  {
    kind: 'primary-pdf',
    label: 'Amtliche visuelle Veröffentlichungsfassung',
    availability: 'versioned',
    localSource: 'Gesetze/OGVBl. 2026 Nr. 59.pdf',
    sha256: 'd5ce883378a5b35c5641649e51bf0468632ed6c3e85dbebf4bf507adcfe423b1',
    mediaType: 'application/pdf',
    pageCount: 7,
    pageRange: '2–7',
    verifiedAt: '2026-08-09',
    sourceRole: 'visual-control',
    derivedSource: 'Gesetze/OGVBl. 2026 Nr. 59.html',
  },
  {
    kind: 'supplementary-markdown-transcription',
    label: 'Zusätzliche Markdown-Transkription der amtlichen Ausgabe',
    availability: 'versioned',
    localSource: 'Gesetze/OGVBl. 2026 Nr. 59.md',
    sha256: 'b104ff9399357b22509f17dcb45c479ada909c17562c9f73ed80985f6af15a30',
    mediaType: 'text/markdown',
    pageRange: '2–7',
    verifiedAt: '2026-08-09',
    sourceRole: 'supplementary-transcription',
    derivedSource: 'Gesetze/OGVBl. 2026 Nr. 59.html',
  },
];

const GMBL_AGREEMENT_SLUG = 'verwaltungsabkommen-kasernierte-grenzpolizei';
const GMBL_SOURCE_FILE = 'GMBl-14-2026.html';
const GMBL_SOURCE_REFERENCES = [
  {
    kind: 'structured-html-transcription',
    label: 'Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe',
    availability: 'versioned',
    localSource: 'Gesetze/GMBl-14-2026.html',
    sha256: '439fa5db34e577b60e93bb0beb46b745ae427cd1b124553415986b83537c562f',
    mediaType: 'text/html',
    pageRange: '2–6',
    verifiedAt: '2026-07-29',
    sourceRole: 'structure-bearing',
  },
  {
    kind: 'primary-pdf',
    label: 'Amtliche visuelle Veröffentlichungsfassung',
    availability: 'versioned',
    localSource: 'Gesetze/GMBl-14-2026.pdf',
    sha256: 'e361abb85f2bfdbd7828383b3a010de5335ff6a883d3f07dd744addccfbe69dc',
    mediaType: 'application/pdf',
    pageCount: 6,
    pageRange: '2–6',
    verifiedAt: '2026-07-29',
    sourceRole: 'visual-control',
    derivedSource: 'Gesetze/GMBl-14-2026.html',
  },
  {
    kind: 'supplementary-markdown-transcription',
    label: 'Zusätzliche Markdown-Transkription der amtlichen Ausgabe',
    availability: 'versioned',
    localSource: 'Gesetze/GMBl-14-2026.md',
    sha256: 'b38ce507aa9d8b3487569e718401c21142669b6aa5127ab79c1cfe16e8be452f',
    mediaType: 'text/markdown',
    pageRange: '2–6',
    verifiedAt: '2026-07-29',
    sourceRole: 'supplementary-transcription',
    derivedSource: 'Gesetze/GMBl-14-2026.html',
  },
];

const STANZO_HOUSING_GUIDELINE_SLUG = 'bekanntmachung-gemeingut-wohnen-mietpreisbildung';
const STANZO_HOUSING_SOURCE_REFERENCES = [
  {
    kind: 'structured-html-transcription',
    label: 'Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe',
    availability: 'versioned',
    localSource: 'Gesetze/StAnzO. 2026 Nr. 15.html',
    sha256: '5eff7d2526fd8b17e458bb8badcc1c9ee7c1ee712562b77e56ad1d8e86226fe7',
    mediaType: 'text/html',
    pageRange: '2–3',
    verifiedAt: '2026-08-08',
    sourceRole: 'structure-bearing',
  },
  {
    kind: 'primary-pdf',
    label: 'Amtliche visuelle Veröffentlichungsfassung',
    availability: 'versioned',
    localSource: 'Gesetze/StAnzO. 2026 Nr. 15.pdf',
    sha256: '13c5e0932e90647e64ff850b0f1c0f84521c77f4343e8bd7f099a0afdfa4ac5c',
    mediaType: 'application/pdf',
    pageCount: 3,
    pageRange: '2–3',
    verifiedAt: '2026-08-08',
    sourceRole: 'visual-control',
    derivedSource: 'Gesetze/StAnzO. 2026 Nr. 15.html',
  },
];

// Nur in Primärquellen belegte Kürzel dürfen als amtliche Suchbegriffe erscheinen; die Liste
// führt scripts/lib/norm-title-rules.mjs gemeinsam mit den übrigen Regeln des Titelmodells.
// Diese redaktionell gebildeten Werte werden beim Zusammenführen mit Bestandsdaten entfernt.

function formatGermanDate(isoDate) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}

function citationFor(parsed, startPage) {
  const label = /Berichtigung/iu.test(parsed.heading ?? '') || parsed.type === 'berichtigung'
    ? 'Berichtigung'
    : /Allgemeinverfügung/iu.test(parsed.heading ?? '') || parsed.type === 'allgemeinverfuegung'
    ? 'Allgemeinverfügung'
    : /Organisationserlass/iu.test(parsed.heading ?? '')
    ? 'Organisationserlass'
    : /Erlass/iu.test(parsed.heading ?? '')
    ? 'Erlass'
    : /Anordnung/iu.test(parsed.heading ?? '')
    ? 'Anordnung'
    : /Förderrichtlinie/iu.test(parsed.heading ?? '') || parsed.type === 'foerderrichtlinie'
    ? 'Förderrichtlinie'
    : /Richtlinie/iu.test(parsed.heading ?? '')
    ? 'Richtlinie'
    : /Verwaltungsvorschrift/iu.test(parsed.heading ?? '')
    ? 'Verwaltungsvorschrift'
    : /Bekanntmachung/iu.test(parsed.heading ?? '') || parsed.type === 'bekanntmachung'
      ? 'Bekanntmachung'
    : /Verordnung/iu.test(parsed.heading ?? '') || parsed.type === 'verordnung'
      ? 'Verordnung'
      : /Staatsvertrag/iu.test(parsed.heading ?? '') || parsed.type === 'staatsvertrag'
        ? 'Staatsvertrag'
      : 'Gesetz';
  return `${label} vom ${formatGermanDate(parsed.documentDate)} (${parsed.publication} ${parsed.year} Nr. ${parsed.issue}${startPage ? ` S. ${startPage}` : ''})`;
}

function deriveStatus(norm, index) {
  if (index === 0 && ['aenderungsvorschrift', 'berichtigung'].includes(norm.type)) return 'one-time-act';
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

function retainedOfficialSourceReferences(references) {
  return (references ?? []).filter((reference) =>
    reference.kind !== 'primary-pdf' &&
    !['transcription', 'structured-html-transcription', 'legacy-markdown-transcription'].includes(reference.kind) &&
    !(
      reference.kind === 'original' &&
      reference.availability === 'not-versioned' &&
      /(?:Original|PDF)/iu.test(reference.label ?? '')
    )
  );
}

function officialIssueSourceReferences(parsed, config, options = {}) {
  const existingReferences = options.existingReferences ?? [];
  const resolved = resolvePublicationPdf({
    publication: parsed.publication,
    year: parsed.year,
    issue: parsed.issue,
    htmlFileName: isHtmlSource(parsed.fileName) ? basename(parsed.fileName) : null,
    configuredPdfFileName: config.pdfFileName,
    pdfFileNames: availablePdfFileNames,
    sourceReferences: existingReferences,
  });
  if (resolved.strategy === 'ambiguous') {
    throw new Error(`${parsed.fileName}: mehrere PDF-Kandidaten für dieselbe Ausgabe: ${resolved.candidates.join(', ')}`);
  }
  const htmlFileName = isHtmlSource(parsed.fileName) ? basename(parsed.fileName) : null;
  const htmlBytes = htmlFileName ? readFileSync(resolve(sourceDir, htmlFileName)) : null;
  const pdfBytes = resolved.fileName ? readFileSync(resolve(sourceDir, resolved.fileName)) : null;
  const actualPageCount = pdfBytes ? pdfPageCount(pdfBytes) : null;
  if (config.pageCount && actualPageCount && config.pageCount !== actualPageCount) {
    throw new Error(`${parsed.fileName}: konfigurierte Seitenzahl ${config.pageCount} weicht vom PDF (${actualPageCount}) ab`);
  }
  const pageRange = options.pageRange ?? (actualPageCount
    ? `${parsed.startPage ?? 1}${Number(parsed.startPage ?? 1) === actualPageCount ? '' : `–${actualPageCount}`}`
    : undefined);
  const verifiedAt = config.verifiedAt ?? existingReferences.find((reference) =>
    ['structured-html-transcription', 'primary-pdf'].includes(reference.kind) && reference.verifiedAt
  )?.verifiedAt;
  const extras = parsed.publication === 'OGVBl.' && parsed.year === 2026 && parsed.issue === '59'
    ? OGVBL_VOLKSBEFRAGUNG_SOURCE_REFERENCES.filter((reference) => reference.kind === 'supplementary-markdown-transcription')
    : [];
  return [
    ...preserveVerifiedAt(buildPublicationSourceReferences({
      htmlFileName,
      htmlBytes,
      pdfFileName: resolved.fileName,
      pdfBytes,
      pageRange,
      ...(verifiedAt ? { verifiedAt } : {}),
    }), existingReferences),
    ...(!htmlFileName ? normSourceReferences(parsed.fileName) : []),
    ...retainedOfficialSourceReferences(existingReferences),
    ...extras,
  ].filter((reference, index, references) => references.findIndex((candidate) =>
    candidate.kind === reference.kind &&
    candidate.localSource === reference.localSource &&
    candidate.url === reference.url
  ) === index);
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

/**
 * Die Bezeichnung des Eintrags folgt der Norm, nicht dem Altbestand: Eine bereits
 * vorhandene Zitierung wird nur übernommen, wenn sie einen zum Normtyp passenden
 * Rechtsakt nennt (amtliche Sonderformen wie Anordnung oder Organisationserlass
 * bleiben damit erhalten); sonst wird sie aus Normtyp, Datum und Fundstelle gebildet.
 */
function legacyEntryCitation(previous, meta, publication, documentDate) {
  if (
    previous?.citation &&
    /\bvom\s+\d{1,2}\.\s+[A-ZÄÖÜa-zäöüß]+\s+\d{4}/u.test(previous.citation) &&
    citationLabelMatchesNormType(previous.citation, meta.type)
  ) return previous.citation;
  const page = previous?.startPage ?? previous?.pages?.match(/\d+/u)?.[0];
  const label = citationLabelMatchesNormType(meta.initialCitation, meta.type)
    ? String(meta.initialCitation).split(/\s+vom\s+/u)[0].trim()
    : NORM_TYPE_CITATION_LABELS[meta.type] ?? 'Veröffentlichung';
  return `${label} vom ${formatGermanDate(documentDate)} (${publication.publication} ${publication.year} Nr. ${publication.issue}${page ? ` S. ${page}` : ''})`;
}

/**
 * Befristete Verkündungen: Das Außerkrafttreten steht im Titel und im Text der amtlichen
 * Quelle („bis zum 1. Januar 2026, 06:00 Uhr“). Der Import modelliert es deterministisch
 * als expiryDate, validTo der letzten Fassung, Status und Historieneintrag – wie die
 * Befristungsentscheidungen des übernommenen Bestands. Die Angabe steht hier und nicht in
 * NEW_PUBLICATION_CONFIG, weil die Norm ihre übrigen redaktionellen Metadaten
 * (Kurzbezeichnung, Abkürzung, Kurzfassung, Sachgebiete) aus dem Bestand behält.
 */
const PUBLICATION_EXPIRY_CONFIG = {
  'allgemeinverfugung-zur-beschrankung-des-gemeingebrauchs-von-hp0whs': {
    expiryDate: '2026-01-01',
    basis: 'vom 31. Dezember 2025, 18:00 Uhr, bis zum 1. Januar 2026, 06:00 Uhr',
    dateNote: 'Die Allgemeinverfügung galt vom 31. Dezember 2025, 18:00 Uhr, bis zum 1. Januar 2026, 06:00 Uhr.',
  },
};

function applyPublicationExpiry(record) {
  const config = PUBLICATION_EXPIRY_CONFIG[record.meta.slug];
  if (!config) return record;
  const repealed = config.expiryDate <= asOf;
  const version = record.versions.at(-1);
  const citation = version?.citation ?? record.meta.initialCitation;
  const entries = (record.history?.entries ?? []).filter((entry) =>
    !(entry.type === 'repeal' && entry.date === config.expiryDate));
  return {
    ...record,
    meta: {
      ...record.meta,
      status: repealed ? 'repealed' : record.meta.status,
      expiryDate: config.expiryDate,
      dateNote: config.dateNote,
    },
    history: {
      ...record.history,
      entries: [...entries, {
        date: config.expiryDate,
        type: 'repeal',
        title: repealed ? 'Außer Kraft getreten durch Befristung im Text.' : 'Tritt durch Befristung im Text außer Kraft.',
        citation,
        affectingVersionId: null,
        note: `Befristung nach dem Wortlaut der Verkündung: gilt ${config.basis}.`,
      }],
    },
    versions: [...record.versions.slice(0, -1), { ...version, validTo: config.expiryDate, isCurrent: !repealed }],
  };
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
    return applyPublicationExpiry({
      source: parsed.fileName,
      startPage: publicationEntry?.startPage,
      meta: {
        ...existing.meta,
        sourceReferences: officialIssueSourceReferences(parsed, {}, {
          existingReferences: existing.meta.sourceReferences,
          pageRange: publicationEntry?.pages ?? publicationEntry?.startPage,
        }),
      },
      history: existing.history,
      versions: [{ ...currentVersion, body: norm.body }],
    });
  });
  const mappedEntries = mappings.map(({ norm, slug, existing }, index) => {
    const previous = (existingPublication.entries ?? []).find((entry) => entry.normSlug === slug);
    const version = records[index].versions[0];
    const documentDate = previous?.documentDate ?? existing.meta.documentDate ?? norm.documentDate ?? parsed.documentDate;
    return {
      ...(previous ?? {}),
      id: previous?.id ?? slug,
      title: existing.meta.title,
      type: publicationEntryTypeForNormType(existing.meta.type, {
        publication: existingPublication.publication,
        initialCitation: existing.meta.initialCitation,
      }),
      citation: legacyEntryCitation(previous, existing.meta, existingPublication, documentDate),
      documentDate,
      normSlug: slug,
      versionId: version.versionId,
    };
  });
  const mappedSlugs = new Set(mappedEntries.map((entry) => entry.normSlug));
  const resolvedPdf = resolvePublicationPdf({
    publication: parsed.publication,
    year: parsed.year,
    issue: parsed.issue,
    htmlFileName: isHtmlSource(parsed.fileName) ? basename(parsed.fileName) : null,
    pdfFileNames: availablePdfFileNames,
    sourceReferences: existingPublication.sourceReferences,
  });
  if (resolvedPdf.strategy === 'ambiguous') {
    throw new Error(`${parsed.fileName}: mehrere PDF-Kandidaten für dieselbe Ausgabe: ${resolvedPdf.candidates.join(', ')}`);
  }
  const publicationEntries = [
    ...mappedEntries,
    ...(existingPublication.entries ?? []).filter((entry) => entry.normSlug && !mappedSlugs.has(entry.normSlug)),
  ];
  const publicationPageRange = resolvedPdf.fileName
    ? pageRangeForPublication(
        { entries: publicationEntries },
        pdfPageCount(readFileSync(resolve(sourceDir, resolvedPdf.fileName))),
      )
    : undefined;
  const publication = {
    ...existingPublication,
    ...(existingPublication.sourceFiles ? { sourceFiles: [`Gesetze/${basename(parsed.fileName)}`] } : {}),
    ...(resolvedPdf.fileName ? { pdf: publicationPdfPublicPath(existingPublication.slug) } : { pdf: undefined }),
    sourceReferences: officialIssueSourceReferences(parsed, {}, {
      existingReferences: existingPublication.sourceReferences,
      ...(publicationPageRange ? { pageRange: publicationPageRange } : {}),
    }),
    entries: publicationEntries,
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
  const configs = configuredNormsFor(parsed);
  const parsedNorms = [parsed, ...parsed.introducedNorms];
  if (!configs) throw new Error(`${parsed.fileName}: Für ${parsed.publication} ${parsed.year} Nr. ${parsed.issue} fehlt eine stabile Importkonfiguration.`);
  if (configs.length !== parsedNorms.length) {
    throw new Error(`${parsed.fileName}: ${parsedNorms.length} Normen erkannt, aber ${configs.length} stabile Slug-Zuordnungen hinterlegt.`);
  }
  const outerSlug = configs[0].slug;
  const enactedNorms = configs
    .slice(1)
    .filter((config) => !config.replacesExistingStem)
    .map((config) => config.slug);
  return parsedNorms.map((norm, index) => {
    const config = configs[index];
    const { slug, shortTitle, responsibleMinistry, summary } = config;
    const effectiveDate = config.effectiveOverride ?? norm.effectiveDate;
    const recordType = config.type ?? norm.type;
    const recordNorm = { ...norm, type: recordType, effectiveDate };
    const startPage = index === 0 ? parsed.startPage : undefined;
    const citation = citationFor({ ...parsed, type: recordType }, startPage);
    const status = config.statusOverride ?? deriveStatus(recordNorm, index);
    const versionId = config.versionId ?? effectiveDate ?? parsed.publicationDate;
    const validFrom = config.validFrom ?? effectiveDate ?? versionId;
    const enactingBody = Object.hasOwn(config, 'enactingBody')
      ? config.enactingBody
      : (NEW_PUBLICATION_CONFIG[publicationConfigKey(parsed)] || ['58', '59'].includes(parsed.issue)
        ? 'Staatsrat des Freistaates Ostdeutschland'
        : 'Landtag des Freistaates Ostdeutschland');
    const abbr = config.abbr ?? norm.abbr;
    const officialTitleSuffix = abbr ? ` (${abbr})` : '';
    const officialTitle = NEW_PUBLICATION_CONFIG[publicationConfigKey(parsed)] && officialTitleSuffix && norm.title.endsWith(officialTitleSuffix)
      ? norm.title.slice(0, -officialTitleSuffix.length).trim()
      : norm.title;
    const sourceReferences = officialIssueSourceReferences(parsed, config);
    // Titelmodell (scripts/lib/norm-title-rules.mjs): Kurzbezeichnung nur, wenn sie sich vom
    // Langtitel unterscheidet; Abkürzung nur, wenn sie die gemeinsame Regel besteht.
    const resultShortTitle = shortTitle && shortTitle !== officialTitle ? shortTitle : undefined;
    const resultAbbr = abbreviationProblem(abbr, { title: officialTitle, shortTitle: resultShortTitle }) === null
      ? abbr
      : undefined;
    const meta = {
      id: slug,
      slug,
      title: officialTitle,
      ...(resultShortTitle ? { shortTitle: resultShortTitle } : {}),
      ...(resultShortTitle
        ? { shortTitleSource: config.abbr || norm.shortTitle === shortTitle ? 'official' : 'editorial' }
        : {}),
      ...(resultAbbr ? { abbr: resultAbbr } : {}),
      type: recordType,
      ...(enactingBody ? { enactingBody } : {}),
      responsibleMinistry,
      subjects: orderedSubjects(config.subjects ?? configuredSubjectsFor(parsed), config.primarySubject),
      primarySubject: orderedSubjects(config.subjects ?? configuredSubjectsFor(parsed), config.primarySubject)[0],
      // Schlagwörter sind Zweitbezeichnungen und redaktionelle Nutzerbegriffe. Titel,
      // Kurzbezeichnung und Abkürzung stehen im Suchindex als eigene Spalten und gehören deshalb
      // nicht zusätzlich hierher; eine vom Titelmodell *nicht* übernommene Abkürzung oder
      // Kurzbezeichnung bleibt hier auffindbar.
      keywords: [...new Set([abbr, shortTitle, ...(config.keywords ?? []), ...shortTitle.split(/\s+/u).filter((word) => word.length >= 5)]
        .filter(Boolean)
        .filter((keyword) => keyword !== officialTitle && keyword !== resultShortTitle && keyword !== resultAbbr))]
        .slice(0, 16),
      initialCitation: citation,
      predecessor: config.predecessor ?? null,
      successor: config.successor ?? null,
      ...(config.affectedNorms ? { affectedNorms: config.affectedNorms } : {}),
      ...(config.relatedNorms ? { relatedNorms: config.relatedNorms } : {}),
      summary,
      status,
      documentDate: parsed.documentDate,
      publicationDate: parsed.publicationDate,
      sourceReferences,
      ...(effectiveDate ? { effectiveDate } : {}),
      ...(config.expiryDate ? { expiryDate: config.expiryDate } : {}),
      ...(config.dateNote ? { dateNote: config.dateNote } : {}),
      ...(config.editorialResolutions ? { editorialResolutions: config.editorialResolutions } : {}),
      ...(parsed.issue === '59' ? {
        expiryDate: '2026-12-31',
        primarySubject: 'Verfassungsrecht',
        relatedNorms: [
          'staatsverfassung-des-freistaates-ostdeutschland',
          'erstes-gesetz-zur-grossen-staatsreform',
        ],
        keywords: [
          'VBefrVO 2026',
          'Volksbefragung',
          'Volkskammerwahl',
          '5. September 2026',
          '6. September 2026',
          'Bundeswahlleiter',
          'politische Willensbildung',
          'freiwillig',
          'nicht bindend',
          'Olympische und Paralympische Spiele',
        ],
        dateNote: 'Die Verordnung wurde am 9. August 2026 verkündet, tritt nach § 11 am selben Tag in Kraft und mit Ablauf des 31. Dezember 2026 außer Kraft.',
      } : {}),
      ...(index === 0 && enactedNorms.length === 1 ? { enactedNorm: enactedNorms[0] } : {}),
      ...(index === 0 && enactedNorms.length > 1 ? { enactedNorms } : {}),
      ...(index > 0 ? { enactingNorm: outerSlug } : {}),
      ...(parsed.issue === '46' && index === 1
        ? { dateNote: 'Das Gesetz gilt seit 21. Juli 2026; die wesentlichen Gebietsänderungen sind seit 1. August 2026 wirksam.' }
        : {}),
    };
    const version = {
      versionId,
      validFrom,
      validTo: parsed.issue === '59' ? '2026-12-31' : config.expiryDate ?? null,
      isCurrent: true,
      citation,
      changeNote: index === 0 ? 'Verkündete Fassung.' : 'Eingeführte Stammfassung.',
      ...(config.sourceNotes ? { sourceNotes: config.sourceNotes } : {}),
      body: norm.body,
    };
    const history = {
      initialVersionId: versionId,
      entries: [{
        date: config.historyDate ?? parsed.publicationDate,
        type: 'initial',
        title: config.historyTitle ?? (index === 0 ? 'Verkündung.' : 'Stammfassung verkündet.'),
        citation,
        affectingVersionId: versionId,
        ...(index > 0 ? { relatedNorm: outerSlug } : {}),
      }],
    };
    return { meta, history, versions: [version], source: parsed.fileName, issue: parsed.issue, startPage };
  });
}

function buildGmblAgreementRecord(parsed) {
  const citation = 'Verwaltungsabkommen vom 28. Juli 2026 (GMBl. 2026 Nr. 14 S. 2)';
  const versionId = '2026-07-29';
  const meta = {
    id: GMBL_AGREEMENT_SLUG,
    slug: GMBL_AGREEMENT_SLUG,
    title: parsed.title,
    shortTitle: 'Verwaltungsabkommen zur Kasernierten Grenzpolizei',
    shortTitleSource: 'editorial',
    type: 'verwaltungsabkommen',
    enactingBody: 'Bundesministerium des Innern und für Heimat und Ostdeutscher Staatsrat',
    responsibleMinistry: 'Staatssekretariat für Staats- und Grenzsicherheit',
    subjects: [
      'Sicherheitsrecht und Polizeirecht',
      'Staatsverträge, Abkommen, Durchführung völkerrechtlicher und zwischenstaatlicher Vereinbarungen, Auslandsbeziehungen',
    ],
    keywords: [
      'Verwaltungsabkommen',
      'Grenzpolizei',
      'GMBl. 2026 Nr. 14',
      'Bundespolizei',
      'grenzpolizeilicher Einzeldienst',
      'Zollverwaltung',
      'Grenzübergangsstellen',
      'Luft- und Wasserdienst',
    ],
    initialCitation: citation,
    predecessor: null,
    successor: null,
    relatedNorms: [
      'kasernierte-grenzpolizei-errichtungsgesetz',
      'kasernierte-grenzpolizei-gesetz',
    ],
    summary: 'Regelt die Wahrnehmung grenzpolizeilicher Aufgaben durch die Kasernierte Grenzpolizei, die fachliche Steuerung durch den Bund und die Zusammenarbeit mit Bundespolizei und Zoll.',
    status: 'in-force',
    documentDate: '2026-07-28',
    publicationDate: '2026-07-29',
    effectiveDate: '2026-07-29',
    dateNote: 'Am 28. Juli 2026 in Leipzig geschlossen, am 29. Juli 2026 amtlich veröffentlicht und seit dem 29. Juli 2026 wirksam.',
    agreementDetails: {
      signedOn: '2026-07-28',
      signedAt: 'Leipzig',
      publishedOn: '2026-07-29',
      effectiveOn: '2026-07-29',
      effectivenessNote: 'Seit der amtlichen Veröffentlichung am 29. Juli 2026 wirksam.',
      parties: [
        {
          name: 'Bundesministerium des Innern und für Heimat',
          institutionId: 'inst-bundesministerium-innern-heimat',
        },
        {
          name: 'Ostdeutscher Staatsrat',
          institutionId: 'inst-staatsrat',
        },
      ],
      signatories: [
        {
          name: 'David König',
          office: 'Bundesminister des Innern und für Heimat',
          representingParty: 'Bundesministerium des Innern und für Heimat',
        },
        {
          name: 'Yannik Schmäle',
          personId: 'person-yannik-schmaele',
          office: 'Staatsrat für Staats- und Grenzsicherheit',
          representingParty: 'Ostdeutscher Staatsrat',
        },
      ],
      legalBases: [
        {
          label: '§§ 2 und 61 BPolG',
          title: 'Bundespolizeigesetz',
          url: 'https://www.gesetze-im-internet.de/bgsg_1994/',
        },
      ],
      responsibleInstitutionId: 'inst-sek-staats-grenzsicherheit',
      projectIds: ['project-grenzpolizei'],
      sourceDiscrepancies: [
        {
          location: 'Präambel',
          originalText: 'Staatsrat für Staats- und Grenzssicherheit',
          canonicalText: 'Staatsrat für Staats- und Grenzsicherheit',
          note: 'Quellentreue Druck- oder Schreibabweichung der Amtsbezeichnung; der Originalwortlaut bleibt unverändert.',
        },
        {
          location: 'Unterschriftszeile',
          originalText: 'Staatsrat für Staats- und Grenzschutz',
          canonicalText: 'Staatsrat für Staats- und Grenzsicherheit',
          note: 'Quellentreue Druck- oder Schreibabweichung der Amtsbezeichnung; Yannik Schmäle ist mit seiner bestehenden Personen- und Amtsentität verknüpft.',
        },
      ],
    },
    sourceReferences: GMBL_SOURCE_REFERENCES,
  };
  return {
    source: parsed.fileName,
    issue: parsed.issue,
    startPage: parsed.startPage,
    meta,
    history: {
      initialVersionId: versionId,
      entries: [
        {
          date: '2026-07-29',
          type: 'initial',
          title: 'Abschluss und amtliche Veröffentlichung.',
          citation,
          note: 'Am 28. Juli 2026 in Leipzig unterzeichnet, am 29. Juli 2026 veröffentlicht und seit diesem Tag wirksam.',
          affectingVersionId: versionId,
        },
      ],
    },
    versions: [
      {
        versionId,
        validFrom: versionId,
        validTo: null,
        isCurrent: true,
        citation,
        changeNote: 'Am 28. Juli 2026 geschlossene und am 29. Juli 2026 amtlich veröffentlichte Fassung.',
        sourceNotes: [
          {
            label: 'Amtsbezeichnungen in der Originalquelle',
            text: 'Die Präambel nennt „Staatsrat für Staats- und Grenzssicherheit“, die Unterschriftszeile „Staatsrat für Staats- und Grenzschutz“. Beide Varianten bleiben im Originalwortlaut unverändert; strukturierte Metadaten verwenden die kanonische Amtsbezeichnung „Staatsrat für Staats- und Grenzsicherheit“.',
          },
          {
            label: 'Transkriptionshierarchie',
            text: 'Die vollständige HTML-Fassung ist strukturtragend, das PDF dient der amtlichen visuellen Kontrolle und die Markdown-Fassung als zusätzliche Transkription. Bloße typografische Unterschiede werden nicht als eigener Rechtskonflikt geführt.',
          },
        ],
        body: parsed.body,
      },
    ],
  };
}

function buildStAnZOHousingGuidelineRecord(parsed) {
  const citation = 'Bekanntmachung vom 8. August 2026 (StAnzO. 2026 Nr. 15 S. 2)';
  const effectiveDate = '2026-09-01';
  return {
    source: parsed.fileName,
    issue: parsed.issue,
    startPage: parsed.startPage,
    meta: {
      id: STANZO_HOUSING_GUIDELINE_SLUG,
      slug: STANZO_HOUSING_GUIDELINE_SLUG,
      title: parsed.title,
      shortTitle: 'Leitlinie zur gemeinwirtschaftlichen Mietpreisbildung',
      shortTitleSource: 'official',
      type: 'bekanntmachung',
      enactingBody: 'Verwaltungsrat der Gemeingut Wohnen AöR',
      responsibleMinistry: 'Gemeingut Wohnen AöR',
      subjects: ['Wohnungsbau, Wohnungswesen', 'Gewerbe- und Berufsrecht'],
      primarySubject: 'Wohnungsbau, Wohnungswesen',
      keywords: ['Gemeingut Wohnen', 'Kostenmiete', 'Mietsenkung', 'Bestandsmieten', 'Nettokaltmiete', '25 Prozent', '5,50 Euro'],
      initialCitation: citation,
      predecessor: null,
      successor: null,
      relatedNorms: ['gemeingut-wohnen-gesetz'],
      summary: 'Legt die gemeinwirtschaftliche Kostenmiete für Gemeingut Wohnen fest und senkt die am 31. August 2026 geschuldeten Nettokaltmieten zum 1. September 2026 von Amts wegen um 25 Prozent.',
      status: effectiveDate > asOf ? 'future-effective' : 'in-force',
      documentDate: '2026-08-08',
      publicationDate: '2026-08-08',
      effectiveDate,
      dateNote: 'Die Bekanntmachung wurde am 8. August 2026 veröffentlicht; die Leitlinie und die Mietsenkung treten am 1. September 2026 in Kraft.',
      sourceReferences: STANZO_HOUSING_SOURCE_REFERENCES,
    },
    history: {
      initialVersionId: effectiveDate,
      entries: [{
        date: '2026-08-08',
        type: 'initial',
        title: 'Bekanntmachung im Staatsanzeiger.',
        citation,
        affectingVersionId: effectiveDate,
      }],
    },
    versions: [{
      versionId: effectiveDate,
      validFrom: effectiveDate,
      validTo: null,
      isCurrent: true,
      citation,
      changeNote: 'Veröffentlichte Stammfassung; Inkrafttreten am 1. September 2026.',
      body: parsed.body,
    }],
  };
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
      subjects: ['Verfassungsrecht'],
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
  const isVolksbefragung = parsed.issue === '59';
  const isNewOfficialIssue = Boolean(NEW_PUBLICATION_CONFIG[publicationConfigKey(parsed)]);
  const config = configuredNormsFor(parsed)?.[0] ?? {};
  const resolvedPdf = resolvePublicationPdf({
    publication: parsed.publication,
    year: parsed.year,
    issue: parsed.issue,
    htmlFileName: isHtmlSource(parsed.fileName) ? basename(parsed.fileName) : null,
    configuredPdfFileName: config.pdfFileName,
    pdfFileNames: availablePdfFileNames,
  });
  if (resolvedPdf.strategy === 'ambiguous') {
    throw new Error(`${parsed.fileName}: mehrere PDF-Kandidaten für dieselbe Ausgabe: ${resolvedPdf.candidates.join(', ')}`);
  }
  const pdfFileName = resolvedPdf.fileName;
  const publicationDetails = {
    'StAnzO.': { longName: 'Staatsanzeiger Ostdeutschland', slugPrefix: 'stanzo' },
    'OVertrBl.': { longName: 'Ostdeutsches Vertragsblatt', slugPrefix: 'overtrbl' },
  }[parsed.publication] ?? { longName: 'Ostdeutsches Gesetz- und Verordnungsblatt', slugPrefix: 'ogvbl' };
  const publicationIssue = parsed.publication === 'OVertrBl.'
    ? String(parsed.issue).padStart(2, '0')
    : parsed.issue;
  const pageRange = parsed.startPage && config.pageCount
    ? `${parsed.startPage}${Number(parsed.startPage) === config.pageCount ? '' : `–${config.pageCount}`}`
    : undefined;
  const historicalPageRange = HISTORICAL_PUBLICATION_PAGE_RANGE_MAP[
    publicationIdentityKey(parsed.publication, parsed.year, parsed.issue)
  ];
  return {
    slug: `${publicationDetails.slugPrefix}-${parsed.year}-${publicationIssue}`,
    title: `${publicationDetails.longName} ${parsed.year} Nr. ${parsed.issue}`,
    year: parsed.year,
    issue: parsed.issue,
    date: parsed.publicationDate,
    publication: parsed.publication,
    ...(isVolksbefragung || isNewOfficialIssue ? {
      place: 'Dresden',
      publisher: 'Freistaat Ostdeutschland',
    } : {}),
    ...(pdfFileName ? { pdf: publicationPdfPublicPath(`${publicationDetails.slugPrefix}-${parsed.year}-${publicationIssue}`) } : {}),
    sourceReferences: officialIssueSourceReferences(parsed, config),
    entries: [...records.map((record) => ({
      id: record.meta.slug,
      title: record.meta.title,
      type: publicationEntryTypeForNormType(record.meta.type, {
        publication: parsed.publication,
        initialCitation: record.meta.initialCitation,
      }),
      citation: record.meta.initialCitation,
      ...(!historicalPageRange && !isVolksbefragung && !isNewOfficialIssue && record.startPage ? { startPage: record.startPage } : {}),
      ...(historicalPageRange && records.length === 1
        ? { pages: historicalPageRange }
        : isVolksbefragung
          ? { pages: '2–7' }
          : pageRange
            ? { pages: pageRange }
            : {}),
      documentDate: record.meta.documentDate,
      normSlug: record.meta.slug,
      versionId: record.versions[0].versionId,
    })), ...(config.additionalPublicationEntries ?? [])],
  };
}

function gmblPublicationFrom(record) {
  return {
    slug: 'gmbl-2026-14',
    title: 'Gemeinsames Ministerialblatt 2026 Nr. 14',
    year: 2026,
    issue: '14',
    date: '2026-07-29',
    publication: 'GMBl.',
    place: 'Bonn',
    publisher: 'Bundesministerium des Innern und für Heimat',
    pdf: publicationPdfPublicPath('gmbl-2026-14'),
    sourceReferences: GMBL_SOURCE_REFERENCES,
    entries: [
      {
        id: GMBL_AGREEMENT_SLUG,
        title: record.meta.title,
        type: 'verwaltungsabkommen',
        citation: record.meta.initialCitation,
        pages: '2–6',
        documentDate: '2026-07-28',
        normSlug: GMBL_AGREEMENT_SLUG,
        versionId: '2026-07-29',
      },
    ],
  };
}

function stanzoHousingPublicationFrom(record) {
  return {
    slug: 'stanzo-2026-15',
    title: 'Staatsanzeiger Ostdeutschland 2026 Nr. 15',
    year: 2026,
    issue: '15',
    date: '2026-08-08',
    publication: 'StAnzO.',
    place: 'Dresden',
    publisher: 'Freistaat Ostdeutschland',
    pdf: publicationPdfPublicPath('stanzo-2026-15'),
    sourceReferences: STANZO_HOUSING_SOURCE_REFERENCES,
    entries: [{
      id: STANZO_HOUSING_GUIDELINE_SLUG,
      title: record.meta.title,
      type: 'bekanntmachung',
      citation: record.meta.initialCitation,
      pages: '2–3',
      documentDate: '2026-08-08',
      normSlug: STANZO_HOUSING_GUIDELINE_SLUG,
      versionId: '2026-09-01',
    }],
  };
}

function validateRecord(record) {
  if (!record.meta.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.meta.slug)) throw new Error(`${record.source}: instabiler oder ungültiger Slug ${record.meta.slug}`);
  if (!record.versions[0].body.length) throw new Error(`${record.source}: ${record.meta.slug} besitzt einen leeren Normkörper`);
  const text = JSON.stringify(bodyWithoutSignatures(record.versions[0].body));
  if (hasNormContamination(text)) {
    throw new Error(`${record.source}: ${record.meta.slug} enthält Kopf-, Bild- oder Signaturdaten`);
  }
}

/** Unterschriftenblöcke sind gewollter Bestand; alles andere darf keinen gesperrten Satz tragen. */
function bodyWithoutSignatures(blocks) {
  return (blocks ?? [])
    .filter((block) => block.type !== 'signature')
    .map((block) => (block.children ? { ...block, children: bodyWithoutSignatures(block.children) } : block));
}

function hasNormContamination(text) {
  return /data:image|;base64,|Inhaltsverzeichnis|\bDresden,\s+den\s+\d/iu.test(text) ||
    hasSpacedLetters(text);
}

function mergeSourceReferences(existingReferences, incomingReferences) {
  const incoming = incomingReferences ?? [];
  const incomingByKey = new Map(incoming.map((reference) => [[
    reference.kind,
    reference.localSource,
    reference.url,
  ].join('\u0000'), reference]));
  const sourceReferenceKey = (reference) => [
    reference.kind,
    reference.localSource,
    reference.url,
  ].join('\u0000');
  const shouldRefresh = (existing, candidate) => {
    if (!candidate.sha256 || existing.sha256 === candidate.sha256 || typeof existing.localSource !== 'string') return false;
    try {
      const actualHash = createHash('sha256')
        .update(readFileSync(resolve(ROOT, existing.localSource)))
        .digest('hex');
      return existing.sha256 !== actualHash;
    } catch {
      return false;
    }
  };
  const merged = [
    ...(existingReferences ?? []).map((reference) => {
      const candidate = incomingByKey.get(sourceReferenceKey(reference));
      return candidate && shouldRefresh(reference, candidate) ? candidate : reference;
    }),
    ...incoming.filter((reference) => !(existingReferences ?? []).some((candidate) =>
      sourceReferenceKey(candidate) === sourceReferenceKey(reference)
    )),
  ];
  const hasStructuredSource = merged.some((reference) => reference.kind === 'structured-html-transcription');
  if (!hasStructuredSource) return merged;

  return merged.map((reference) => reference.kind === 'legacy-markdown-transcription'
    ? {
      ...reference,
      kind: 'supplementary-markdown-transcription',
      label: 'Zusätzliche Markdown-Transkription der amtlichen Ausgabe',
      sourceRole: 'supplementary-transcription',
      derivedSource: reference.derivedSource ?? merged.find((candidate) =>
        candidate.kind === 'structured-html-transcription'
      )?.localSource,
    }
    : reference);
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
  const inferredEnactingNorm = [
    existing.meta.enactedNorm,
    record.meta.enactedNorm,
    ...(existing.meta.enactedNorms ?? []),
    ...(record.meta.enactedNorms ?? []),
  ].some(Boolean)
    ? undefined
    : existing.history.entries.find((entry) => entry.type === 'initial')?.relatedNorm;
  const incomingHistoryEntries = record.history.entries.filter((entry) => !(
    entry.type === 'initial' &&
    !entry.affectingVersionId &&
    existing.history.entries.some((candidate) => candidate.type === 'initial' && candidate.affectingVersionId)
  ));
  const preservedMeta = {
    ...record.meta,
    subjects: orderedSubjects([...(record.meta.subjects ?? []), ...(existing.meta.subjects ?? [])], record.meta.primarySubject),
    primarySubject: orderedSubjects([...(record.meta.subjects ?? []), ...(existing.meta.subjects ?? [])], record.meta.primarySubject)[0],
    keywords: [...new Set([
      ...(record.meta.keywords ?? []),
      ...(existing.meta.keywords ?? []).filter((keyword) => keyword !== existing.meta.abbr || keyword === record.meta.abbr),
    ])]
      .filter((keyword) => !UNVERIFIED_ABBREVIATIONS.has(keyword))
      .filter((keyword) => keyword !== record.meta.title && keyword !== record.meta.shortTitle && keyword !== record.meta.abbr),
    // Eine gepflegte Kurzbeschreibung bleibt erhalten; ihre Herkunftskennzeichnung folgt ihr.
    ...(existing.meta.summary && !/^Regelt\s/u.test(existing.meta.summary)
      ? { summary: existing.meta.summary, ...(existing.meta.summarySource ? { summarySource: existing.meta.summarySource } : {}) }
      : record.meta.summary
        ? { summary: record.meta.summary }
        : {}),
    ...((existing.meta.enactingNorm ?? record.meta.enactingNorm ?? inferredEnactingNorm)
      ? { enactingNorm: existing.meta.enactingNorm ?? record.meta.enactingNorm ?? inferredEnactingNorm }
      : {}),
    ...((existing.meta.enactedNorm ?? record.meta.enactedNorm)
      ? { enactedNorm: existing.meta.enactedNorm ?? record.meta.enactedNorm }
      : {}),
    ...((existing.meta.enactedNorms ?? record.meta.enactedNorms)
      ? { enactedNorms: existing.meta.enactedNorms ?? record.meta.enactedNorms }
      : {}),
    ...((existing.meta.relatedNorms ?? record.meta.relatedNorms)
      ? { relatedNorms: existing.meta.relatedNorms ?? record.meta.relatedNorms }
      : {}),
    predecessor: existing.meta.predecessor ?? record.meta.predecessor,
    successor: existing.meta.successor ?? record.meta.successor,
    ...((existing.meta.affectedNorms?.length || record.meta.affectedNorms?.length) ? {
      affectedNorms: [...new Set([
        ...(existing.meta.affectedNorms ?? []),
        ...(record.meta.affectedNorms ?? []),
      ])],
    } : {}),
    ...((existing.meta.affectedByNorms || record.meta.affectedByNorms) ? {
      affectedByNorms: existing.meta.affectedByNorms ?? record.meta.affectedByNorms,
    } : {}),
    sourceReferences: mergeSourceReferences(existing.meta.sourceReferences, record.meta.sourceReferences),
  };
  const generatedEntryKeys = new Set(incomingHistoryEntries.map((entry) => JSON.stringify([
    entry.date,
    entry.type,
    entry.relatedNorm ?? null,
  ])));
  const hasConcreteInitialEntry = existing.history.entries.some((entry) =>
    entry.type === 'initial' && entry.affectingVersionId
  );
  const incomingInitialVersionIds = new Set(incomingHistoryEntries
    .filter((entry) => entry.type === 'initial' && entry.affectingVersionId)
    .map((entry) => entry.affectingVersionId));
  const preservedEntries = (existing.history.entries ?? []).filter((entry) => !generatedEntryKeys.has(JSON.stringify([
    entry.date,
    entry.type,
    entry.relatedNorm ?? null,
  ])) && !(hasConcreteInitialEntry && entry.type === 'initial' && !entry.affectingVersionId) && !(
    entry.type === 'initial' &&
    entry.affectingVersionId &&
    incomingInitialVersionIds.has(entry.affectingVersionId)
  ));
  return {
    ...record,
    meta: preservedMeta,
    history: {
      initialVersionId:
        existing.history.initialVersionId ??
        record.history.initialVersionId ??
        existing.history.entries.find((entry) => entry.type === 'initial' && entry.affectingVersionId)?.affectingVersionId ??
        null,
      entries: [...preservedEntries, ...incomingHistoryEntries]
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
  record = applyCorrectionsToRecord(record, correctionBundles).record;
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
  record = applyCorrectionsToRecord(record, correctionBundles).record;
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
  const storedText = JSON.stringify(bodyWithoutSignatures(version.body));
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
    record.meta.slug !== 'ostdeutsche-bezirksordnung' &&
    record.meta.slug !== 'bekanntmachung-des-ministerprasidenten-uber-die-stiftung-sta-1wxgxqu'
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
    const contamination = hasNormContamination(JSON.stringify(bodyWithoutSignatures(version?.body ?? [])));
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
  // Der Audit vergleicht stets den durch amtliche Berichtigungen
  // deklaratorisch richtiggestellten Datensatz. Der Schreibpfad muss exakt
  // dieselbe Transformation verwenden; andernfalls würde ein gezielter
  // Reimport wieder den fehlerhaften Verkündungswortlaut speichern und der
  // unmittelbar folgende strikte Audit erneut eine Abweichung melden.
  record = applyCorrectionsToRecord(record, correctionBundles).record;
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
availablePdfFileNames = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase('de').endsWith('.pdf'))
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
const existingAuditRecords = await loadExistingAuditRecords();
const existingPublications = await loadExistingPublications();
const report = {
  asOf,
  mode: shouldWrite ? 'incremental-write' : strictMode ? 'strict-audit' : 'audit-only',
  sourceFormat: 'structured-html-with-explicit-legacy-markdown',
  legacyMarkdownIgnored: [],
  recognized: [], skipped: [], nonNormative: [], unsupported: [], ambiguous: [], sourceAudit: [], changes: [],
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
  // Eine Ausgabe ohne Rechtsvorschrift (zum Beispiel ein Bericht eines Verfassungsorgans) ist
  // ein Verkündungsblatt, aber keine Normimportquelle. Der Verkündungsdatensatz wird
  // redaktionell gepflegt; der Normimporter erkennt die Ausgabe und lässt sie unberührt.
  if (classification.normative === false) {
    report.nonNormative.push({ file: fileName, reason: classification.reason });
    report.sourceAudit.push({
      file: fileName,
      classification: classification.kind,
      status: 'recognized-non-normative',
      issues: [classification.reason],
    });
    continue;
  }
  try {
    const parsed = parsePublicationHtml(fileName, html);
    const parserContractIssues = validatePublicationParserContract(parsed);
    const summaries = summarizeParsedSource(parsed);
    const auditSummary = summarizeHtmlAudit(parsed);
    report.recognized.push({ file: fileName, classification: classification.kind, norms: summaries });
    if (parsed.publication === 'GMBl.' && parsed.year === 2026 && parsed.issue === '14') {
      const sourceKey = 'gmbl-2026-14';
      if (recognizedConfiguredSources.has(sourceKey)) {
        throw new Error(`${fileName}: GMBl. 2026 Nr. 14 wurde bereits aus ${recognizedConfiguredSources.get(sourceKey)} erkannt; Quelle ist mehrdeutig.`);
      }
      recognizedConfiguredSources.set(sourceKey, fileName);
      const agreementRecord = buildGmblAgreementRecord(parsed);
      validateRecord(agreementRecord);
      records.push(agreementRecord);
      publications.push(gmblPublicationFrom(agreementRecord));
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
        norms: [{
          slug: agreementRecord.meta.slug,
          title: agreementRecord.meta.title,
          ...compareGeneratedRecordToExisting(agreementRecord, existingAuditRecords.get(agreementRecord.meta.slug)),
        }],
      });
    } else if (parsed.publication === 'StAnzO.' && parsed.year === 2026 && parsed.issue === '15') {
      const sourceKey = 'stanzo-2026-15';
      if (recognizedConfiguredSources.has(sourceKey)) {
        throw new Error(`${fileName}: StAnzO. 2026 Nr. 15 wurde bereits aus ${recognizedConfiguredSources.get(sourceKey)} erkannt; Quelle ist mehrdeutig.`);
      }
      recognizedConfiguredSources.set(sourceKey, fileName);
      const record = buildStAnZOHousingGuidelineRecord(parsed);
      validateRecord(record);
      records.push(record);
      publications.push(stanzoHousingPublicationFrom(record));
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
        norms: [{
          slug: record.meta.slug,
          title: record.meta.title,
          ...compareGeneratedRecordToExisting(record, existingAuditRecords.get(record.meta.slug)),
        }],
      });
    } else if (configuredNormsFor(parsed)) {
      const sourceKey = NEW_PUBLICATION_CONFIG[publicationConfigKey(parsed)]
        ? publicationConfigKey(parsed)
        : parsed.issue;
      if (recognizedConfiguredSources.has(sourceKey)) {
        throw new Error(`${fileName}: ${parsed.publication} ${parsed.year} Nr. ${parsed.issue} wurde bereits aus ${recognizedConfiguredSources.get(sourceKey)} erkannt; Quelle ist mehrdeutig.`);
      }
      recognizedConfiguredSources.set(sourceKey, fileName);
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
      if (resolved.record && consolidationManagedTargetSlugs.has(resolved.record.meta.slug)) {
        const reason = 'durch vollständige, quellengesicherte Fassungsfolge aus REVOSax-Snapshot und Änderungsvorschriften ersetzt';
        report.legacyMarkdownIgnored.push({ file: fileName, reason });
        report.sourceAudit.push({
          file: fileName,
          classification: 'legacy-markdown-consolidated',
          status: 'superseded-by-consolidation',
          detectedNorms: [parsed.title],
          issues: [reason],
        });
        if (selectedFiles.has(fileName)) throw new Error(`${fileName}: ${reason}`);
        continue;
      }
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
    const structuralIssues = legacyMarkdownStructureIssues(parsed);
    if (selectedFiles.has(fileName) && structuralIssues.length > 0) {
      throw new Error(`${fileName}: ${structuralIssues.join('; ')}`);
    }
    const publicationCandidates = existingPublications.get(identity) ?? [];
    const exactPublicationCandidates = publicationCandidates.filter(({ publication }) => publication.date === parsed.publicationDate);
    const existingPublication = exactPublicationCandidates.length === 1 ? exactPublicationCandidates[0].publication : null;
    let resolved;
    if (
      structuralIssues.length === 0 &&
      configuredNormsFor(parsed)
    ) {
      if (recognizedConfiguredSources.has(parsed.issue)) {
        throw new Error(`${fileName}: Ausgabe ${parsed.issue} wurde bereits aus ${recognizedConfiguredSources.get(parsed.issue)} erkannt; Quelle ist mehrdeutig.`);
      }
      recognizedConfiguredSources.set(parsed.issue, fileName);
      const issueRecords = buildRecords(parsed);
      issueRecords.forEach(validateRecord);
      const preservedRecords = issueRecords.map((record) =>
        preserveExistingHistoryForAudit(record, existingAuditRecords.get(record.meta.slug)));
      const publication = publicationFrom(parsed, issueRecords);
      records.push(...preservedRecords);
      publications.push(publication);
      resolved = { records: preservedRecords, publication, issues: [] };
    } else {
      resolved = structuralIssues.length === 0
        ? resolveLegacySourceRecords(parsed, existingPublication, existingAuditRecords)
        : { records: [], publication: null, issues: structuralIssues };
      if (resolved.records.length > 0 && resolved.publication) {
        resolved.records.forEach(validateRecord);
        records.push(...resolved.records);
        publications.push(resolved.publication);
      }
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
        ? existingPublication
          ? 'stabile Bestandszuordnung; gezielte Legacy-Aktualisierung mit --write --update-existing möglich'
          : 'stabile Importkonfiguration; gezielter Erstimport mit --write möglich'
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
    const primaryPdf = publication.sourceReferences?.find((reference) => reference.kind === 'primary-pdf');
    if (primaryPdf?.localSource) {
      const publicPath = resolve(ROOT, 'public/assets/recht', publicationPdfFileName(publication.slug));
      await mkdir(resolve(ROOT, 'public/assets/recht'), { recursive: true });
      await copyFile(resolve(ROOT, primaryPdf.localSource), publicPath);
    }
    report.changes.push({ slug: publication.slug, action: exists ? 'updated-publication' : 'created-publication' });
  }
}

const configuredSourceFiles = new Set([
  ...Object.keys(ISSUE_CONFIG).map((issue) => issue === '59'
    ? 'OGVBl. 2026 Nr. 59.html'
    : `OGVBl. 2026 Nr. ${issue}.html`),
  ...Object.keys(NEW_PUBLICATION_CONFIG).map((key) => {
    const [publication, year, issue] = key.split('|');
    return `${publication} ${year} Nr. ${issue}.html`;
  }),
  GMBL_SOURCE_FILE,
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
    const configuredIssue = fileName.match(/^OGVBl\.\s*2026\s*Nr\.\s*(4[6-9]|5\d)\.(?:html|md)$/iu)?.[1];
    const configuredPublicationKey = publicationIdentityFromLegacyFileName(fileName);
    if (fileName === GMBL_SOURCE_FILE && !recognizedConfiguredSources.has('gmbl-2026-14')) {
      strictFailures.push(`${fileName}: konfigurierte GMBl.-Ausgabe wurde nicht anhand ihrer internen Bundesblatt-Metadaten erkannt`);
    } else if (configuredIssue && !recognizedConfiguredSources.has(configuredIssue)) {
      strictFailures.push(`${fileName}: konfigurierte Ausgabe wurde in keiner strukturierten Quelle anhand interner Metadaten erkannt`);
    } else if (NEW_PUBLICATION_CONFIG[configuredPublicationKey] && !recognizedConfiguredSources.has(configuredPublicationKey)) {
      strictFailures.push(`${fileName}: konfigurierte Ausgabe wurde in keiner strukturierten Quelle anhand interner Metadaten erkannt`);
    } else if (selectedFiles.size > 0 && !htmlFiles.includes(fileName) && !markdownFiles.includes(fileName)) {
      strictFailures.push(`${fileName}: ausgewählte Normquelle fehlt`);
    }
  }
  for (const issue of Object.keys(ISSUE_CONFIG)) {
    if (selectedFiles.size === 0 && !recognizedConfiguredSources.has(issue)) strictFailures.push(`OGVBl. 2026 Nr. ${issue}: konfigurierte Norm wurde in keiner strukturierten Quelle erkannt`);
  }
  for (const key of Object.keys(NEW_PUBLICATION_CONFIG)) {
    if (selectedFiles.size === 0 && !recognizedConfiguredSources.has(key)) strictFailures.push(`${key.replaceAll('|', ' ')}: konfigurierte Norm wurde in keiner strukturierten Quelle erkannt`);
  }
  if (selectedFiles.size === 0 && !recognizedConfiguredSources.has('gmbl-2026-14')) {
    strictFailures.push('GMBl. 2026 Nr. 14: konfiguriertes Verwaltungsabkommen wurde nicht in der HTML-Quelle erkannt');
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
  console.log(`Normquellen-Audit: ${report.recognized.length} erkannt, ${report.skipped.length} redaktionell, ${report.nonNormative.length} ohne Rechtsvorschrift, ${report.unsupported.length} nicht unterstützt, ${report.ambiguous.length} mehrdeutig${strictMode ? `, ${strictFailures.length} strikte Abweichungen` : ''}.`);
} else {
  console.log(JSON.stringify(report, null, 2));
}
if (!shouldWrite) console.error('Prüflauf: Es wurden keine Dateien geschrieben. Gezielt schreiben mit --write --file <Datei>.');
if (strictFailures.length > 0) {
  for (const failure of strictFailures) console.error(`STRICT: ${failure}`);
  process.exitCode = 1;
}

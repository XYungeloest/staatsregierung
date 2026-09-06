import {
  fundingAreaFromFsn,
  getSubjectByNumber,
  getSubjectByTitle,
  legacySubjectMapping,
  subjectNumberFromFsn,
} from '@ostrecht/shared/config/law-subjects.ts';

/**
 * Deterministische Metadatenableitung für den REVOSax-Ausgangsbestand.
 * Alle Regeln sind bewusst einfach, nachvollziehbar und ohne Netzwerkzugriff;
 * sie liefern redaktionell brauchbare Vorbelegungen, keine Rechtsbewertung.
 */

export const BASELINE_DATE = '2023-11-01';
export const BASELINE_DATE_LABEL = '1. November 2023';

/** Erlassende Organe, die die Content-QA zulässt und die aus REVOSax-Titeln sicher ableitbar sind. */
const ENACTING_BODY_PATTERNS = [
  [/\bder\s+Sächsischen\s+Staatsregierung\b/u, 'Sächsische Staatsregierung'],
  [/\bdes\s+Sächsischen\s+Staatsministeriums\s+des\s+Innern\b/u, 'Sächsisches Staatsministerium des Innern'],
  [/\bdes\s+Sächsischen\s+Staatsministeriums\s+der\s+Finanzen\b/u, 'Sächsisches Staatsministerium der Finanzen'],
  [/\bdes\s+Sächsischen\s+Staatsministeriums\s+für\s+Kultus\b(?!\s+und)/u, 'Sächsisches Staatsministerium für Kultus'],
];

export function inferEnactingBody({ category, sourceTitle }) {
  if (['G', 'ÄG', 'ZuG', 'ÄZuG'].includes(category)) return 'Sächsischer Landtag';
  for (const [pattern, body] of ENACTING_BODY_PATTERNS) {
    if (pattern.test(sourceTitle ?? '')) return body;
  }
  return undefined;
}

/**
 * Titelschlüsselwörter auf amtliche Untergruppennummern. Sie greifen erst, wenn weder eine
 * Fundstellennummer noch eine Beziehung noch eine frühere Zuordnung vorliegt; die Reihenfolge
 * geht von der spezielleren zur allgemeineren Regel.
 */
const SUBJECT_KEYWORD_RULES = [
  [/Verfassung|Landtag|Abgeordnet|Wahl(?:gesetz|ordnung|prüfung)|Volksantrag|Volksbefragung|Volksentscheid|Petition|Sorb/iu, '10'],
  [/Staatsregierung|Ministerpräsident|Staatskanzlei|Geschäftsordnung der Regierung/iu, '11'],
  [/Verfassungsschutz|Verschlusssachen|Sicherheitsüberprüfung/iu, '12'],
  [/Gleichstellung|Frauenförder/iu, '13'],
  [/Staatsvertrag|Abkommen|Vereinbarung zwischen|Auslandsbeziehung/iu, '14'],
  [/Zuständigkeit|Behördenaufbau|Geschäftsverteilung|Errichtung des Landesamt|Eingliederung/iu, '20'],
  [/Verwaltungsverfahren|Verwaltungsvollstreckung|Verwaltungszustell|Informationsfreiheit|Transparenz|Datenschutz|Verwaltungskosten/iu, '21'],
  [/Polizei|Versammlung|Waffen|Ordnungsbehörde|Gefahrenabwehr|Grenzsicher/iu, '22'],
  [/Gemeinde|Kommunal|Landkreis|Kreisfrei|Landkreisordnung|Zweckverband|Gebietsreform/iu, '23'],
  [/Beamt|Besoldung|Laufbahn|Dienstrecht|Personalvertretung|Nebentätigkeit|Reisekosten|Umzugskosten|Beihilfe|Versorgung|Arbeitszeit/iu, '24'],
  [/Krankenhaus|Gesundheitsdienst|Hygiene|Infektion|Psychiatrie|Apotheke|Heilberuf|Bestattung|Rettungsassistent/iu, '25'],
  [/Meldewesen|Melderecht|Personenstand|Namensrecht|Ausweis/iu, '26'],
  [/Ausländer|Asyl|Flüchtling|Aussiedler|Einbürgerung|Aufnahme aus dem Ausland/iu, '27'],
  [/Katastrophenschutz|Brandschutz|Feuerwehr|Rettungsdienst|Zivilschutz/iu, '28'],
  [/Archiv|Statistik|Zensus|Erhebung/iu, '29'],
  [/Gerichtsverfassung|Gericht|Justiz|Richter|Staatsanwalt|Notar|Rechtsanwalt|Rechtspfleg/iu, '30'],
  [/Gerichtsverfahren|Prozess|Zwangsvollstreckung|Schiedsstelle/iu, '31'],
  [/Gerichtskosten|Justizkosten|Kostenverzeichnis/iu, '32'],
  [/Zivilrecht|Handelsrecht|Urheberrecht|gewerblicher Rechtsschutz|Nachbarrecht/iu, '33'],
  [/Ordnungswidrigkeit|Bußgeld|Strafvollzug|Strafrecht|Untersuchungshaft/iu, '34'],
  [/Raumordnung|Landesplanung|Landesentwicklung|Regionalplan/iu, '40'],
  [/Städtebau|Dorferneuerung|Sanierungsgebiet|Stadtumbau/iu, '41'],
  [/Bauordnung|Bauvorlage|Bauprodukt|Baugesetz|Baukammer|Architekt|Ingenieurkammer/iu, '42'],
  [/Wohnraum|Wohnung|Mieten|Belegungsrecht|Wohngeld/iu, '43'],
  [/Kleingarten/iu, '44'],
  [/Vermess|Kataster|Grundstücksverkehr|Liegenschaft|Gutachterausschuss/iu, '45'],
  [/Denkmal/iu, '46'],
  [/Verkehr|Straße|Eisenbahn|Nahverkehr|Omnibus|Luftfahrt|Schifffahrt|Fahrzeug|Fahrerlaubnis/iu, '47'],
  [/Finanzausgleich|Finanzverwaltung|Finanzamt|Kassen(?:ordnung|wesen)/iu, '50'],
  [/Steuer|Abgaben|Gebühren|Beitrag/iu, '51'],
  [/Haushalt|Rechnungshof|Wirtschaftsplan|Nachtragshaushalt/iu, '52'],
  [/kommunales Vermögen|Sondervermögen der Gemeinde/iu, '53'],
  [/Eigenbetrieb/iu, '54'],
  [/Förderrichtlinie|Zuwendung|Förderung von|Investitionszuschuss/iu, '55'],
  [/Vergabe|Auftragswesen|Ausschreibung/iu, '56'],
  [/Gewerbe|Handwerk|Gaststätte|Ladenöffnung|Markt|Tourismus|Mittelstand|Existenzgründ|Kammer der/iu, '60'],
  [/Bergbau|Bergrecht|Energie|Wasser|Talsperre|Deich|Hochwasser/iu, '61'],
  [/Sparkasse|Bank|Kredit|Versicherung|Geldwesen/iu, '62'],
  [/Landwirtschaft|Wein|Pflanzenschutz|Dünge|Ernährungswirtschaft|Agrar/iu, '63'],
  [/Marktordnung|Vieh|Fleisch|Milch/iu, '64'],
  [/Forst|Wald|Jagd|Fischerei|Naturschutz|Naturpark|Biosphär/iu, '65'],
  [/Umwelt|Immission|Abfall|Kreislauf|Verpackung|Klima|Bodenschutz|Lärm/iu, '66'],
  [/Kultur|Museum|Bibliothek|Theater|Orchester|Denkmalpflege/iu, '70'],
  [/Schul|Hochschul|Universität|Studien|Lehrer|Ausbildung|Prüfungsordnung|Bildung|Weiterbildung|Berufsakademie|Kindertagesbetreuung|Volkshochschule/iu, '71'],
  [/Rundfunk|Medien|Presse|Film|Fernseh/iu, '72'],
  [/Kirche|Religion|Weltanschauung|Feiertag/iu, '73'],
  [/Stiftung/iu, '74'],
  [/Verein|Sammlung|Freizügigkeit/iu, '75'],
  [/Sport/iu, '76'],
  [/Sozialwesen|Sozialgesetz|Sozialversicherung|Sozialgericht/iu, '80'],
  [/Familie|Kindertages|Elterngeld|Landeserziehungsgeld|Kinderbetreuung/iu, '81'],
  [/Jugend/iu, '82'],
  [/Senior|ältere Menschen|Rentner/iu, '83'],
  [/Behindert|Blinden|Pflege|Teilhabe|Kriegsopfer|Schwerbeschädigt/iu, '84'],
  [/Krankenkasse|Unfallfürsorge|Unfallkasse/iu, '85'],
  [/Sozialhilfe|Wohlfahrt|Obdachlos|Grundsicherung/iu, '86'],
];

/**
 * Förderbereich auf eine fachliche Untergruppe. Nur dort gesetzt, wo der amtliche
 * Förderbereich eindeutig einer Untergruppe entspricht; 550 (Allgemeines) und 559
 * (Beschäftigungsförderung) bleiben ohne fachliche Zweitzuordnung.
 */
const FUNDING_AREA_SUBJECT_NUMBERS = {
  '551': '23',
  '552': '60',
  '553': '40',
  '554': '43',
  '555': '61',
  '556': '66',
  '557': '70',
  '558': '80',
};

/** Förderbereich aus Titelworten, wenn keine Fundstellennummer vorliegt. */
const FUNDING_AREA_KEYWORD_RULES = [
  [/Wohnraum|Wohnung|Mieten|Eigenheim/iu, '554'],
  [/Energie|Strom|Wärme|Speicher|Photovoltaik/iu, '555'],
  [/Umwelt|Natur|Abfall|Kreislauf|Wald|Forst|Landwirtschaft|Agrar|Fischerei|Klima/iu, '556'],
  [/Kultur|Museum|Bibliothek|Theater|Schul|Hochschul|Bildung|Ausbildung|Weiterbildung|Sport|Jugend/iu, '557'],
  [/Sozial|Gesundheit|Pflege|Familie|Kinder|Behindert|Verbraucher/iu, '558'],
  [/Beschäftigung|Arbeitsmarkt|Arbeitsplätze|Qualifizierung/iu, '559'],
  [/Städtebau|Dorferneuerung|Verkehr|Straße|Bau|Landesplanung/iu, '553'],
  [/Gemeinde|Kommunal|Landkreis|interkommunal/iu, '551'],
  [/Wirtschaft|Gewerbe|Handwerk|Mittelstand|Existenzgründ|Innovation|Technologie|Tourismus/iu, '552'],
];

/** Vereinheitlicht Bezeichner für den Titelabgleich mit der Stammnorm. */
export function normalizeSubjectMatchKey(value) {
  const words = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/ß/gu, 'ss')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map((word) => word.replace(/(?:es|en|er|s|n)$/u, (ending) => (word.length - ending.length >= 4 ? '' : ending)));
  return words.join('');
}

const STEM_TITLE_PATTERN = /(?:Änderung|Aufhebung|Neufassung|Ergänzung)\s+(?:des|der)\s+(.+?)(?:\s+und\s+|\s+sowie\b|\s+vom\s|,|$)/iu;

/**
 * Bezeichnung der Stammnorm aus dem Titel einer Änderungsvorschrift
 * („Zweites Gesetz zur Änderung des Ostdeutschen Justizgesetzes“ → Ostdeutsches Justizgesetz).
 */
export function stemTitleKeyOf(title) {
  const match = String(title ?? '').match(STEM_TITLE_PATTERN);
  if (!match) return null;
  const key = normalizeSubjectMatchKey(match[1]);
  return key.length >= 6 ? key : null;
}

function subjectTitlesOf(numbers) {
  const titles = [];
  for (const number of numbers) {
    const definition = getSubjectByNumber(number);
    if (definition && !titles.includes(definition.title)) titles.push(definition.title);
  }
  return titles.slice(0, 3);
}

function keywordSubjectNumber(haystack) {
  for (const [pattern, number] of SUBJECT_KEYWORD_RULES) {
    if (pattern.test(haystack)) return number;
  }
  return null;
}

function keywordFundingArea(haystack) {
  for (const [pattern, number] of FUNDING_AREA_KEYWORD_RULES) {
    if (pattern.test(haystack)) return number;
  }
  return null;
}

const FUNDING_CATEGORIES = ['FRL', 'ÄFRL'];
const AGREEMENT_CATEGORIES = ['StV', 'ÄStV', 'ZuG', 'ÄZuG'];
const AGREEMENT_TYPES = ['staatsvertrag', 'zustimmungsgesetz', 'verwaltungsabkommen'];

/**
 * Sachgebietszuordnung nach der amtlichen Systematik. Die Reihenfolge ist verbindlich; der
 * erste Treffer bestimmt das Hauptsachgebiet und die Herkunft (`basis`):
 *
 *   fsn          amtliche Fundstellennummer der eigenen Fassungsseite
 *   fsn-sibling  Fundstellennummer einer anderen Fassung derselben Vorschrift
 *   related-norm Zuordnung einer verbundenen Norm (Mantelvorschrift, geänderte Norm)
 *   stem-title   eindeutiger Titeltreffer auf die Stammnorm
 *   type-rule    Regel aus der Dokumentart (Förderrichtlinie, Staatsvertrag)
 *   legacy       frühere redaktionelle Zuordnung
 *   keyword      Titelschlüsselwort
 *   review       kein Anhaltspunkt; die Norm gehört auf die Prüfliste
 *
 * Zweitsachgebiete stammen nur aus amtlichen Signalen (Förderbereich, verbundene Norm oder
 * Stammnorm, frühere Mehrfachzuordnung); Schlüsselwörter liefern nie ein Zweitsachgebiet.
 *
 * `legacyFirst` gilt für eigene ostdeutsche Vorschriften: sie tragen keine amtliche
 * Fundstellennummer, ihre Zuordnung ist redaktionell gesetzt (Importkonfiguration) und wird
 * deshalb nur in die neue Systematik übersetzt, nicht durch Beziehungen oder Titelworte ersetzt.
 */
export function inferSubjectAssignment({
  fsnNumber,
  fsnSource = 'page',
  category,
  normType,
  sourceTitle,
  label,
  legacySubjects = [],
  relatedAssignment,
  stemLookup,
  legacyFirst = false,
}) {
  const haystack = `${sourceTitle ?? ''} ${label ?? ''}`;
  const isFunding = normType === 'foerderrichtlinie' || FUNDING_CATEGORIES.includes(category);
  const fundingArea = normType === 'foerderrichtlinie'
    ? fundingAreaFromFsn(fsnNumber) ?? keywordFundingArea(haystack)
    : null;

  let numbers = [];
  let basis = 'review';

  const fromFsn = subjectNumberFromFsn(fsnNumber);
  const fromStem = stemLookup ? stemLookup.get(stemTitleKeyOf(sourceTitle) ?? ' ') : undefined;
  // Frühere Zuordnungen: bereits amtliche Bezeichnungen zählen unmittelbar, ältere
  // redaktionelle Bezeichnungen über die Zuordnungstabelle. Das hält den Lauf wiederholbar.
  const legacyNumbers = [...new Set(legacySubjects
    .map((subject) => getSubjectByTitle(subject)?.number ?? legacySubjectMapping[subject])
    .filter(Boolean))];

  if (fromFsn) {
    numbers = [fromFsn];
    basis = fsnSource === 'sibling' ? 'fsn-sibling' : 'fsn';
  } else if (legacyFirst && legacyNumbers.length > 0) {
    numbers = legacyNumbers;
    basis = 'legacy';
  } else if (relatedAssignment?.numbers?.length) {
    numbers = [...relatedAssignment.numbers];
    basis = 'related-norm';
  } else if (fromStem?.numbers?.length) {
    numbers = [...fromStem.numbers];
    basis = 'stem-title';
  } else if (isFunding) {
    numbers = ['55'];
    basis = 'type-rule';
  } else if (AGREEMENT_CATEGORIES.includes(category) || AGREEMENT_TYPES.includes(normType)) {
    numbers = ['14'];
    basis = 'type-rule';
  } else if (legacyNumbers.length > 0) {
    numbers = legacyNumbers;
    basis = 'legacy';
  } else {
    const keyword = keywordSubjectNumber(haystack);
    if (keyword) {
      numbers = [keyword];
      basis = 'keyword';
    } else {
      numbers = [normType === 'verwaltungsvorschrift' ? '20' : '21'];
      basis = 'review';
    }
  }

  // Zweitsachgebiet der Förderrichtlinien aus dem amtlichen Förderbereich.
  if (numbers[0] === '55' && fundingArea && FUNDING_AREA_SUBJECT_NUMBERS[fundingArea]) {
    numbers = [...numbers, FUNDING_AREA_SUBJECT_NUMBERS[fundingArea]];
  }

  const subjects = subjectTitlesOf(numbers);
  return {
    subjects,
    primarySubject: subjects[0],
    basis,
    ...(fundingArea ? { fundingArea } : {}),
  };
}

export function inferSummary({ normType, shortTitle }) {
  const label = String(shortTitle ?? '').trim();
  if (normType === 'aenderungsvorschrift') {
    return `Übernommene Änderungsvorschrift des Rechtsbestands zum ${BASELINE_DATE_LABEL}: „${label}“.`;
  }
  return `Enthält die Regelungen der am ${BASELINE_DATE_LABEL} übernommenen Ausgangsfassung „${label}“.`;
}

export function inferKeywords({ abbr, shortTitle, title }) {
  const words = String(title ?? '')
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((word) => word.length >= 5 && !/^(?:sowie|einer|eines|eine|über|durch|gegen|nach|unter|zwischen|Verordnung|Gesetz|Gesetzes|Verwaltungsvorschrift|Richtlinie|Staatsministeriums|Staatsministerium|Staatsregierung|Ostdeutschen|Ostdeutsches|Ostdeutsche|Ostdeutschland|Freistaat|Freistaates)$/iu.test(word));
  return [...new Set([abbr, shortTitle, ...words].filter(Boolean))].slice(0, 16);
}

export function sourceReferenceLabel({ lawId, versionNumber, sourceValidFrom, sourceValidTo }) {
  const identity = versionNumber ? `${lawId}.${versionNumber}` : String(lawId);
  return sourceValidTo
    ? `Amtliche REVOSax-Fassung ${identity}, gültig ${sourceValidFrom} bis ${sourceValidTo}`
    : `Amtliche REVOSax-Fassung ${identity}, gültig ab ${sourceValidFrom}`;
}

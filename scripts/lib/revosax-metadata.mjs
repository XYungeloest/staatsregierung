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

const SUBJECT_RULES = [
  [/Verfassung|Landtag|Wahl(?:gesetz|ordnung)|Volksbefragung|Volksentscheid|Petition/iu, 'Staats- und Verfassungsrecht'],
  [/Gemeinde|Kommunal|Landkreis|Kreisfrei|Verwaltungsverfahren|Verwaltungsvollstreckung|Verwaltungszustell/iu, 'Kommunal- und Verwaltungsrecht'],
  [/Polizei|Ordnungswidrigkeit|Verfassungsschutz|Katastrophenschutz|Brandschutz|Rettungsdienst|Feuerwehr|Versammlung/iu, 'Sicherheit und Ordnung'],
  [/Verschlusssachen|Sicherheitsüberprüfung/iu, 'Sicherheit und Ordnung'],
  [/Informationsfreiheit|Transparenz|Datenschutz|Archiv/iu, 'Transparenz und Informationszugang'],
  [/Haushalt|Kassen|Kosten(?:verzeichnis|gesetz|ordnung)|Gebühren|Finanzausgleich|Steuer|Abgaben|Beihilfe|Besoldung|Versorgung/iu, 'Haushaltsrecht'],
  [/Beamt|Laufbahn|Arbeitszeit|Dienstrecht|Personalvertretung|Reisekosten|Umzugskosten|Nebentätigkeit/iu, 'Arbeit und Soziales'],
  [/Gesundheit|Krankenhaus|Pflege|Bestattung|Heil|Apotheke|Psychiatrie|Infektion|Hygiene|Sozial|Kindertages|Jugend|Familie|Behindert|Teilhabe/iu, 'Gesundheit und Soziales'],
  [/Wirtschaft|Förder|Richtlinie|Mittelstand|Handwerk|Gewerbe|Tourismus|Existenzgründ|Investition|Beihilfe/iu, 'Wirtschaft und Förderung'],
  [/Wohn|Bau(?:ordnung|gesetz)|Boden|Vermess|Kataster|Grundstück|Denkmal|Städtebau/iu, 'Wohnen und Bodenordnung'],
  [/Schul|Hochschul|Universität|Studien|Lehr|Ausbildung|Prüfung|Bildung|Weiterbildung|Berufsakademie|Kindertagesbetreuung/iu, 'Bildung und Weiterbildung'],
  [/Sport/iu, 'Sport und Bildung'],
  [/Rundfunk|Medien|Presse|Film|Fernseh/iu, 'Rundfunk und Medien'],
  [/Feiertag|Kirche|Religion|Weltanschauung/iu, 'Feiertage und gesellschaftliches Leben'],
  [/Umwelt|Natur|Wasser|Abfall|Immission|Klima|Energie|Wald|Forst|Jagd|Fischerei|Landwirtschaft|Tier|Boden|Düng|Pflanzen/iu, 'Umwelt, Energie und Klimaschutz'],
  [/Kreislauf|Abfall|Verpackung/iu, 'Kreislaufwirtschaft'],
  [/Raumordnung|Landesplanung|Landesentwicklung|Regionalplan/iu, 'Raumordnung und Landesplanung'],
  [/Verkehr|Straße|Eisenbahn|Nahverkehr|Bus|Luftfahrt|Schifffahrt|Mobilität|Fahrzeug/iu, 'Mobilität und öffentliche Infrastruktur'],
  [/Staatsvertrag|Abkommen|Vereinbarung zwischen/iu, 'Völkerrecht und Staatsverträge'],
];

export function inferSubjects({ sourceTitle, label, category }) {
  const haystack = `${sourceTitle ?? ''} ${label ?? ''}`;
  const subjects = [];
  for (const [pattern, subject] of SUBJECT_RULES) {
    if (pattern.test(haystack) && !subjects.includes(subject)) subjects.push(subject);
    if (subjects.length === 3) break;
  }
  if (['StV', 'ÄStV', 'ZuG', 'ÄZuG'].includes(category) && !subjects.includes('Völkerrecht und Staatsverträge')) {
    subjects.unshift('Völkerrecht und Staatsverträge');
  }
  if (['FRL', 'ÄFRL'].includes(category) && !subjects.includes('Wirtschaft und Förderung')) {
    subjects.unshift('Wirtschaft und Förderung');
  }
  return subjects.length > 0 ? subjects.slice(0, 3) : ['Landesrecht'];
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

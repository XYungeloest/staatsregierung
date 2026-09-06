import lawSubjectsConfig from '@ostrecht/shared/config/law-subjects.json' with { type: 'json' };

/**
 * Amtliche zweistufige Sachgebietssystematik (packages/shared/src/config/law-subjects.json):
 * acht Hauptgruppen, 56 Untergruppen mit zweistelliger Gliederungsnummer, zehn Förderbereiche
 * 550–559. Diese Datei bleibt Datenzugriff und reine Funktion: keine Oberflächentexte über die
 * amtlichen Bezeichnungen hinaus, keine Darstellungslogik (sie gehört zum Projektionsabschluss).
 */

export interface LawSubjectDefinition {
  /** Zweistellige amtliche Untergruppennummer, zum Beispiel `71`. */
  number: string;
  /** Amtliche Bezeichnung der Untergruppe; zugleich der in `meta.subjects` gespeicherte Wert. */
  title: string;
  /** Kürzere Form für Filter und Kennzeichnungen; sonst gilt `title`. */
  shortTitle?: string;
}

export interface LawSubjectGroupDefinition {
  /** Einstellige amtliche Hauptgruppennummer, zum Beispiel `7`. */
  number: string;
  title: string;
  description: string;
  subjects: LawSubjectDefinition[];
}

export interface LawFundingAreaDefinition {
  /** Dreistellige Nummer des Förderbereichs, `550` bis `559`. */
  number: string;
  title: string;
}

export const lawSubjectGroups: LawSubjectGroupDefinition[] = lawSubjectsConfig.groups.map((group) => ({
  number: group.number,
  title: group.title,
  description: group.description,
  subjects: group.subjects.map((subject) => ({
    number: subject.number,
    title: subject.title,
    ...('shortTitle' in subject && subject.shortTitle ? { shortTitle: subject.shortTitle } : {}),
  })),
}));

/** Alle Untergruppen in Nummernfolge. */
export const lawSubjects: LawSubjectDefinition[] = lawSubjectGroups.flatMap((group) => group.subjects);

export const lawFundingAreas: LawFundingAreaDefinition[] = lawSubjectsConfig.fundingAreas.map((area) => ({
  number: area.number,
  title: area.title,
}));

const subjectsByTitle = new Map(lawSubjects.map((subject) => [subject.title, subject]));
const subjectsByNumber = new Map(lawSubjects.map((subject) => [subject.number, subject]));
const groupBySubjectNumber = new Map(
  lawSubjectGroups.flatMap((group) => group.subjects.map((subject) => [subject.number, group] as const)),
);
const fundingAreasByNumber = new Map(lawFundingAreas.map((area) => [area.number, area]));

export function getSubjectByTitle(title: string): LawSubjectDefinition | undefined {
  return subjectsByTitle.get(title);
}

export function getSubjectByNumber(number: string): LawSubjectDefinition | undefined {
  return subjectsByNumber.get(number);
}

export function getSubjectGroupOf(subject: string): LawSubjectGroupDefinition | undefined {
  const definition = subjectsByTitle.get(subject) ?? subjectsByNumber.get(subject);
  return definition ? groupBySubjectNumber.get(definition.number) : undefined;
}

export function getFundingAreaByNumber(number: string): LawFundingAreaDefinition | undefined {
  return fundingAreasByNumber.get(number);
}

/** Gliederungsnummer einer Fundstellennummer: der Teil vor dem ersten Bindestrich. */
function classificationNumberOf(fsn: string | null | undefined): string | null {
  const value = String(fsn ?? '').trim();
  if (!value) return null;
  const head = value.split('-')[0]?.trim() ?? '';
  return /^\d{1,4}$/u.test(head) ? head : null;
}

/**
 * Untergruppennummer aus einer amtlichen Fundstellennummer: die ersten beiden Stellen der
 * Gliederungsnummer. Vierstellige Förderkennungen `55xx` gehören zur Untergruppe `55`, eine
 * einstellige Gliederungsnummer `d` steht für die erste Untergruppe `d0`.
 */
export function subjectNumberFromFsn(fsn: string | null | undefined): string | null {
  const classification = classificationNumberOf(fsn);
  if (!classification) return null;
  const candidate = classification.length === 1 ? `${classification}0` : classification.slice(0, 2);
  return subjectsByNumber.has(candidate) ? candidate : null;
}

/**
 * Förderbereich aus einer amtlichen Fundstellennummer: die ersten drei Stellen einer
 * vierstelligen Förderkennung `55xx` (Untergruppe 55 Förderrichtlinien).
 */
export function fundingAreaFromFsn(fsn: string | null | undefined): string | null {
  const classification = classificationNumberOf(fsn);
  if (!classification || classification.length !== 4 || !classification.startsWith('55')) return null;
  const candidate = classification.slice(0, 3);
  return fundingAreasByNumber.has(candidate) ? candidate : null;
}

/**
 * Sortiert Sachgebiete nach der amtlichen Nummernfolge. Nicht konfigurierte Bezeichnungen
 * stehen dahinter und werden alphabetisch geordnet.
 */
export function compareSubjects(left: string, right: string): number {
  const leftNumber = subjectsByTitle.get(left)?.number;
  const rightNumber = subjectsByTitle.get(right)?.number;
  if (leftNumber && rightNumber) return leftNumber.localeCompare(rightNumber);
  if (leftNumber) return -1;
  if (rightNumber) return 1;
  return left.localeCompare(right, 'de');
}

export interface SubjectLabelOptions {
  /** Der amtlichen Nummer voranstellen, zum Beispiel „71 Bildungswesen“. */
  withNumber?: boolean;
  /** Kurzform verwenden, sofern die Systematik eine vorsieht. */
  short?: boolean;
}

export function formatSubjectLabel(title: string, options: SubjectLabelOptions = {}): string {
  const definition = subjectsByTitle.get(title);
  if (!definition) return title;
  const name = options.short ? definition.shortTitle ?? definition.title : definition.title;
  return options.withNumber ? `${definition.number} ${name}` : name;
}

/**
 * Frühere, redaktionell vergebene Sachgebiete auf die amtlichen Untergruppen. „Landesrecht“ war
 * die alte Auffangbezeichnung und fehlt bewusst: solche Normen durchlaufen die Ableitungskette.
 */
export const legacySubjectMapping: Record<string, string> = {
  'Staats- und Verfassungsrecht': '10',
  'Wahlrecht und politische Beteiligung': '10',
  'Sorbische Angelegenheiten': '10',
  Staatsorganisation: '11',
  'Gleichstellung und Teilhabe': '13',
  'Völkerrecht und Staatsverträge': '14',
  'Bund-Länder-Zusammenarbeit': '14',
  Verordnungsrecht: '20',
  Verwaltungsrecht: '21',
  'Transparenz und Informationszugang': '21',
  'Sicherheit und Ordnung': '22',
  'Polizei- und Ordnungsrecht': '22',
  'Innere Sicherheit': '22',
  Grenzpolizei: '22',
  Grenzschutz: '22',
  'Kommunal- und Verwaltungsrecht': '23',
  'Arbeit und Soziales': '24',
  'Öffentlicher Dienst': '24',
  'Öffentliches Dienstrecht': '24',
  'Ausländer- und Asylrecht': '27',
  Flüchtlingsaufnahme: '27',
  Katastrophenschutz: '28',
  'Justiz und Rechtspflege': '30',
  'Raumordnung und Landesplanung': '40',
  'Wohnen und Bodenordnung': '43',
  'Mobilität und öffentliche Infrastruktur': '47',
  Haushaltsrecht: '52',
  'Wirtschaft und Förderung': '60',
  'Öffentliche Wirtschaft': '60',
  'Umwelt, Energie und Klimaschutz': '66',
  Kreislaufwirtschaft: '66',
  'Kultur und Denkmalschutz': '70',
  'Bildung und Weiterbildung': '71',
  'Bildung und Schule': '71',
  'Bildung und Wissenschaft': '71',
  Schulrecht: '71',
  'Rundfunk und Medien': '72',
  'Feiertage und gesellschaftliches Leben': '73',
  Vereinsrecht: '75',
  'Sport und Bildung': '76',
  'Gesundheit und Soziales': '80',
  Sozialrecht: '80',
};

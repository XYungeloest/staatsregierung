export class PortalContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortalContentValidationError';
  }
}

export interface PortalContact {
  name?: string;
  email?: string;
  telefon?: string;
  referat?: string;
}

export interface PortalLink {
  label: string;
  href: string;
}

export interface GovernmentOfficeTerm {
  title: string;
  ministry?: string;
  servingFrom: string;
  servingTo?: string;
}

export interface RegierungMitglied {
  slug: string;
  name: string;
  amt: string;
  ressort: string;
  reihenfolge: number;
  kurzbiografie: string;
  langbiografie: string[];
  bild: string;
  bildAlt?: string;
  bildnachweis?: string;
  kontakt?: PortalContact;
  zitat?: string;
  current: boolean;
  servingFrom?: string;
  servingTo?: string;
  currentOffices: GovernmentOfficeTerm[];
  formerOffices: GovernmentOfficeTerm[];
  party?: string;
  appointmentSource?: string;
}

export interface RegierungProfil {
  slug: string;
  name: string;
  kurzbiografie: string;
  langbiografie: string[];
  bild: string;
  bildAlt?: string;
  bildnachweis?: string;
  kontakt?: PortalContact;
  zitat?: string;
  party?: string;
}

export interface Ministerium {
  slug: string;
  name: string;
  kurzname: string;
  leitung: string;
  teaser: string;
  aufgaben: string[];
  kontakt: PortalContact;
  bild: string;
  bildAlt?: string;
  bildnachweis?: string;
  themen: string[];
  verknuepfteLinks: PortalLink[];
}

export type MinisteriumProfil = Omit<Ministerium, 'leitung'>;

export type Themenstatus =
  | 'geplant'
  | 'entwurf'
  | 'im-gesetzgebungsverfahren'
  | 'beschlossen'
  | 'in-umsetzung'
  | 'abgeschlossen';

export const THEMENCLUSTER = [
  'staat-demokratie',
  'bildung-gesellschaft',
  'wirtschaft-arbeit',
  'infrastruktur-wohnen',
  'umwelt-versorgung',
  'nachbarschaft-europa',
] as const;

export type Themencluster = (typeof THEMENCLUSTER)[number];

export interface ThemenRechtsgrundlage {
  label: string;
  normSlug?: string;
  note?: string;
}

export interface ThemenFaqEintrag {
  question: string;
  answer: string;
}

export interface ThemenDatum {
  date: string;
  endDate?: string;
  label: string;
  note?: string;
}

export interface ThemenFragenModul {
  type: 'questions';
  id: string;
  title: string;
  intro?: string;
  items: Array<{
    number: string;
    title: string;
    text: string;
  }>;
}

export interface ThemenTimelineModul {
  type: 'timeline';
  id: string;
  title: string;
  intro?: string;
  items: Array<{
    date: string;
    endDate?: string;
    title: string;
    text: string;
  }>;
}

export interface ThemenFaktenModul {
  type: 'facts';
  id: string;
  title: string;
  intro?: string;
  items: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
}

export interface ThemenVergleichsModul {
  type: 'comparison';
  id: string;
  title: string;
  intro?: string;
  beforeLabel: string;
  afterLabel: string;
  items: Array<{
    label: string;
    before: string;
    after: string;
  }>;
}

export type ThemenModul =
  | ThemenFragenModul
  | ThemenTimelineModul
  | ThemenFaktenModul
  | ThemenVergleichsModul;

export interface Themenseite {
  slug: string;
  title: string;
  teaser: string;
  status: Themenstatus;
  hero?: string;
  beschlossen: string[];
  umgesetzt: string[];
  naechsteSchritte: string[];
  rechtsgrundlagen: ThemenRechtsgrundlage[];
  faq: ThemenFaqEintrag[];
  federfuehrendesRessort: string;
  mitzeichnungsressorts?: string[];
  cluster: Themencluster;
  priority: number;
  featured: boolean;
  highlightFrom?: string;
  highlightUntil?: string;
  updatedAt: string;
  keyDates: ThemenDatum[];
  modules: ThemenModul[];
  relatedTopicSlugs?: string[];
  knowledgeProjectRefs: string[];
}

export interface Pressemitteilung {
  slug: string;
  title: string;
  date: string;
  ressort: string;
  teaser: string;
  image: string;
  imageAlt: string;
  imageCredit?: string;
  tags: string[];
  body: string[];
  isFeatured: boolean;
  relatedTopicSlugs?: string[];
  relatedNormSlugs?: string[];
  relatedPressSlugs?: string[];
}

export interface Rede {
  slug: string;
  title: string;
  date: string;
  sprecher: string;
  speakerPersonSlug?: string;
  teaser: string;
  body: string[];
}

export interface Termin {
  slug: string;
  title: string;
  date: string;
  start?: string;
  end?: string;
  location: string;
  teaser: string;
  body: string[];
  relatedLegislationSlugs?: string[];
  relatedTopicSlugs?: string[];
}

export interface Haushaltsseite {
  slug: string;
  title: string;
  teaser: string;
  body: string[];
  dataset?: Record<string, unknown>;
}

export interface Stellenangebot {
  slug: string;
  title: string;
  ressort: string;
  standort: string;
  arbeitsbereich: string;
  datePosted: string;
  applicationDeadline: string;
  employmentType: string;
  payGrade?: string;
  teaser: string;
  body: string[];
  contact?: PortalContact;
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
}

export interface Seite {
  slug: string;
  title: string;
  body: string[];
  accessibilityAudit?: AccessibilityAudit;
}

export interface AccessibilityAudit {
  checkedOn: string;
  scope: string[];
  methods: string[];
  knownLimitations: string[];
}

export type PortalEditorialIcon = 'law' | 'topics' | 'map' | 'budget' | 'government' | 'ministry' | 'press';
export type PortalNoticeIcon = Exclude<PortalEditorialIcon, 'ministry'>;

export interface HomeContent {
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    image: string;
    imageAlt: string;
    searchLabel: string;
    searchPlaceholder: string;
  };
  portalAccesses: Array<{
    title: string;
    description: string;
    href: string;
    icon: PortalEditorialIcon;
  }>;
  importantItems: Array<{
    id: string;
    title?: string;
    governmentSlug?: string;
    description?: string;
    href: string;
    icon: PortalNoticeIcon;
  }>;
}

export interface CabinetPageContent {
  slug: string;
  title: string;
  lead: string;
  politicalContext: string[];
  chronologyTitle: string;
  chronology: Array<{ date: string; text: string }>;
  topicHighlightSlugs: string[];
}

export interface BeteiligungsEintrag {
  title: string;
  label: string;
  text: string;
  note?: string;
  normSlug?: string;
}

export interface BeteiligungsAbschnitt {
  id: string;
  title: string;
  intro: string;
  items: BeteiligungsEintrag[];
}

export interface BeteiligungsAenderung {
  date: string;
  label: string;
  title: string;
  text: string;
  note?: string;
  normSlug?: string;
}

export interface BeteiligungsUebersicht {
  slug: string;
  title: string;
  lead: string;
  asOf: string;
  inheritanceDate: string;
  facts: Array<{ label: string; value: string; note?: string }>;
  introduction: string[];
  sections: BeteiligungsAbschnitt[];
  changes: BeteiligungsAenderung[];
  continuingTitle: string;
  continuingIntro: string;
  continuingItems: string[];
  unresolvedTitle: string;
  unresolvedIntro: string;
  unresolvedItems: string[];
  sourceNote: string;
  relatedNorms: Array<{ label: string; normSlug: string }>;
}

function createPath(prefix: string, key: string): string {
  return `${prefix}.${key}`;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Objekt sein`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PortalContentValidationError(`${path}: muss ein nichtleerer String sein`);
  }

  return value.trim();
}

function expectOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return expectString(value, path);
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PortalContentValidationError(`${path}: muss eine Zahl sein`);
  }

  return value;
}

function expectIntegerInRange(value: unknown, path: string, minimum: number, maximum: number): number {
  const number = expectNumber(value, path);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new PortalContentValidationError(`${path}: muss eine ganze Zahl zwischen ${minimum} und ${maximum} sein`);
  }
  return number;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new PortalContentValidationError(`${path}: muss true oder false sein`);
  }

  return value;
}

function expectDate(value: unknown, path: string): string {
  const date = expectString(value, path);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new PortalContentValidationError(`${path}: muss im Format JJJJ-MM-TT vorliegen`);
  }

  return date;
}

function expectOptionalDate(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return expectDate(value, path);
}

function expectOptionalDateTime(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const dateTime = expectString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/u.test(dateTime) || Number.isNaN(Date.parse(dateTime))) {
    throw new PortalContentValidationError(`${path}: muss ein gültiger ISO-Datums- und Zeitwert sein`);
  }
  return dateTime;
}

function expectSlug(value: unknown, path: string): string {
  const slug = expectString(value, path);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new PortalContentValidationError(`${path}: muss ein technischer Slug sein`);
  }

  return slug;
}

function expectStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => expectString(entry, `${path}[${index}]`));
}

function expectOptionalSlugArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => expectSlug(entry, `${path}[${index}]`));
}

function expectTopicStatus(value: unknown, path: string): Themenstatus {
  const status = expectString(value, path) as Themenstatus;
  const allowedStatuses: Themenstatus[] = [
    'geplant',
    'entwurf',
    'im-gesetzgebungsverfahren',
    'beschlossen',
    'in-umsetzung',
    'abgeschlossen',
  ];

  if (!allowedStatuses.includes(status)) {
    throw new PortalContentValidationError(`${path}: enthält einen unbekannten Themenstatus`);
  }

  return status;
}

function expectTopicCluster(value: unknown, path: string): Themencluster {
  const cluster = expectString(value, path) as Themencluster;
  if (!THEMENCLUSTER.includes(cluster)) {
    throw new PortalContentValidationError(`${path}: enthält einen unbekannten Themencluster`);
  }
  return cluster;
}

function parseContact(value: unknown, path: string): PortalContact | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const entry = expectRecord(value, path);
  return {
    name: expectOptionalString(entry.name, createPath(path, 'name')),
    email: expectOptionalString(entry.email, createPath(path, 'email')),
    telefon: expectOptionalString(entry.telefon, createPath(path, 'telefon')),
    referat: expectOptionalString(entry.referat, createPath(path, 'referat')),
  };
}

function parseLinks(value: unknown, path: string): PortalLink[] {
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => {
    const record = expectRecord(entry, `${path}[${index}]`);
    return {
      label: expectString(record.label, `${path}[${index}].label`),
      href: expectString(record.href, `${path}[${index}].href`),
    };
  });
}

function parseOptionalRecord(
  value: unknown,
  path: string,
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return expectRecord(value, path);
}

function parseOfficeTerms(value: unknown, path: string): GovernmentOfficeTerm[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((item, index) => {
    const entry = expectRecord(item, `${path}[${index}]`);
    return {
      title: expectString(entry.title, `${path}[${index}].title`),
      ministry: expectOptionalString(entry.ministry, `${path}[${index}].ministry`),
      servingFrom: expectDate(entry.servingFrom, `${path}[${index}].servingFrom`),
      servingTo:
        entry.servingTo === undefined
          ? undefined
          : expectDate(entry.servingTo, `${path}[${index}].servingTo`),
    };
  });
}

export function parseRegierungMitglied(value: unknown, path: string): RegierungMitglied {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    name: expectString(entry.name, createPath(path, 'name')),
    amt: expectString(entry.amt, createPath(path, 'amt')),
    ressort: expectString(entry.ressort, createPath(path, 'ressort')),
    reihenfolge: expectNumber(entry.reihenfolge, createPath(path, 'reihenfolge')),
    kurzbiografie: expectString(entry.kurzbiografie, createPath(path, 'kurzbiografie')),
    langbiografie: expectStringArray(entry.langbiografie, createPath(path, 'langbiografie')),
    bild: expectString(entry.bild, createPath(path, 'bild')),
    bildAlt: expectOptionalString(entry.bildAlt, createPath(path, 'bildAlt')),
    bildnachweis: expectOptionalString(entry.bildnachweis, createPath(path, 'bildnachweis')),
    kontakt: parseContact(entry.kontakt, createPath(path, 'kontakt')),
    zitat: expectOptionalString(entry.zitat, createPath(path, 'zitat')),
    current: entry.current === undefined ? true : expectBoolean(entry.current, createPath(path, 'current')),
    servingFrom:
      entry.servingFrom === undefined
        ? undefined
        : expectDate(entry.servingFrom, createPath(path, 'servingFrom')),
    servingTo:
      entry.servingTo === undefined
        ? undefined
        : expectDate(entry.servingTo, createPath(path, 'servingTo')),
    currentOffices: parseOfficeTerms(entry.currentOffices, createPath(path, 'currentOffices')),
    formerOffices: parseOfficeTerms(entry.formerOffices, createPath(path, 'formerOffices')),
    party: expectOptionalString(entry.party, createPath(path, 'party')),
    appointmentSource: expectOptionalString(entry.appointmentSource, createPath(path, 'appointmentSource')),
  };
}

export function parseRegierungProfil(value: unknown, path: string): RegierungProfil {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    name: expectString(entry.name, createPath(path, 'name')),
    kurzbiografie: expectString(entry.kurzbiografie, createPath(path, 'kurzbiografie')),
    langbiografie: expectStringArray(entry.langbiografie, createPath(path, 'langbiografie')),
    bild: expectString(entry.bild, createPath(path, 'bild')),
    bildAlt: expectOptionalString(entry.bildAlt, createPath(path, 'bildAlt')),
    bildnachweis: expectOptionalString(entry.bildnachweis, createPath(path, 'bildnachweis')),
    kontakt: parseContact(entry.kontakt, createPath(path, 'kontakt')),
    zitat: expectOptionalString(entry.zitat, createPath(path, 'zitat')),
    party: expectOptionalString(entry.party, createPath(path, 'party')),
  };
}

export function parseMinisterium(value: unknown, path: string): Ministerium {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    name: expectString(entry.name, createPath(path, 'name')),
    kurzname: expectString(entry.kurzname, createPath(path, 'kurzname')),
    leitung: expectString(entry.leitung, createPath(path, 'leitung')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    aufgaben: expectStringArray(entry.aufgaben, createPath(path, 'aufgaben')),
    kontakt: parseContact(entry.kontakt, createPath(path, 'kontakt')) ?? {},
    bild: expectString(entry.bild, createPath(path, 'bild')),
    bildAlt: expectOptionalString(entry.bildAlt, createPath(path, 'bildAlt')),
    bildnachweis: expectOptionalString(entry.bildnachweis, createPath(path, 'bildnachweis')),
    themen: expectStringArray(entry.themen, createPath(path, 'themen')),
    verknuepfteLinks: parseLinks(entry.verknuepfteLinks, createPath(path, 'verknuepfteLinks')),
  };
}

export function parseMinisteriumProfil(value: unknown, path: string): MinisteriumProfil {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    name: expectString(entry.name, createPath(path, 'name')),
    kurzname: expectString(entry.kurzname, createPath(path, 'kurzname')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    aufgaben: expectStringArray(entry.aufgaben, createPath(path, 'aufgaben')),
    kontakt: parseContact(entry.kontakt, createPath(path, 'kontakt')) ?? {},
    bild: expectString(entry.bild, createPath(path, 'bild')),
    bildAlt: expectOptionalString(entry.bildAlt, createPath(path, 'bildAlt')),
    bildnachweis: expectOptionalString(entry.bildnachweis, createPath(path, 'bildnachweis')),
    themen: expectStringArray(entry.themen, createPath(path, 'themen')),
    verknuepfteLinks: parseLinks(entry.verknuepfteLinks, createPath(path, 'verknuepfteLinks')),
  };
}

function parseThemenRechtsgrundlagen(
  value: unknown,
  path: string,
): ThemenRechtsgrundlage[] {
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => {
    const record = expectRecord(entry, `${path}[${index}]`);

    return {
      label: expectString(record.label, `${path}[${index}].label`),
      normSlug: expectOptionalString(record.normSlug, `${path}[${index}].normSlug`),
      note: expectOptionalString(record.note, `${path}[${index}].note`),
    };
  });
}

function parseThemenFaq(value: unknown, path: string): ThemenFaqEintrag[] {
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => {
    const record = expectRecord(entry, `${path}[${index}]`);

    return {
      question: expectString(record.question, `${path}[${index}].question`),
      answer: expectString(record.answer, `${path}[${index}].answer`),
    };
  });
}

function parseThemenDaten(value: unknown, path: string): ThemenDatum[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const record = expectRecord(entry, itemPath);
    const date = expectDate(record.date, `${itemPath}.date`);
    const endDate = expectOptionalDate(record.endDate, `${itemPath}.endDate`);
    if (endDate && endDate < date) {
      throw new PortalContentValidationError(`${itemPath}.endDate: darf nicht vor date liegen`);
    }
    return {
      date,
      endDate,
      label: expectString(record.label, `${itemPath}.label`),
      note: expectOptionalString(record.note, `${itemPath}.note`),
    };
  });
}

function parseThemenModule(value: unknown, path: string): ThemenModul[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const record = expectRecord(entry, itemPath);
    const type = expectString(record.type, `${itemPath}.type`);
    const id = expectSlug(record.id, `${itemPath}.id`);
    const title = expectString(record.title, `${itemPath}.title`);
    const intro = expectOptionalString(record.intro, `${itemPath}.intro`);
    if (!Array.isArray(record.items) || record.items.length === 0) {
      throw new PortalContentValidationError(`${itemPath}.items: muss mindestens einen Eintrag enthalten`);
    }

    if (type === 'questions') {
      return {
        type,
        id,
        title,
        intro,
        items: record.items.map((raw, itemIndex) => {
          const entryPath = `${itemPath}.items[${itemIndex}]`;
          const item = expectRecord(raw, entryPath);
          return {
            number: expectString(item.number, `${entryPath}.number`),
            title: expectString(item.title, `${entryPath}.title`),
            text: expectString(item.text, `${entryPath}.text`),
          };
        }),
      } satisfies ThemenFragenModul;
    }

    if (type === 'timeline') {
      return {
        type,
        id,
        title,
        intro,
        items: record.items.map((raw, itemIndex) => {
          const entryPath = `${itemPath}.items[${itemIndex}]`;
          const item = expectRecord(raw, entryPath);
          const date = expectDate(item.date, `${entryPath}.date`);
          const endDate = expectOptionalDate(item.endDate, `${entryPath}.endDate`);
          if (endDate && endDate < date) {
            throw new PortalContentValidationError(`${entryPath}.endDate: darf nicht vor date liegen`);
          }
          return {
            date,
            endDate,
            title: expectString(item.title, `${entryPath}.title`),
            text: expectString(item.text, `${entryPath}.text`),
          };
        }),
      } satisfies ThemenTimelineModul;
    }

    if (type === 'facts') {
      return {
        type,
        id,
        title,
        intro,
        items: record.items.map((raw, itemIndex) => {
          const entryPath = `${itemPath}.items[${itemIndex}]`;
          const item = expectRecord(raw, entryPath);
          return {
            label: expectString(item.label, `${entryPath}.label`),
            value: expectString(item.value, `${entryPath}.value`),
            note: expectOptionalString(item.note, `${entryPath}.note`),
          };
        }),
      } satisfies ThemenFaktenModul;
    }

    if (type === 'comparison') {
      return {
        type,
        id,
        title,
        intro,
        beforeLabel: expectString(record.beforeLabel, `${itemPath}.beforeLabel`),
        afterLabel: expectString(record.afterLabel, `${itemPath}.afterLabel`),
        items: record.items.map((raw, itemIndex) => {
          const entryPath = `${itemPath}.items[${itemIndex}]`;
          const item = expectRecord(raw, entryPath);
          return {
            label: expectString(item.label, `${entryPath}.label`),
            before: expectString(item.before, `${entryPath}.before`),
            after: expectString(item.after, `${entryPath}.after`),
          };
        }),
      } satisfies ThemenVergleichsModul;
    }

    throw new PortalContentValidationError(`${itemPath}.type: unbekannter Modultyp ${type}`);
  });
}

export function parseThemenseite(value: unknown, path: string): Themenseite {
  const entry = expectRecord(value, path);
  const highlightFrom = expectOptionalDate(entry.highlightFrom, createPath(path, 'highlightFrom'));
  const highlightUntil = expectOptionalDate(entry.highlightUntil, createPath(path, 'highlightUntil'));
  if (highlightUntil && !highlightFrom) {
    throw new PortalContentValidationError(`${path}.highlightUntil: setzt highlightFrom voraus`);
  }
  if (highlightFrom && highlightUntil && highlightUntil < highlightFrom) {
    throw new PortalContentValidationError(`${path}.highlightUntil: darf nicht vor highlightFrom liegen`);
  }

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    status: expectTopicStatus(entry.status, createPath(path, 'status')),
    hero: expectOptionalString(entry.hero, createPath(path, 'hero')),
    beschlossen: expectStringArray(entry.beschlossen, createPath(path, 'beschlossen')),
    umgesetzt: expectStringArray(entry.umgesetzt, createPath(path, 'umgesetzt')),
    naechsteSchritte: expectStringArray(
      entry.naechsteSchritte,
      createPath(path, 'naechsteSchritte'),
    ),
    rechtsgrundlagen: parseThemenRechtsgrundlagen(
      entry.rechtsgrundlagen,
      createPath(path, 'rechtsgrundlagen'),
    ),
    faq: parseThemenFaq(entry.faq, createPath(path, 'faq')),
    federfuehrendesRessort: expectSlug(
      entry.federfuehrendesRessort,
      createPath(path, 'federfuehrendesRessort'),
    ),
    mitzeichnungsressorts: Array.isArray(entry.mitzeichnungsressorts)
      ? expectStringArray(entry.mitzeichnungsressorts, createPath(path, 'mitzeichnungsressorts'))
      : undefined,
    cluster: expectTopicCluster(entry.cluster, createPath(path, 'cluster')),
    priority: expectIntegerInRange(entry.priority, createPath(path, 'priority'), 0, 100),
    featured: expectBoolean(entry.featured, createPath(path, 'featured')),
    highlightFrom,
    highlightUntil,
    updatedAt: expectDate(entry.updatedAt, createPath(path, 'updatedAt')),
    keyDates: parseThemenDaten(entry.keyDates, createPath(path, 'keyDates')),
    modules: parseThemenModule(entry.modules, createPath(path, 'modules')),
    relatedTopicSlugs: expectOptionalSlugArray(entry.relatedTopicSlugs, createPath(path, 'relatedTopicSlugs')),
    knowledgeProjectRefs: expectOptionalSlugArray(entry.knowledgeProjectRefs, createPath(path, 'knowledgeProjectRefs')) ?? [],
  };
}

export function parsePressemitteilung(value: unknown, path: string): Pressemitteilung {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    date: expectDate(entry.date, createPath(path, 'date')),
    ressort: expectString(entry.ressort ?? entry.ministry, createPath(path, 'ressort')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    image: expectString(entry.image, createPath(path, 'image')),
    imageAlt: expectString(entry.imageAlt, createPath(path, 'imageAlt')),
    imageCredit: expectOptionalString(entry.imageCredit, createPath(path, 'imageCredit')),
    tags: expectStringArray(entry.tags, createPath(path, 'tags')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    isFeatured: expectBoolean(entry.isFeatured, createPath(path, 'isFeatured')),
    relatedTopicSlugs: expectOptionalSlugArray(
      entry.relatedTopicSlugs,
      createPath(path, 'relatedTopicSlugs'),
    ),
    relatedNormSlugs: expectOptionalSlugArray(
      entry.relatedNormSlugs,
      createPath(path, 'relatedNormSlugs'),
    ),
    relatedPressSlugs: expectOptionalSlugArray(
      entry.relatedPressSlugs,
      createPath(path, 'relatedPressSlugs'),
    ),
  };
}

export function parseRede(value: unknown, path: string): Rede {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    date: expectDate(entry.date, createPath(path, 'date')),
    sprecher: expectString(entry.sprecher, createPath(path, 'sprecher')),
    speakerPersonSlug: entry.speakerPersonSlug === undefined
      ? undefined
      : expectSlug(entry.speakerPersonSlug, createPath(path, 'speakerPersonSlug')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
  };
}

export function parseTermin(value: unknown, path: string): Termin {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    date: expectDate(entry.date, createPath(path, 'date')),
    start: expectOptionalDateTime(entry.start, createPath(path, 'start')),
    end: expectOptionalDateTime(entry.end, createPath(path, 'end')),
    location: expectString(entry.location, createPath(path, 'location')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    relatedLegislationSlugs: expectOptionalSlugArray(
      entry.relatedLegislationSlugs,
      createPath(path, 'relatedLegislationSlugs'),
    ),
    relatedTopicSlugs: expectOptionalSlugArray(
      entry.relatedTopicSlugs,
      createPath(path, 'relatedTopicSlugs'),
    ),
  };
}

export function parseHaushaltsseite(value: unknown, path: string): Haushaltsseite {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    dataset: parseOptionalRecord(entry.dataset, createPath(path, 'dataset')),
  };
}

export function parseStellenangebot(value: unknown, path: string): Stellenangebot {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    ressort: expectString(entry.ressort ?? entry.ministry, createPath(path, 'ressort')),
    standort: expectString(entry.standort ?? entry.location, createPath(path, 'standort')),
    arbeitsbereich: expectString(entry.arbeitsbereich, createPath(path, 'arbeitsbereich')),
    datePosted: expectDate(entry.datePosted, createPath(path, 'datePosted')),
    applicationDeadline: expectDate(
      entry.applicationDeadline,
      createPath(path, 'applicationDeadline'),
    ),
    employmentType: expectString(entry.employmentType, createPath(path, 'employmentType')),
    payGrade: expectOptionalString(entry.payGrade, createPath(path, 'payGrade')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    contact: parseContact(entry.contact, createPath(path, 'contact')),
    image: expectOptionalString(entry.image, createPath(path, 'image')),
    imageAlt: expectOptionalString(entry.imageAlt, createPath(path, 'imageAlt')),
    imageCredit: expectOptionalString(entry.imageCredit, createPath(path, 'imageCredit')),
  };
}

export function parseSeite(value: unknown, path: string): Seite {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    accessibilityAudit: parseAccessibilityAudit(
      entry.accessibilityAudit,
      createPath(path, 'accessibilityAudit'),
    ),
  };
}

function parseAccessibilityAudit(value: unknown, path: string): AccessibilityAudit | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const entry = expectRecord(value, path);

  return {
    checkedOn: expectDate(entry.checkedOn, createPath(path, 'checkedOn')),
    scope: expectStringArray(entry.scope, createPath(path, 'scope')),
    methods: expectStringArray(entry.methods, createPath(path, 'methods')),
    knownLimitations: expectStringArray(
      entry.knownLimitations,
      createPath(path, 'knownLimitations'),
    ),
  };
}

function expectEditorialIcon(value: unknown, path: string): PortalEditorialIcon {
  const icon = expectString(value, path) as PortalEditorialIcon;
  const allowed: PortalEditorialIcon[] = ['law', 'topics', 'map', 'budget', 'government', 'ministry', 'press'];
  if (!allowed.includes(icon)) throw new PortalContentValidationError(`${path}: unbekanntes Portal-Icon`);
  return icon;
}

function expectNoticeIcon(value: unknown, path: string): PortalNoticeIcon {
  const icon = expectEditorialIcon(value, path);
  if (icon === 'ministry') {
    throw new PortalContentValidationError(`${path}: das Icon ministry ist im Hinweisband nicht zulässig`);
  }
  return icon;
}

export function parseHomeContent(value: unknown, path = 'content/portal/home.json'): HomeContent {
  const entry = expectRecord(value, path);
  const hero = expectRecord(entry.hero, createPath(path, 'hero'));
  if (!Array.isArray(entry.portalAccesses) || !Array.isArray(entry.importantItems)) {
    throw new PortalContentValidationError(`${path}: portalAccesses und importantItems müssen Listen sein`);
  }
  return {
    hero: {
      eyebrow: expectString(hero.eyebrow, `${path}.hero.eyebrow`),
      title: expectString(hero.title, `${path}.hero.title`),
      lead: expectString(hero.lead, `${path}.hero.lead`),
      image: expectString(hero.image, `${path}.hero.image`),
      imageAlt: expectString(hero.imageAlt, `${path}.hero.imageAlt`),
      searchLabel: expectString(hero.searchLabel, `${path}.hero.searchLabel`),
      searchPlaceholder: expectString(hero.searchPlaceholder, `${path}.hero.searchPlaceholder`),
    },
    portalAccesses: entry.portalAccesses.map((raw, index) => {
      const item = expectRecord(raw, `${path}.portalAccesses[${index}]`);
      return {
        title: expectString(item.title, `${path}.portalAccesses[${index}].title`),
        description: expectString(item.description, `${path}.portalAccesses[${index}].description`),
        href: expectString(item.href, `${path}.portalAccesses[${index}].href`),
        icon: expectEditorialIcon(item.icon, `${path}.portalAccesses[${index}].icon`),
      };
    }),
    importantItems: entry.importantItems.map((raw, index) => {
      const item = expectRecord(raw, `${path}.importantItems[${index}]`);
      const title = expectOptionalString(item.title, `${path}.importantItems[${index}].title`);
      const governmentSlug = item.governmentSlug === undefined ? undefined : expectSlug(item.governmentSlug, `${path}.importantItems[${index}].governmentSlug`);
      if (!title && !governmentSlug) throw new PortalContentValidationError(`${path}.importantItems[${index}]: title oder governmentSlug ist erforderlich`);
      return {
        id: expectSlug(item.id, `${path}.importantItems[${index}].id`),
        title,
        governmentSlug,
        description: expectOptionalString(item.description, `${path}.importantItems[${index}].description`),
        href: expectString(item.href, `${path}.importantItems[${index}].href`),
        icon: expectNoticeIcon(item.icon, `${path}.importantItems[${index}].icon`),
      };
    }),
  };
}

export function parseCabinetPageContent(value: unknown, path = 'content/regierung/cabinet-page.json'): CabinetPageContent {
  const entry = expectRecord(value, path);
  if (!Array.isArray(entry.chronology)) throw new PortalContentValidationError(`${path}.chronology: muss eine Liste sein`);
  return {
    slug: expectSlug(entry.slug, `${path}.slug`),
    title: expectString(entry.title, `${path}.title`),
    lead: expectString(entry.lead, `${path}.lead`),
    politicalContext: expectStringArray(entry.politicalContext, `${path}.politicalContext`),
    chronologyTitle: expectString(entry.chronologyTitle, `${path}.chronologyTitle`),
    chronology: entry.chronology.map((raw, index) => {
      const item = expectRecord(raw, `${path}.chronology[${index}]`);
      return {
        date: expectDate(item.date, `${path}.chronology[${index}].date`),
        text: expectString(item.text, `${path}.chronology[${index}].text`),
      };
    }),
    topicHighlightSlugs: expectOptionalSlugArray(entry.topicHighlightSlugs, `${path}.topicHighlightSlugs`) ?? [],
  };
}

function parseBeteiligungsEintrag(value: unknown, path: string): BeteiligungsEintrag {
  const entry = expectRecord(value, path);
  return {
    title: expectString(entry.title, `${path}.title`),
    label: expectString(entry.label, `${path}.label`),
    text: expectString(entry.text, `${path}.text`),
    note: expectOptionalString(entry.note, `${path}.note`),
    normSlug: entry.normSlug === undefined ? undefined : expectSlug(entry.normSlug, `${path}.normSlug`),
  };
}

export function parseBeteiligungsUebersicht(
  value: unknown,
  path = 'content/regierung/beteiligungen.json',
): BeteiligungsUebersicht {
  const entry = expectRecord(value, path);
  if (!Array.isArray(entry.facts)) throw new PortalContentValidationError(`${path}.facts: muss eine Liste sein`);
  if (!Array.isArray(entry.introduction)) throw new PortalContentValidationError(`${path}.introduction: muss eine Liste sein`);
  if (!Array.isArray(entry.sections)) throw new PortalContentValidationError(`${path}.sections: muss eine Liste sein`);
  if (!Array.isArray(entry.changes)) throw new PortalContentValidationError(`${path}.changes: muss eine Liste sein`);
  if (!Array.isArray(entry.continuingItems)) throw new PortalContentValidationError(`${path}.continuingItems: muss eine Liste sein`);
  if (!Array.isArray(entry.unresolvedItems)) throw new PortalContentValidationError(`${path}.unresolvedItems: muss eine Liste sein`);
  if (!Array.isArray(entry.relatedNorms)) throw new PortalContentValidationError(`${path}.relatedNorms: muss eine Liste sein`);

  return {
    slug: expectSlug(entry.slug, `${path}.slug`),
    title: expectString(entry.title, `${path}.title`),
    lead: expectString(entry.lead, `${path}.lead`),
    asOf: expectDate(entry.asOf, `${path}.asOf`),
    inheritanceDate: expectDate(entry.inheritanceDate, `${path}.inheritanceDate`),
    facts: entry.facts.map((raw, index) => {
      const item = expectRecord(raw, `${path}.facts[${index}]`);
      return {
        label: expectString(item.label, `${path}.facts[${index}].label`),
        value: expectString(item.value, `${path}.facts[${index}].value`),
        note: expectOptionalString(item.note, `${path}.facts[${index}].note`),
      };
    }),
    introduction: expectStringArray(entry.introduction, `${path}.introduction`),
    sections: entry.sections.map((raw, index) => {
      const sectionPath = `${path}.sections[${index}]`;
      const section = expectRecord(raw, sectionPath);
      if (!Array.isArray(section.items)) throw new PortalContentValidationError(`${sectionPath}.items: muss eine Liste sein`);
      return {
        id: expectSlug(section.id, `${sectionPath}.id`),
        title: expectString(section.title, `${sectionPath}.title`),
        intro: expectString(section.intro, `${sectionPath}.intro`),
        items: section.items.map((item, itemIndex) => parseBeteiligungsEintrag(item, `${sectionPath}.items[${itemIndex}]`)),
      };
    }),
    changes: entry.changes.map((raw, index) => {
      const changePath = `${path}.changes[${index}]`;
      const change = expectRecord(raw, changePath);
      return {
        date: expectDate(change.date, `${changePath}.date`),
        label: expectString(change.label, `${changePath}.label`),
        title: expectString(change.title, `${changePath}.title`),
        text: expectString(change.text, `${changePath}.text`),
        note: expectOptionalString(change.note, `${changePath}.note`),
        normSlug: change.normSlug === undefined ? undefined : expectSlug(change.normSlug, `${changePath}.normSlug`),
      };
    }),
    continuingTitle: expectString(entry.continuingTitle, `${path}.continuingTitle`),
    continuingIntro: expectString(entry.continuingIntro, `${path}.continuingIntro`),
    continuingItems: expectStringArray(entry.continuingItems, `${path}.continuingItems`),
    unresolvedTitle: expectString(entry.unresolvedTitle, `${path}.unresolvedTitle`),
    unresolvedIntro: expectString(entry.unresolvedIntro, `${path}.unresolvedIntro`),
    unresolvedItems: expectStringArray(entry.unresolvedItems, `${path}.unresolvedItems`),
    sourceNote: expectString(entry.sourceNote, `${path}.sourceNote`),
    relatedNorms: entry.relatedNorms.map((raw, index) => {
      const item = expectRecord(raw, `${path}.relatedNorms[${index}]`);
      return {
        label: expectString(item.label, `${path}.relatedNorms[${index}].label`),
        normSlug: expectSlug(item.normSlug, `${path}.relatedNorms[${index}].normSlug`),
      };
    }),
  };
}

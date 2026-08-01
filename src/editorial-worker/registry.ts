import {
  parseCabinetPageContent,
  parseHomeContent,
  parseMinisteriumProfil,
  parsePressemitteilung,
  parseRede,
  parseRegierungProfil,
  parseSeite,
  parseStellenangebot,
  parseTermin,
  parseThemenseite,
} from '../lib/portal/schema.ts';
import { parseActionPlanData, parseTimelineData } from '../lib/portal/dashboard-content.ts';

export type EditorialFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'enum'
  | 'slug'
  | 'person-reference'
  | 'ministry-reference'
  | 'reference-list'
  | 'sortable-list'
  | 'object-list'
  | 'image'
  | 'image-alt'
  | 'image-credit';

export interface EditorialFieldDefinition {
  name: string;
  label: string;
  type: EditorialFieldType;
  required?: boolean;
  description?: string;
  help?: string;
  enumValues?: Array<{ value: string; label: string }>;
  referenceTarget?: 'person' | 'ministry' | 'government' | 'topic' | 'norm';
  validation?: {
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    pattern?: string;
  };
  serialization?: 'string' | 'boolean' | 'array' | 'object-array';
}

export interface EditorialContentTypeDefinition {
  id: EditorialContentTypeId;
  label: string;
  description: string;
  mode: 'collection' | 'singleton' | 'workflow';
  directory: string;
  singletonPath?: string;
  publicRoutes: string[];
  preview: 'route' | 'affected-routes' | 'none';
  fields: EditorialFieldDefinition[];
  validate(value: unknown, path: string): unknown;
}

export type EditorialContentTypeId =
  | 'cabinet-reshuffle'
  | 'government-member'
  | 'ministry'
  | 'home'
  | 'cabinet-page'
  | 'topic'
  | 'press-release'
  | 'speech'
  | 'event'
  | 'job'
  | 'service-page'
  | 'freestate-page'
  | 'action-plan'
  | 'timeline';

const slugField: EditorialFieldDefinition = {
  name: 'slug',
  label: 'Slug',
  type: 'slug',
  required: true,
  help: 'Kleingeschriebener technischer Bezeichner mit Bindestrichen.',
  validation: { pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
  serialization: 'string',
};

const titleField: EditorialFieldDefinition = {
  name: 'title',
  label: 'Titel',
  type: 'text',
  required: true,
  validation: { maxLength: 180 },
  serialization: 'string',
};

const imageFields: EditorialFieldDefinition[] = [
  {
    name: 'image',
    label: 'Bild',
    type: 'image',
    description: 'Vorhandenes Bild auswählen oder als Teil derselben Änderung hochladen.',
    serialization: 'string',
  },
  {
    name: 'imageAlt',
    label: 'Alternativtext',
    type: 'image-alt',
    description: 'Beschreibt den relevanten Bildinhalt für Nutzer:innen von Screenreadern.',
    validation: { maxLength: 300 },
    serialization: 'string',
  },
  {
    name: 'imageCredit',
    label: 'Bildnachweis oder Quelle',
    type: 'image-credit',
    validation: { maxLength: 300 },
    serialization: 'string',
  },
];

const bodyField: EditorialFieldDefinition = {
  name: 'body',
  label: 'Textabschnitte',
  type: 'sortable-list',
  required: true,
  help: 'Jeder Eintrag wird als eigener Absatz ausgegeben; beliebiges HTML ist nicht zulässig.',
  validation: { minItems: 1 },
  serialization: 'array',
};

function normalizeRootList(value: unknown, key: 'items' | 'entries', parser: (value: unknown, path: string) => unknown, path: string): unknown {
  const parsed = parser(value, path);
  return { [key]: parsed };
}

export const editorialRegistry: Record<EditorialContentTypeId, EditorialContentTypeDefinition> = {
  'cabinet-reshuffle': {
    id: 'cabinet-reshuffle',
    label: 'Kabinettsumbildung',
    description: 'Geführte, atomare Änderung zeitlicher Amts- und Ressortzuweisungen.',
    mode: 'workflow',
    directory: 'content/organisation',
    singletonPath: 'content/organisation/assignments.json',
    publicRoutes: ['/staatsregierung/', '/staatsregierung/kabinett/', '/staatsregierung/mitglieder/'],
    preview: 'affected-routes',
    fields: [
      { name: 'effectiveDate', label: 'Wirksamkeitsdatum', type: 'date', required: true, serialization: 'string' },
      { name: 'governmentSlug', label: 'Regierung', type: 'enum', required: true, referenceTarget: 'government', serialization: 'string' },
      { name: 'changes', label: 'Neue Zuordnungen', type: 'object-list', required: true, validation: { minItems: 1 }, serialization: 'object-array' },
      { name: 'changes.personSlug', label: 'Person in einer Zuordnung', type: 'person-reference', referenceTarget: 'person', serialization: 'string' },
      { name: 'changes.ministrySlug', label: 'Ressort in einer Zuordnung', type: 'ministry-reference', referenceTarget: 'ministry', serialization: 'string' },
    ],
    validate: (value, path) => value ?? (() => { throw new Error(`${path}: Änderung fehlt`); })(),
  },
  'government-member': {
    id: 'government-member',
    label: 'Regierungsmitglied',
    description: 'Biografie, Kontakt, Bild und Darstellungsangaben; Ämter kommen aus dem Organisationsmodell.',
    mode: 'collection',
    directory: 'content/regierung/mitglieder',
    publicRoutes: ['/staatsregierung/mitglieder/{slug}/'],
    preview: 'route',
    fields: [slugField, { name: 'name', label: 'Name', type: 'text', required: true, serialization: 'string' }, { name: 'kurzbiografie', label: 'Kurzbiografie', type: 'textarea', required: true, serialization: 'string' }, { name: 'langbiografie', label: 'Biografieabschnitte', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'party', label: 'Partei', type: 'text', serialization: 'string' }, { name: 'zitat', label: 'Zitat', type: 'textarea', serialization: 'string' }, { name: 'kontakt.email', label: 'Kontakt-E-Mail', type: 'text', serialization: 'string' }, { name: 'kontakt.telefon', label: 'Kontakt-Telefon', type: 'text', serialization: 'string' }, { name: 'bild', label: 'Bild', type: 'image', required: true, serialization: 'string' }, { name: 'bildAlt', label: 'Alternativtext', type: 'image-alt', required: true, serialization: 'string' }, { name: 'bildnachweis', label: 'Bildnachweis', type: 'image-credit', serialization: 'string' }],
    validate: parseRegierungProfil,
  },
  ministry: {
    id: 'ministry',
    label: 'Ressort oder Staatssekretariat',
    description: 'Beschreibung, Zuständigkeiten und Kontakt; die Leitung wird zeitlich zugewiesen.',
    mode: 'collection',
    directory: 'content/ressorts',
    publicRoutes: ['/staatsregierung/kabinett/{slug}/', '/staatsregierung/kabinett/'],
    preview: 'route',
    fields: [slugField, { name: 'name', label: 'Name', type: 'text', required: true, serialization: 'string' }, { name: 'kurzname', label: 'Kurzname', type: 'text', required: true, serialization: 'string' }, { name: 'teaser', label: 'Beschreibung', type: 'textarea', required: true, serialization: 'string' }, { name: 'aufgaben', label: 'Aufgaben', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'themen', label: 'Themen', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'kontakt.name', label: 'Kontaktstelle', type: 'text', serialization: 'string' }, { name: 'kontakt.email', label: 'Kontakt-E-Mail', type: 'text', required: true, serialization: 'string' }, { name: 'kontakt.telefon', label: 'Kontakt-Telefon', type: 'text', serialization: 'string' }, { name: 'kontakt.referat', label: 'Referat', type: 'text', serialization: 'string' }, { name: 'verknuepfteLinks', label: 'Verknüpfte Links', type: 'object-list', required: true, serialization: 'object-array' }, { name: 'bild', label: 'Bild', type: 'image', required: true, serialization: 'string' }, { name: 'bildAlt', label: 'Alternativtext', type: 'image-alt', required: true, serialization: 'string' }, { name: 'bildnachweis', label: 'Bildnachweis', type: 'image-credit', serialization: 'string' }],
    validate: parseMinisteriumProfil,
  },
  home: {
    id: 'home',
    label: 'Startseite',
    description: 'Hero, Direkteinstiege, wichtige Hinweise und hervorgehobene Themen.',
    mode: 'singleton',
    directory: 'content/portal',
    singletonPath: 'content/portal/home.json',
    publicRoutes: ['/'],
    preview: 'route',
    fields: [
      { name: 'hero.eyebrow', label: 'Hero-Kennzeichnung', type: 'text', required: true, serialization: 'string' },
      { name: 'hero.title', label: 'Hero-Titel', type: 'text', required: true, serialization: 'string' },
      { name: 'hero.lead', label: 'Hero-Einleitung', type: 'textarea', required: true, serialization: 'string' },
      { name: 'hero.image', label: 'Hero-Bild', type: 'image', required: true, serialization: 'string' },
      { name: 'hero.imageAlt', label: 'Hero-Alternativtext', type: 'image-alt', required: true, serialization: 'string' },
      { name: 'hero.searchLabel', label: 'Bezeichnung der Suche', type: 'text', required: true, serialization: 'string' },
      { name: 'hero.searchPlaceholder', label: 'Beispiele im Suchfeld', type: 'text', required: true, serialization: 'string' },
      { name: 'portalAccesses', label: 'Direkteinstiege', type: 'object-list', required: true, serialization: 'object-array' },
      { name: 'importantItems', label: 'Aktuell wichtig', type: 'object-list', required: true, serialization: 'object-array' },
      { name: 'featuredTopicSlugs', label: 'Hervorgehobene Themen', type: 'reference-list', referenceTarget: 'topic', serialization: 'array' },
    ],
    validate: parseHomeContent,
  },
  'cabinet-page': {
    id: 'cabinet-page',
    label: 'Kabinettsseite',
    description: 'Politische Einordnung, Chronologie und Themenauswahl der Kabinettsseite.',
    mode: 'singleton',
    directory: 'content/regierung',
    singletonPath: 'content/regierung/cabinet-page.json',
    publicRoutes: ['/staatsregierung/kabinett/'],
    preview: 'route',
    fields: [slugField, titleField, { name: 'lead', label: 'Einleitung', type: 'textarea', required: true, serialization: 'string' }, { name: 'politicalContext', label: 'Politische Einordnung', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'chronologyTitle', label: 'Titel der Chronologie', type: 'text', required: true, serialization: 'string' }, { name: 'chronology', label: 'Chronologie', type: 'object-list', required: true, serialization: 'object-array' }, { name: 'topicHighlightSlugs', label: 'Vorhaben', type: 'reference-list', referenceTarget: 'topic', serialization: 'array' }],
    validate: parseCabinetPageContent,
  },
  topic: {
    id: 'topic', label: 'Themenseite', description: 'Politisches Thema mit Status, Ressortbezug und strukturierten Absätzen.', mode: 'collection', directory: 'content/themen', publicRoutes: ['/themen/{slug}/'], preview: 'route',
    fields: [slugField, titleField, { name: 'status', label: 'Status', type: 'enum', required: true, enumValues: [{ value: 'geplant', label: 'Geplant' }, { value: 'entwurf', label: 'Entwurf' }, { value: 'im-gesetzgebungsverfahren', label: 'Im Gesetzgebungsverfahren' }, { value: 'beschlossen', label: 'Beschlossen' }, { value: 'in-umsetzung', label: 'In Umsetzung' }, { value: 'abgeschlossen', label: 'Abgeschlossen' }], serialization: 'string' }, { name: 'federfuehrendesRessort', label: 'Federführendes Ressort', type: 'ministry-reference', required: true, referenceTarget: 'ministry', serialization: 'string' }, { name: 'mitzeichnungsressorts', label: 'Mitzeichnende Ressorts', type: 'reference-list', referenceTarget: 'ministry', serialization: 'array' }, { name: 'teaser', label: 'Kurzbeschreibung', type: 'textarea', required: true, serialization: 'string' }, { name: 'beschlossen', label: 'Beschlossen', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'umgesetzt', label: 'Umgesetzt', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'naechsteSchritte', label: 'Nächste Schritte', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'rechtsgrundlagen', label: 'Rechtsgrundlagen', type: 'object-list', required: true, serialization: 'object-array' }, { name: 'faq', label: 'Fragen und Antworten', type: 'object-list', required: true, serialization: 'object-array' }],
    validate: parseThemenseite,
  },
  'press-release': {
    id: 'press-release', label: 'Pressemitteilung', description: 'Datierte Pressemitteilung mit strukturiertem Text.', mode: 'collection', directory: 'content/presse/mitteilungen', publicRoutes: ['/presse/pressemitteilungen/{slug}/'], preview: 'route',
    fields: [slugField, titleField, { name: 'date', label: 'Datum', type: 'date', required: true, serialization: 'string' }, { name: 'ressort', label: 'Ressortbezeichnung', type: 'text', required: true, serialization: 'string' }, { name: 'teaser', label: 'Kurzbeschreibung', type: 'textarea', required: true, serialization: 'string' }, { name: 'tags', label: 'Schlagwörter', type: 'sortable-list', required: true, serialization: 'array' }, { name: 'isFeatured', label: 'Hervorheben', type: 'boolean', serialization: 'boolean' }, bodyField, ...imageFields],
    validate: parsePressemitteilung,
  },
  speech: {
    id: 'speech', label: 'Rede', description: 'Rede mit Datum, Anlass, Ort und Absätzen.', mode: 'collection', directory: 'content/presse/reden', publicRoutes: ['/presse/reden/{slug}/'], preview: 'route',
    fields: [slugField, titleField, { name: 'date', label: 'Datum', type: 'date', required: true, serialization: 'string' }, { name: 'sprecher', label: 'Redner:in', type: 'text', required: true, serialization: 'string' }, { name: 'speakerPersonSlug', label: 'Verknüpftes Personenprofil', type: 'person-reference', referenceTarget: 'person', serialization: 'string' }, { name: 'teaser', label: 'Kurzbeschreibung', type: 'textarea', required: true, serialization: 'string' }, bodyField],
    validate: parseRede,
  },
  event: {
    id: 'event', label: 'Termin', description: 'Öffentlicher Termin mit Beginn, Ende und Ort.', mode: 'collection', directory: 'content/presse/termine', publicRoutes: ['/presse/termine/{slug}/'], preview: 'route',
    fields: [slugField, titleField, { name: 'date', label: 'Datum', type: 'date', required: true, serialization: 'string' }, { name: 'start', label: 'Beginn mit Uhrzeit', type: 'datetime', serialization: 'string' }, { name: 'end', label: 'Ende mit Uhrzeit', type: 'datetime', serialization: 'string' }, { name: 'location', label: 'Ort', type: 'text', required: true, serialization: 'string' }, { name: 'teaser', label: 'Kurzbeschreibung', type: 'textarea', required: true, serialization: 'string' }, bodyField],
    validate: parseTermin,
  },
  job: {
    id: 'job', label: 'Stellenangebot', description: 'Stellenanzeige mit Ressort, Frist und Kontakt.', mode: 'collection', directory: 'content/service/stellen', publicRoutes: ['/service/karriere/{slug}/'], preview: 'route',
    fields: [slugField, titleField, { name: 'ressort', label: 'Ressort', type: 'text', required: true, serialization: 'string' }, { name: 'standort', label: 'Standort', type: 'text', required: true, serialization: 'string' }, { name: 'arbeitsbereich', label: 'Arbeitsbereich', type: 'text', required: true, serialization: 'string' }, { name: 'datePosted', label: 'Veröffentlichung', type: 'date', required: true, serialization: 'string' }, { name: 'applicationDeadline', label: 'Bewerbungsfrist', type: 'date', required: true, serialization: 'string' }, { name: 'employmentType', label: 'Beschäftigungsart', type: 'enum', required: true, enumValues: [{ value: 'Vollzeit', label: 'Vollzeit' }, { value: 'Teilzeit', label: 'Teilzeit' }], serialization: 'string' }, { name: 'teaser', label: 'Kurzbeschreibung', type: 'textarea', required: true, serialization: 'string' }, { name: 'contact.name', label: 'Kontaktstelle', type: 'text', serialization: 'string' }, { name: 'contact.email', label: 'Kontakt-E-Mail', type: 'text', serialization: 'string' }, { name: 'contact.telefon', label: 'Kontakt-Telefon', type: 'text', serialization: 'string' }, bodyField, ...imageFields],
    validate: parseStellenangebot,
  },
  'service-page': {
    id: 'service-page', label: 'Service-Seite', description: 'Strukturierte allgemeine Service-Inhalte.', mode: 'collection', directory: 'content/service/seiten', publicRoutes: ['/service/{slug}/'], preview: 'route',
    fields: [slugField, titleField, bodyField], validate: parseSeite,
  },
  'freestate-page': {
    id: 'freestate-page', label: 'Freistaat-Seite', description: 'Strukturierte Inhalte zum Freistaat.', mode: 'collection', directory: 'content/freistaat', publicRoutes: ['/freistaat/{slug}/'], preview: 'route',
    fields: [slugField, titleField, bodyField], validate: parseSeite,
  },
  'action-plan': {
    id: 'action-plan', label: 'Dashboard-Aktionsplan', description: 'Sortierbare Einträge des 15-Punkte-Plans.', mode: 'singleton', directory: 'content/dashboard', singletonPath: 'content/dashboard/action-plan.json', publicRoutes: ['/staatsregierung/15-punkte-plan/'], preview: 'route',
    fields: [{ name: 'items', label: 'Aktionspunkte', type: 'object-list', required: true, validation: { minItems: 1 }, serialization: 'object-array' }],
    validate: (value, path) => normalizeRootList(value, 'items', parseActionPlanData, path),
  },
  timeline: {
    id: 'timeline', label: 'Dashboard-Timeline', description: 'Datierte Ereignisse des Regierungsdashboards.', mode: 'singleton', directory: 'content/dashboard', singletonPath: 'content/dashboard/timeline.json', publicRoutes: ['/staatsregierung/15-punkte-plan/'], preview: 'route',
    fields: [{ name: 'entries', label: 'Ereignisse', type: 'object-list', required: true, validation: { minItems: 1 }, serialization: 'object-array' }],
    validate: (value, path) => normalizeRootList(value, 'entries', parseTimelineData, path),
  },
};

export function isEditorialContentType(value: string): value is EditorialContentTypeId {
  return Object.hasOwn(editorialRegistry, value);
}

export function getEditorialFilePath(type: EditorialContentTypeId, slug?: string): string {
  const definition = editorialRegistry[type];
  if (definition.singletonPath) return definition.singletonPath;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new Error('Ein gültiger Slug ist erforderlich.');
  }
  return `${definition.directory}/${slug}.json`;
}

export function validateEditorialDocument(type: EditorialContentTypeId, value: unknown, path?: string): unknown {
  const definition = editorialRegistry[type];
  return definition.validate(value, path ?? getEditorialFilePath(type, typeof value === 'object' && value && 'slug' in value ? String(value.slug) : undefined));
}

export function serializeEditorialDocument(type: EditorialContentTypeId, value: unknown, path?: string): string {
  const parsed = validateEditorialDocument(type, value, path);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function resolveEditorialRoutes(type: EditorialContentTypeId, slug?: string): string[] {
  return editorialRegistry[type].publicRoutes.map((route) => route.replace('{slug}', slug ?? ''));
}

import type { PortalContact, PortalLink, ThemenFaqEintrag, ThemenRechtsgrundlage } from '../portal/schema.ts';
import type { ActionPlanReference, ActionPlanStatus } from '../portal/modules.ts';
import type {
  EditorialEntryContent,
  EditorialEntryMetadata,
  EventDraftContent,
  GovernmentMemberDraftContent,
  JobDraftContent,
  MinistryDraftContent,
  PressReleaseDraftContent,
  ProjectStatusDraftContent,
  ServicePageDraftContent,
  TopicDraftContent,
} from './schema.ts';
import {
  getEditorialRouteForType,
  getEditorialTypeDefinition,
  type EditorialEntryStatus,
  type EditorialEntryType,
} from './studio.ts';

export interface ParsedEditorialFormInput {
  entryId?: string;
  type: EditorialEntryType;
  slug: string;
  title: string;
  route: string;
  status: EditorialEntryStatus;
  author?: string;
  summary?: string;
  metadata: EditorialEntryMetadata;
  content: EditorialEntryContent;
}

function readRequiredString(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? '').trim();

  if (!value) {
    throw new Error(`Das Feld "${key}" ist erforderlich.`);
  }

  return value;
}

function readOptionalString(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? '').trim();
  return value || undefined;
}

function readDate(formData: FormData, key: string): string {
  const value = readRequiredString(formData, key);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`Das Feld "${key}" muss im Format JJJJ-MM-TT vorliegen.`);
  }

  return value;
}

function readSlug(formData: FormData, key: string): string {
  const value = readRequiredString(formData, key);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error(`Das Feld "${key}" muss ein technischer Slug sein.`);
  }

  return value;
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
}

function readParagraphs(formData: FormData, key: string): string[] {
  const value = readRequiredString(formData, key);

  return value
    .split(/\n\s*\n/gu)
    .map((entry) => entry.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
}

function readLines(formData: FormData, key: string): string[] {
  const value = readRequiredString(formData, key);

  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readOptionalLines(formData: FormData, key: string): string[] {
  const value = readOptionalString(formData, key);
  if (!value) {
    return [];
  }

  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readCsv(formData: FormData, key: string): string[] {
  const value = readOptionalString(formData, key);
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readInteger(formData: FormData, key: string): number {
  const value = readRequiredString(formData, key);
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Das Feld "${key}" muss eine ganze Zahl sein.`);
  }

  return parsed;
}

function readOptionalContact(formData: FormData, prefix: string): PortalContact | undefined {
  const name = readOptionalString(formData, `${prefix}Name`);
  const email = readOptionalString(formData, `${prefix}Email`);
  const telefon = readOptionalString(formData, `${prefix}Telefon`);
  const referat = readOptionalString(formData, `${prefix}Referat`);

  if (!name && !email && !telefon && !referat) {
    return undefined;
  }

  return {
    name,
    email,
    telefon,
    referat,
  };
}

function readDelimitedRecords(formData: FormData, key: string): string[][] {
  return readOptionalLines(formData, key).map((line) =>
    line
      .split('|')
      .map((entry) => entry.trim())
      .filter((entry, index, values) => entry.length > 0 || index < values.length - 1),
  );
}

function readTopicReferences(formData: FormData, key: string): ThemenRechtsgrundlage[] {
  return readDelimitedRecords(formData, key).map((parts, index) => {
    const [label, normSlug, note] = parts;

    if (!label) {
      throw new Error(`Rechtsgrundlagen-Zeile ${index + 1} benötigt mindestens ein Label.`);
    }

    return {
      label,
      normSlug: normSlug || undefined,
      note: note || undefined,
    };
  });
}

function readFaqEntries(formData: FormData, key: string): ThemenFaqEintrag[] {
  return readDelimitedRecords(formData, key).map((parts, index) => {
    const [question, answer] = parts;

    if (!question || !answer) {
      throw new Error(`FAQ-Zeile ${index + 1} muss "Frage | Antwort" enthalten.`);
    }

    return {
      question,
      answer,
    };
  });
}

function readPortalLinks(formData: FormData, key: string): PortalLink[] {
  return readDelimitedRecords(formData, key).map((parts, index) => {
    const [label, href] = parts;

    if (!label || !href) {
      throw new Error(`Link-Zeile ${index + 1} muss "Label | /pfad/" enthalten.`);
    }

    return {
      label,
      href,
    };
  });
}

function readActionPlanReferences(formData: FormData, key: string): ActionPlanReference[] {
  return readDelimitedRecords(formData, key).map((parts, index) => {
    const [label, normSlug] = parts;

    if (!label || !normSlug) {
      throw new Error(`Referenz-Zeile ${index + 1} muss "Label | norm-slug" enthalten.`);
    }

    return {
      label,
      normSlug,
    };
  });
}

function readActionPlanStatus(formData: FormData, key: string): ActionPlanStatus {
  const value = readRequiredString(formData, key);

  if (value === 'umgesetzt' || value === 'teilweise_umgesetzt' || value === 'angelegt') {
    return value;
  }

  throw new Error(`Das Feld "${key}" enthält einen unbekannten Projektstatus.`);
}

function readEditorialStatus(formData: FormData): EditorialEntryStatus {
  const value = readOptionalString(formData, 'status');

  if (value === 'published' || value === 'export_ready') {
    return value;
  }

  return 'draft';
}

function readMetadata(formData: FormData): EditorialEntryMetadata {
  return {
    sourceId: readOptionalString(formData, 'sourceId'),
    sourceOrigin: readOptionalString(formData, 'sourceOrigin') as EditorialEntryMetadata['sourceOrigin'],
  };
}

function readCommonInput(
  formData: FormData,
  type: EditorialEntryType,
): Omit<ParsedEditorialFormInput, 'content'> {
  const slug = readSlug(formData, 'slug');
  const title = readRequiredString(formData, 'title');
  const entryId = readOptionalString(formData, 'entryId');
  const route = getEditorialRouteForType(type, slug, readOptionalString(formData, 'route'));

  return {
    entryId,
    type,
    slug,
    title,
    route,
    status: readEditorialStatus(formData),
    author: readOptionalString(formData, 'author'),
    summary: readOptionalString(formData, 'summary'),
    metadata: readMetadata(formData),
  };
}

function readPressReleaseContent(formData: FormData): PressReleaseDraftContent {
  return {
    date: readDate(formData, 'date'),
    ressort: readRequiredString(formData, 'ressort'),
    teaser: readRequiredString(formData, 'teaser'),
    imageUrl: readOptionalString(formData, 'imageUrl'),
    mediaKey: readOptionalString(formData, 'mediaKey'),
    imageAlt: readRequiredString(formData, 'imageAlt'),
    imageCredit: readRequiredString(formData, 'imageCredit'),
    tags: readCsv(formData, 'tagsText'),
    body: readParagraphs(formData, 'bodyText'),
    isFeatured: readBoolean(formData, 'isFeatured'),
    relatedTopicSlugs: readCsv(formData, 'relatedTopicSlugsText'),
    relatedNormSlugs: readCsv(formData, 'relatedNormSlugsText'),
    relatedPressSlugs: readCsv(formData, 'relatedPressSlugsText'),
  };
}

function readEventContent(formData: FormData): EventDraftContent {
  return {
    date: readDate(formData, 'date'),
    location: readRequiredString(formData, 'location'),
    teaser: readRequiredString(formData, 'teaser'),
    body: readParagraphs(formData, 'bodyText'),
    imageUrl: readOptionalString(formData, 'imageUrl'),
    mediaKey: readOptionalString(formData, 'mediaKey'),
    imageAlt: readOptionalString(formData, 'imageAlt'),
  };
}

function readJobContent(formData: FormData): JobDraftContent {
  return {
    ressort: readRequiredString(formData, 'ressort'),
    standort: readRequiredString(formData, 'standort'),
    arbeitsbereich: readRequiredString(formData, 'arbeitsbereich'),
    datePosted: readDate(formData, 'datePosted'),
    applicationDeadline: readDate(formData, 'applicationDeadline'),
    employmentType: readRequiredString(formData, 'employmentType'),
    payGrade: readOptionalString(formData, 'payGrade'),
    teaser: readRequiredString(formData, 'teaser'),
    body: readParagraphs(formData, 'bodyText'),
    contact: readOptionalContact(formData, 'contact'),
    imageUrl: readOptionalString(formData, 'imageUrl'),
    mediaKey: readOptionalString(formData, 'mediaKey'),
    imageAlt: readOptionalString(formData, 'imageAlt'),
    imageCredit: readOptionalString(formData, 'imageCredit'),
    isActive: readBoolean(formData, 'isActive'),
  };
}

function readProjectStatusContent(formData: FormData): ProjectStatusDraftContent {
  return {
    description: readRequiredString(formData, 'description'),
    status: readActionPlanStatus(formData, 'projectStatus'),
    ressort: readRequiredString(formData, 'ressort'),
    href: readRequiredString(formData, 'href'),
    position: readInteger(formData, 'position'),
    references: readActionPlanReferences(formData, 'referencesText'),
  };
}

function readServicePageContent(formData: FormData): ServicePageDraftContent {
  return {
    body: readParagraphs(formData, 'bodyText'),
  };
}

function readTopicContent(formData: FormData): TopicDraftContent {
  return {
    teaser: readRequiredString(formData, 'teaser'),
    status: readRequiredString(formData, 'topicStatus') as TopicDraftContent['status'],
    hero: readOptionalString(formData, 'hero'),
    beschlossen: readLines(formData, 'beschlossenText'),
    umgesetzt: readLines(formData, 'umgesetztText'),
    naechsteSchritte: readLines(formData, 'naechsteSchritteText'),
    rechtsgrundlagen: readTopicReferences(formData, 'rechtsgrundlagenText'),
    faq: readFaqEntries(formData, 'faqText'),
    federfuehrendesRessort: readRequiredString(formData, 'federfuehrendesRessort'),
    mitzeichnungsressorts: readCsv(formData, 'mitzeichnungsressortsText'),
  };
}

function readMinistryContent(formData: FormData): MinistryDraftContent {
  return {
    name: readRequiredString(formData, 'name'),
    kurzname: readRequiredString(formData, 'kurzname'),
    leitung: readRequiredString(formData, 'leitung'),
    teaser: readRequiredString(formData, 'teaser'),
    aufgaben: readLines(formData, 'aufgabenText'),
    kontakt: readOptionalContact(formData, 'contact'),
    imageUrl: readOptionalString(formData, 'imageUrl'),
    mediaKey: readOptionalString(formData, 'mediaKey'),
    imageAlt: readOptionalString(formData, 'imageAlt'),
    imageCredit: readOptionalString(formData, 'imageCredit'),
    themen: readLines(formData, 'themenText'),
    verknuepfteLinks: readPortalLinks(formData, 'verknuepfteLinksText'),
  };
}

function readGovernmentMemberContent(formData: FormData): GovernmentMemberDraftContent {
  return {
    name: readRequiredString(formData, 'name'),
    amt: readRequiredString(formData, 'amt'),
    ressort: readRequiredString(formData, 'ressort'),
    reihenfolge: readInteger(formData, 'reihenfolge'),
    kurzbiografie: readRequiredString(formData, 'kurzbiografie'),
    langbiografie: readParagraphs(formData, 'langbiografieText'),
    imageUrl: readOptionalString(formData, 'imageUrl'),
    mediaKey: readOptionalString(formData, 'mediaKey'),
    imageAlt: readOptionalString(formData, 'imageAlt'),
    imageCredit: readOptionalString(formData, 'imageCredit'),
    kontakt: readOptionalContact(formData, 'contact'),
    zitat: readOptionalString(formData, 'zitat'),
  };
}

export function parseEditorialFormData(
  formData: FormData,
  type: EditorialEntryType,
): ParsedEditorialFormInput {
  const common = readCommonInput(formData, type);

  switch (type) {
    case 'pressemitteilung':
      return { ...common, content: readPressReleaseContent(formData) };
    case 'termin':
      return { ...common, content: readEventContent(formData) };
    case 'stellenangebot':
      return { ...common, content: readJobContent(formData) };
    case 'projektstatus':
      return { ...common, content: readProjectStatusContent(formData) };
    case 'service-seite':
      return { ...common, content: readServicePageContent(formData) };
    case 'themenseite':
      return { ...common, content: readTopicContent(formData) };
    case 'ressort':
      return { ...common, content: readMinistryContent(formData) };
    case 'regierungsmitglied':
      return { ...common, content: readGovernmentMemberContent(formData) };
    default:
      throw new Error(`Inhaltstyp "${type}" wird nicht unterstützt.`);
  }
}

export function getEntryActionLabel(type: EditorialEntryType): string {
  return getEditorialTypeDefinition(type).directPublishLabel;
}

import type { ActionPlanStatus } from '../portal/modules.ts';
import type { Themenstatus } from '../portal/schema.ts';
import type {
  EditorialEntry,
  EditorialEntryContent,
  EditorialEntryWriteInput,
  EventDraftContent,
  GovernmentMemberDraftContent,
  JobDraftContent,
  MinistryDraftContent,
  PressReleaseDraftContent,
  ProjectStatusDraftContent,
  ServicePageDraftContent,
  TopicDraftContent,
} from './schema.ts';
import { formatActionPlanReferencesForTextarea, formatCsvForInput, formatFaqForTextarea, formatLinesForTextarea, formatLinksForTextarea, formatParagraphsForTextarea, formatTopicReferencesForTextarea } from './transformers.ts';
import { getEditorialRouteForType, getEditorialTypeDefinition, type EditorialEntryStatus, type EditorialEntryType, type EditorialVersionAction } from './studio.ts';

export type EditorialFormValues = Record<string, string | number | boolean | undefined>;

const defaultTopicStatus: Themenstatus = 'laufend';
const defaultProjectStatus: ActionPlanStatus = 'angelegt';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createBlankEditorialDraft(type: EditorialEntryType): EditorialEntryWriteInput {
  const publishMode = getEditorialTypeDefinition(type).publishMode;
  const base = {
    type,
    slug: '',
    title: '',
    route: '',
    status: 'draft' as EditorialEntryStatus,
    publishMode,
    metadata: {},
    action: 'draft_save' as EditorialVersionAction,
  };

  switch (type) {
    case 'pressemitteilung':
      return {
        ...base,
        content: {
          date: today(),
          ressort: '',
          teaser: '',
          imageAlt: '',
          imageCredit: '',
          tags: [],
          body: [],
          isFeatured: false,
          relatedTopicSlugs: [],
          relatedNormSlugs: [],
          relatedPressSlugs: [],
        } satisfies PressReleaseDraftContent,
      };
    case 'termin':
      return {
        ...base,
        content: {
          date: today(),
          location: '',
          teaser: '',
          body: [],
        } satisfies EventDraftContent,
      };
    case 'stellenangebot':
      return {
        ...base,
        content: {
          ressort: '',
          standort: '',
          arbeitsbereich: '',
          datePosted: today(),
          applicationDeadline: today(),
          employmentType: '',
          teaser: '',
          body: [],
          isActive: true,
        } satisfies JobDraftContent,
      };
    case 'projektstatus':
      return {
        ...base,
        content: {
          description: '',
          status: defaultProjectStatus,
          ressort: '',
          href: '',
          position: 1,
          references: [],
        } satisfies ProjectStatusDraftContent,
      };
    case 'service-seite':
      return {
        ...base,
        content: {
          body: [],
        } satisfies ServicePageDraftContent,
      };
    case 'themenseite':
      return {
        ...base,
        content: {
          teaser: '',
          status: defaultTopicStatus,
          beschlossen: [],
          umgesetzt: [],
          naechsteSchritte: [],
          rechtsgrundlagen: [],
          faq: [],
          federfuehrendesRessort: '',
          mitzeichnungsressorts: [],
        } satisfies TopicDraftContent,
      };
    case 'ressort':
      return {
        ...base,
        content: {
          name: '',
          kurzname: '',
          leitung: '',
          teaser: '',
          aufgaben: [],
          themen: [],
          verknuepfteLinks: [],
        } satisfies MinistryDraftContent,
      };
    case 'regierungsmitglied':
      return {
        ...base,
        content: {
          name: '',
          amt: '',
          ressort: '',
          reihenfolge: 1,
          kurzbiografie: '',
          langbiografie: [],
        } satisfies GovernmentMemberDraftContent,
      };
  }
}

export function entryToWriteInput(
  entry: EditorialEntry,
  action: EditorialVersionAction = 'draft_save',
): EditorialEntryWriteInput {
  return {
    entryId: entry.id,
    type: entry.type,
    slug: entry.slug,
    route: entry.route,
    title: entry.title,
    status: entry.status,
    publishMode: entry.publishMode,
    author: entry.author,
    metadata: entry.metadata,
    content: entry.content,
    action,
  };
}

function fillCommonValues(input: EditorialEntryWriteInput): EditorialFormValues {
  return {
    entryId: input.entryId,
    slug: input.slug,
    title: input.title,
    route: input.route || getEditorialRouteForType(input.type, input.slug),
    summary: input.summary,
    sourceId: input.metadata.sourceId,
    sourceOrigin: input.metadata.sourceOrigin,
    author: input.author,
  };
}

export function buildEditorialFormValues(input: EditorialEntryWriteInput): EditorialFormValues {
  const common = fillCommonValues(input);

  switch (input.type) {
    case 'pressemitteilung': {
      const content = input.content as PressReleaseDraftContent;
      return {
        ...common,
        date: content.date,
        ressort: content.ressort,
        teaser: content.teaser,
        imageUrl: content.imageUrl,
        mediaKey: content.mediaKey,
        imageAlt: content.imageAlt,
        imageCredit: content.imageCredit,
        tagsText: formatCsvForInput(content.tags),
        bodyText: formatParagraphsForTextarea(content.body),
        isFeatured: content.isFeatured,
        relatedTopicSlugsText: formatCsvForInput(content.relatedTopicSlugs),
        relatedNormSlugsText: formatCsvForInput(content.relatedNormSlugs),
        relatedPressSlugsText: formatCsvForInput(content.relatedPressSlugs),
      };
    }
    case 'termin': {
      const content = input.content as EventDraftContent;
      return {
        ...common,
        date: content.date,
        location: content.location,
        teaser: content.teaser,
        bodyText: formatParagraphsForTextarea(content.body),
        imageUrl: content.imageUrl,
        mediaKey: content.mediaKey,
        imageAlt: content.imageAlt,
      };
    }
    case 'stellenangebot': {
      const content = input.content as JobDraftContent;
      return {
        ...common,
        ressort: content.ressort,
        standort: content.standort,
        arbeitsbereich: content.arbeitsbereich,
        datePosted: content.datePosted,
        applicationDeadline: content.applicationDeadline,
        employmentType: content.employmentType,
        payGrade: content.payGrade,
        teaser: content.teaser,
        bodyText: formatParagraphsForTextarea(content.body),
        contactName: content.contact?.name,
        contactEmail: content.contact?.email,
        contactTelefon: content.contact?.telefon,
        contactReferat: content.contact?.referat,
        imageUrl: content.imageUrl,
        mediaKey: content.mediaKey,
        imageAlt: content.imageAlt,
        imageCredit: content.imageCredit,
        isActive: content.isActive,
      };
    }
    case 'projektstatus': {
      const content = input.content as ProjectStatusDraftContent;
      return {
        ...common,
        description: content.description,
        projectStatus: content.status,
        ressort: content.ressort,
        href: content.href,
        position: content.position,
        referencesText: formatActionPlanReferencesForTextarea(content.references),
      };
    }
    case 'service-seite': {
      const content = input.content as ServicePageDraftContent;
      return {
        ...common,
        bodyText: formatParagraphsForTextarea(content.body),
      };
    }
    case 'themenseite': {
      const content = input.content as TopicDraftContent;
      return {
        ...common,
        teaser: content.teaser,
        topicStatus: content.status,
        hero: content.hero,
        beschlossenText: formatLinesForTextarea(content.beschlossen),
        umgesetztText: formatLinesForTextarea(content.umgesetzt),
        naechsteSchritteText: formatLinesForTextarea(content.naechsteSchritte),
        rechtsgrundlagenText: formatTopicReferencesForTextarea(content.rechtsgrundlagen),
        faqText: formatFaqForTextarea(content.faq),
        federfuehrendesRessort: content.federfuehrendesRessort,
        mitzeichnungsressortsText: formatCsvForInput(content.mitzeichnungsressorts),
      };
    }
    case 'ressort': {
      const content = input.content as MinistryDraftContent;
      return {
        ...common,
        name: content.name,
        kurzname: content.kurzname,
        leitung: content.leitung,
        teaser: content.teaser,
        aufgabenText: formatLinesForTextarea(content.aufgaben),
        contactName: content.kontakt?.name,
        contactEmail: content.kontakt?.email,
        contactTelefon: content.kontakt?.telefon,
        contactReferat: content.kontakt?.referat,
        imageUrl: content.imageUrl,
        mediaKey: content.mediaKey,
        imageAlt: content.imageAlt,
        imageCredit: content.imageCredit,
        themenText: formatLinesForTextarea(content.themen),
        verknuepfteLinksText: formatLinksForTextarea(content.verknuepfteLinks),
      };
    }
    case 'regierungsmitglied': {
      const content = input.content as GovernmentMemberDraftContent;
      return {
        ...common,
        name: content.name,
        amt: content.amt,
        ressort: content.ressort,
        reihenfolge: content.reihenfolge,
        kurzbiografie: content.kurzbiografie,
        langbiografieText: formatParagraphsForTextarea(content.langbiografie),
        imageUrl: content.imageUrl,
        mediaKey: content.mediaKey,
        imageAlt: content.imageAlt,
        imageCredit: content.imageCredit,
        contactName: content.kontakt?.name,
        contactEmail: content.kontakt?.email,
        contactTelefon: content.kontakt?.telefon,
        contactReferat: content.kontakt?.referat,
        zitat: content.zitat,
      };
    }
  }
}

export function getEditorialPreviewRoute(type: EditorialEntryType, slug: string, route?: string): string {
  return route?.trim() || getEditorialRouteForType(type, slug);
}

export function buildDraftFromContent(
  type: EditorialEntryType,
  slug: string,
  title: string,
  content: EditorialEntryContent,
  options: {
    entryId?: string;
    route?: string;
    author?: string;
    status?: EditorialEntryStatus;
    sourceId?: string;
    sourceOrigin?: 'd1' | 'file' | 'manual';
  } = {},
): EditorialEntryWriteInput {
  return {
    entryId: options.entryId,
    type,
    slug,
    title,
    route: options.route ?? getEditorialRouteForType(type, slug),
    status: options.status ?? 'draft',
    publishMode: getEditorialTypeDefinition(type).publishMode,
    author: options.author,
    metadata: {
      sourceId: options.sourceId,
      sourceOrigin: options.sourceOrigin,
    },
    content,
    action: 'draft_save',
  };
}

import { withBase } from '../portal/routes.ts';

export const editorialEntryTypes = [
  'pressemitteilung',
  'termin',
  'stellenangebot',
  'projektstatus',
  'service-seite',
  'themenseite',
  'ressort',
  'regierungsmitglied',
] as const;

export type EditorialEntryType = (typeof editorialEntryTypes)[number];
export type EditorialEntryStatus = 'draft' | 'published' | 'export_ready';
export type EditorialVersionAction = 'draft_save' | 'publish' | 'export';
export type EditorialPublishMode = 'direct' | 'override';
export type EditorialSourceOrigin = 'manual' | 'd1' | 'file';

export interface EditorialTypeDefinition {
  type: EditorialEntryType;
  label: string;
  pluralLabel: string;
  description: string;
  publishMode: EditorialPublishMode;
  directPublishLabel: string;
  routeBuilder: (slug: string) => string;
  exportPathBuilder?: (slug: string) => string;
}

export const editorialTypeDefinitions: Record<EditorialEntryType, EditorialTypeDefinition> = {
  pressemitteilung: {
    type: 'pressemitteilung',
    label: 'Pressemitteilung',
    pluralLabel: 'Pressemitteilungen',
    description: 'Amtliche Meldungen mit D1-Publish in den Pressebereich.',
    publishMode: 'direct',
    directPublishLabel: 'Direkt live in D1 veröffentlichen',
    routeBuilder: (slug) => withBase(`/presse/pressemitteilungen/${slug}/`),
  },
  termin: {
    type: 'termin',
    label: 'Termin',
    pluralLabel: 'Termine',
    description: 'Öffentliche Termine und Veranstaltungen mit D1-Publish.',
    publishMode: 'direct',
    directPublishLabel: 'Direkt live in D1 veröffentlichen',
    routeBuilder: (slug) => withBase(`/presse/termine/${slug}/`),
  },
  stellenangebot: {
    type: 'stellenangebot',
    label: 'Stellenangebot',
    pluralLabel: 'Stellenangebote',
    description: 'Ausschreibungen für den Karrierebereich mit D1-Publish.',
    publishMode: 'direct',
    directPublishLabel: 'Direkt live in D1 veröffentlichen',
    routeBuilder: (slug) => withBase(`/service/karriere/${slug}/`),
  },
  projektstatus: {
    type: 'projektstatus',
    label: 'Projektstatus',
    pluralLabel: 'Projektstatus',
    description: 'Einträge für das 15-Punkte-Dashboard mit D1-Publish.',
    publishMode: 'direct',
    directPublishLabel: 'Direkt live in D1 veröffentlichen',
    routeBuilder: (slug) => withBase(`/staatsregierung/15-punkte-plan/#${slug}`),
  },
  'service-seite': {
    type: 'service-seite',
    label: 'Service-Seite',
    pluralLabel: 'Service-Seiten',
    description: 'Dateibasierte Service-Grundseiten mit Live-Override bei weiterem statischem Fallback.',
    publishMode: 'override',
    directPublishLabel: 'Live-Override veröffentlichen',
    routeBuilder: (slug) => withBase(`/service/${slug}/`),
    exportPathBuilder: (slug) => `content/service/seiten/${slug}.json`,
  },
  themenseite: {
    type: 'themenseite',
    label: 'Themenseite',
    pluralLabel: 'Themenseiten',
    description: 'Themenseiten mit Live-Override bei weiterem dateibasiertem Fallback.',
    publishMode: 'override',
    directPublishLabel: 'Live-Override veröffentlichen',
    routeBuilder: (slug) => withBase(`/themen/${slug}/`),
    exportPathBuilder: (slug) => `content/themen/${slug}.json`,
  },
  ressort: {
    type: 'ressort',
    label: 'Ressort',
    pluralLabel: 'Ressorts',
    description: 'Ressortprofile mit Live-Override über der statischen Regierungsarchitektur.',
    publishMode: 'override',
    directPublishLabel: 'Live-Override veröffentlichen',
    routeBuilder: (slug) => withBase(`/staatsregierung/kabinett/${slug}/`),
    exportPathBuilder: (slug) => `content/ressorts/${slug}.json`,
  },
  regierungsmitglied: {
    type: 'regierungsmitglied',
    label: 'Regierungsmitglied',
    pluralLabel: 'Regierungsmitglieder',
    description: 'Mitgliederprofile mit Live-Override bei statischem Fallback.',
    publishMode: 'override',
    directPublishLabel: 'Live-Override veröffentlichen',
    routeBuilder: (slug) => withBase(`/staatsregierung/mitglieder/${slug}/`),
    exportPathBuilder: (slug) => `content/regierung/mitglieder/${slug}.json`,
  },
};

export function isEditorialEntryType(value: string | undefined): value is EditorialEntryType {
  return editorialEntryTypes.includes(value as EditorialEntryType);
}

export function getEditorialTypeDefinition(type: EditorialEntryType): EditorialTypeDefinition {
  return editorialTypeDefinitions[type];
}

export function getEditorialRouteForType(
  type: EditorialEntryType,
  slug: string,
  explicitRoute?: string | null,
): string {
  const normalizedExplicitRoute = explicitRoute?.trim();

  if (normalizedExplicitRoute) {
    if (/^https?:\/\//iu.test(normalizedExplicitRoute)) {
      return normalizedExplicitRoute;
    }

    return normalizedExplicitRoute.startsWith('/')
      ? withBase(normalizedExplicitRoute)
      : withBase(`/${normalizedExplicitRoute}`);
  }

  return getEditorialTypeDefinition(type).routeBuilder(slug);
}

export function formatEditorialStatus(status: EditorialEntryStatus): string {
  switch (status) {
    case 'draft':
      return 'Entwurf';
    case 'published':
      return 'Veröffentlicht';
    case 'export_ready':
      return 'Export bereit';
    default:
      return status;
  }
}

export function formatEditorialPublishMode(mode: EditorialPublishMode): string {
  return mode === 'direct' ? 'Direktpublish' : 'Live-Override';
}

export function getEditorialStatusTone(status: EditorialEntryStatus): 'blue' | 'green' | 'amber' {
  switch (status) {
    case 'published':
      return 'green';
    case 'export_ready':
      return 'amber';
    default:
      return 'blue';
  }
}

export function getEditorialStoragePath(type: EditorialEntryType, slug: string): string | undefined {
  return getEditorialTypeDefinition(type).exportPathBuilder?.(slug);
}

export function isEditorialOverrideType(type: EditorialEntryType): boolean {
  return getEditorialTypeDefinition(type).publishMode === 'override';
}

export function toDatabasePublishMode(mode: EditorialPublishMode): 'direct' | 'export' {
  return mode === 'override' ? 'export' : 'direct';
}

export function fromDatabasePublishMode(value: 'direct' | 'export'): EditorialPublishMode {
  return value === 'export' ? 'override' : 'direct';
}

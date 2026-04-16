import { actionPlanItems as staticActionPlanItems } from '../../data/dashboard/action-plan.ts';
import { listEvents, listJobs, listPressReleases, listProjectStatuses } from '../dynamic/repository.ts';
import type { ActionPlanItem } from '../portal/modules.ts';
import {
  parseMinisterium,
  parsePressemitteilung,
  parseRegierungMitglied,
  parseSeite,
  parseStellenangebot,
  parseTermin,
  parseThemenseite,
  type Ministerium,
  type Pressemitteilung,
  type RegierungMitglied,
  type Seite,
  type Stellenangebot,
  type Termin,
  type Themenseite,
} from '../portal/schema.ts';
import type { EditorialEntryWriteInput, EditorialSourceSummary } from './schema.ts';
import { buildDraftFromContent } from './drafts.ts';
import { getEditorialRouteForType, type EditorialEntryType } from './studio.ts';

function toContentPath(filePath: string): string {
  const marker = '/content/';
  const markerIndex = filePath.indexOf(marker);

  if (markerIndex >= 0) {
    return `content/${filePath.slice(markerIndex + marker.length)}`;
  }

  return filePath;
}

const pressReleaseModules = import.meta.glob('../../../content/presse/mitteilungen/*.json', {
  eager: true,
  import: 'default',
});

const eventModules = import.meta.glob('../../../content/presse/termine/*.json', {
  eager: true,
  import: 'default',
});

const jobModules = import.meta.glob('../../../content/service/stellen/*.json', {
  eager: true,
  import: 'default',
});

const servicePageModules = import.meta.glob('../../../content/service/seiten/*.json', {
  eager: true,
  import: 'default',
});

const topicModules = import.meta.glob('../../../content/themen/*.json', {
  eager: true,
  import: 'default',
});

const ministryModules = import.meta.glob('../../../content/ressorts/*.json', {
  eager: true,
  import: 'default',
});

const governmentMemberModules = import.meta.glob('../../../content/regierung/mitglieder/*.json', {
  eager: true,
  import: 'default',
});

const staticPressReleases = Object.entries(pressReleaseModules)
  .map(([filePath, value]) => parsePressemitteilung(value, toContentPath(filePath)))
  .sort((left, right) => right.date.localeCompare(left.date));

const staticEvents = Object.entries(eventModules)
  .map(([filePath, value]) => parseTermin(value, toContentPath(filePath)))
  .sort((left, right) => left.date.localeCompare(right.date));

const staticJobs = Object.entries(jobModules)
  .map(([filePath, value]) => parseStellenangebot(value, toContentPath(filePath)))
  .sort((left, right) => right.datePosted.localeCompare(left.datePosted));

const staticServicePages = Object.entries(servicePageModules)
  .map(([filePath, value]) => parseSeite(value, toContentPath(filePath)))
  .sort((left, right) => left.title.localeCompare(right.title));

const staticTopics = Object.entries(topicModules)
  .map(([filePath, value]) => parseThemenseite(value, toContentPath(filePath)))
  .sort((left, right) => left.title.localeCompare(right.title));

const staticMinistries = Object.entries(ministryModules)
  .map(([filePath, value]) => parseMinisterium(value, toContentPath(filePath)))
  .sort((left, right) => left.name.localeCompare(right.name));

const staticGovernmentMembers = Object.entries(governmentMemberModules)
  .map(([filePath, value]) => parseRegierungMitglied(value, toContentPath(filePath)))
  .sort((left, right) => left.reihenfolge - right.reihenfolge);

function createSourceSummary(
  type: EditorialEntryType,
  slug: string,
  title: string,
  sourceOrigin: 'd1' | 'file',
  description?: string,
  updatedAt?: string,
): EditorialSourceSummary {
  return {
    id: slug,
    slug,
    title,
    route: getEditorialRouteForType(type, slug),
    sourceOrigin,
    description,
    updatedAt,
  };
}

function mapPressReleaseSource(
  release: Pressemitteilung,
  sourceOrigin: 'd1' | 'file',
): EditorialSourceSummary {
  return createSourceSummary(
    'pressemitteilung',
    release.slug,
    release.title,
    sourceOrigin,
    `${release.date} · ${release.ressort}`,
    release.date,
  );
}

function mapEventSource(event: Termin, sourceOrigin: 'd1' | 'file'): EditorialSourceSummary {
  return createSourceSummary(
    'termin',
    event.slug,
    event.title,
    sourceOrigin,
    `${event.date} · ${event.location}`,
    event.date,
  );
}

function mapJobSource(job: Stellenangebot, sourceOrigin: 'd1' | 'file'): EditorialSourceSummary {
  return createSourceSummary(
    'stellenangebot',
    job.slug,
    job.title,
    sourceOrigin,
    `${job.ressort} · ${job.standort}`,
    job.datePosted,
  );
}

function mapProjectStatusSource(item: ActionPlanItem, position: number): EditorialSourceSummary {
  return createSourceSummary(
    'projektstatus',
    item.id,
    item.title,
    'd1',
    `${position}. ${item.ressort} · ${item.status}`,
  );
}

function mapServicePageSource(page: Seite): EditorialSourceSummary {
  return createSourceSummary('service-seite', page.slug, page.title, 'file', 'Dateibasierte Serviceseite');
}

function mapTopicSource(topic: Themenseite): EditorialSourceSummary {
  return createSourceSummary('themenseite', topic.slug, topic.title, 'file', topic.teaser);
}

function mapMinistrySource(ministry: Ministerium): EditorialSourceSummary {
  return createSourceSummary('ressort', ministry.slug, ministry.name, 'file', ministry.leitung);
}

function mapGovernmentMemberSource(member: RegierungMitglied): EditorialSourceSummary {
  return createSourceSummary('regierungsmitglied', member.slug, member.name, 'file', member.amt);
}

export async function listEditorialSources(
  database: D1Database,
  type: EditorialEntryType,
): Promise<EditorialSourceSummary[]> {
  switch (type) {
    case 'pressemitteilung': {
      const releases = await listPressReleases(database);
      const sourceItems = releases.length > 0 ? releases : staticPressReleases;
      return sourceItems.map((entry) => mapPressReleaseSource(entry, releases.length > 0 ? 'd1' : 'file'));
    }
    case 'termin': {
      const events = await listEvents(database);
      const sourceItems = events.length > 0 ? events : staticEvents;
      return sourceItems.map((entry) => mapEventSource(entry, events.length > 0 ? 'd1' : 'file'));
    }
    case 'stellenangebot': {
      const jobs = await listJobs(database, { includeInactive: true });
      const sourceItems = jobs.length > 0 ? jobs : staticJobs;
      return sourceItems.map((entry) => mapJobSource(entry, jobs.length > 0 ? 'd1' : 'file'));
    }
    case 'projektstatus': {
      const items = await listProjectStatuses(database);
      const sourceItems = items.length > 0 ? items : staticActionPlanItems;
      return sourceItems.map((entry, index) => mapProjectStatusSource(entry, index + 1));
    }
    case 'service-seite':
      return staticServicePages.map(mapServicePageSource);
    case 'themenseite':
      return staticTopics.map(mapTopicSource);
    case 'ressort':
      return staticMinistries.map(mapMinistrySource);
    case 'regierungsmitglied':
      return staticGovernmentMembers.map(mapGovernmentMemberSource);
  }
}

function findBySlug<T extends { slug: string }>(items: T[], sourceId: string): T | undefined {
  return items.find((entry) => entry.slug === sourceId);
}

function buildPressReleaseDraft(
  source: Pressemitteilung,
  sourceOrigin: 'd1' | 'file',
): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'pressemitteilung',
    source.slug,
    source.title,
    {
      date: source.date,
      ressort: source.ressort,
      teaser: source.teaser,
      imageUrl: source.image,
      imageAlt: source.imageAlt,
      imageCredit: source.imageCredit,
      tags: source.tags,
      body: source.body,
      isFeatured: source.isFeatured,
      relatedTopicSlugs: source.relatedTopicSlugs ?? [],
      relatedNormSlugs: source.relatedNormSlugs ?? [],
      relatedPressSlugs: source.relatedPressSlugs ?? [],
    },
    {
      sourceId: source.slug,
      sourceOrigin,
    },
  );
}

function buildEventDraft(source: Termin, sourceOrigin: 'd1' | 'file'): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'termin',
    source.slug,
    source.title,
    {
      date: source.date,
      location: source.location,
      teaser: source.teaser,
      body: source.body,
    },
    {
      sourceId: source.slug,
      sourceOrigin,
    },
  );
}

function buildJobDraft(source: Stellenangebot, sourceOrigin: 'd1' | 'file'): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'stellenangebot',
    source.slug,
    source.title,
    {
      ressort: source.ressort,
      standort: source.standort,
      arbeitsbereich: source.arbeitsbereich,
      datePosted: source.datePosted,
      applicationDeadline: source.applicationDeadline,
      employmentType: source.employmentType,
      payGrade: source.payGrade,
      teaser: source.teaser,
      body: source.body,
      contact: source.contact,
      imageUrl: source.image,
      imageAlt: source.imageAlt,
      imageCredit: source.imageCredit,
      isActive: true,
    },
    {
      sourceId: source.slug,
      sourceOrigin,
    },
  );
}

function buildProjectStatusDraft(source: ActionPlanItem, position: number): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'projektstatus',
    source.id,
    source.title,
    {
      description: source.description,
      status: source.status,
      ressort: source.ressort,
      href: source.href,
      position,
      references: source.references ?? [],
    },
    {
      sourceId: source.id,
      sourceOrigin: 'd1',
    },
  );
}

function buildServicePageDraft(source: Seite): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'service-seite',
    source.slug,
    source.title,
    {
      body: source.body,
    },
    {
      sourceId: source.slug,
      sourceOrigin: 'file',
    },
  );
}

function buildTopicDraft(source: Themenseite): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'themenseite',
    source.slug,
    source.title,
    {
      teaser: source.teaser,
      status: source.status,
      hero: source.hero,
      beschlossen: source.beschlossen,
      umgesetzt: source.umgesetzt,
      naechsteSchritte: source.naechsteSchritte,
      rechtsgrundlagen: source.rechtsgrundlagen,
      faq: source.faq,
      federfuehrendesRessort: source.federfuehrendesRessort,
      mitzeichnungsressorts: source.mitzeichnungsressorts ?? [],
    },
    {
      sourceId: source.slug,
      sourceOrigin: 'file',
    },
  );
}

function buildMinistryDraft(source: Ministerium): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'ressort',
    source.slug,
    source.name,
    {
      name: source.name,
      kurzname: source.kurzname,
      leitung: source.leitung,
      teaser: source.teaser,
      aufgaben: source.aufgaben,
      kontakt: source.kontakt,
      imageUrl: source.bild,
      imageAlt: source.bildAlt,
      imageCredit: source.bildnachweis,
      themen: source.themen,
      verknuepfteLinks: source.verknuepfteLinks,
    },
    {
      sourceId: source.slug,
      sourceOrigin: 'file',
    },
  );
}

function buildGovernmentMemberDraft(source: RegierungMitglied): EditorialEntryWriteInput {
  return buildDraftFromContent(
    'regierungsmitglied',
    source.slug,
    source.name,
    {
      name: source.name,
      amt: source.amt,
      ressort: source.ressort,
      reihenfolge: source.reihenfolge,
      kurzbiografie: source.kurzbiografie,
      langbiografie: source.langbiografie,
      imageUrl: source.bild,
      imageAlt: source.bildAlt,
      imageCredit: source.bildnachweis,
      kontakt: source.kontakt,
      zitat: source.zitat,
    },
    {
      sourceId: source.slug,
      sourceOrigin: 'file',
    },
  );
}

export async function getEditorialSourceDraft(
  database: D1Database,
  type: EditorialEntryType,
  sourceOrigin: 'd1' | 'file',
  sourceId: string,
): Promise<EditorialEntryWriteInput | undefined> {
  switch (type) {
    case 'pressemitteilung': {
      if (sourceOrigin === 'd1') {
        const match = (await listPressReleases(database)).find((entry) => entry.slug === sourceId);
        return match ? buildPressReleaseDraft(match, 'd1') : undefined;
      }

      const match = findBySlug(staticPressReleases, sourceId);
      return match ? buildPressReleaseDraft(match, 'file') : undefined;
    }
    case 'termin': {
      if (sourceOrigin === 'd1') {
        const match = (await listEvents(database)).find((entry) => entry.slug === sourceId);
        return match ? buildEventDraft(match, 'd1') : undefined;
      }

      const match = findBySlug(staticEvents, sourceId);
      return match ? buildEventDraft(match, 'file') : undefined;
    }
    case 'stellenangebot': {
      if (sourceOrigin === 'd1') {
        const match = (await listJobs(database, { includeInactive: true })).find((entry) => entry.slug === sourceId);
        return match ? buildJobDraft(match, 'd1') : undefined;
      }

      const match = findBySlug(staticJobs, sourceId);
      return match ? buildJobDraft(match, 'file') : undefined;
    }
    case 'projektstatus': {
      const items = await listProjectStatuses(database);
      const sourceItems = items.length > 0 ? items : staticActionPlanItems;
      const match = sourceItems.find((entry) => entry.id === sourceId);
      const position = sourceItems.findIndex((entry) => entry.id === sourceId);
      return match && position >= 0 ? buildProjectStatusDraft(match, position + 1) : undefined;
    }
    case 'service-seite': {
      const match = findBySlug(staticServicePages, sourceId);
      return match ? buildServicePageDraft(match) : undefined;
    }
    case 'themenseite': {
      const match = findBySlug(staticTopics, sourceId);
      return match ? buildTopicDraft(match) : undefined;
    }
    case 'ressort': {
      const match = findBySlug(staticMinistries, sourceId);
      return match ? buildMinistryDraft(match) : undefined;
    }
    case 'regierungsmitglied': {
      const match = findBySlug(staticGovernmentMembers, sourceId);
      return match ? buildGovernmentMemberDraft(match) : undefined;
    }
  }
}

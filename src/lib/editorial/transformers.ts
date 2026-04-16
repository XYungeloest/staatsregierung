import { buildMediaPath, resolveStoredMediaUrl } from '../dynamic/media.ts';
import type { PortalLink } from '../portal/schema.ts';
import {
  parseMinisterium,
  parsePressemitteilung,
  parseRegierungMitglied,
  parseSeite,
  parseStellenangebot,
  parseTermin,
  parseThemenseite,
  PortalContentValidationError,
} from '../portal/schema.ts';
import type { ActionPlanReference } from '../portal/modules.ts';
import type {
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
import { getEditorialStoragePath } from './studio.ts';

export interface EditorialExportArtifact {
  path: string;
  filename: string;
  payload: unknown;
}

function execute(database: D1Database, query: string, bindings: unknown[] = []): Promise<D1ExecResult> {
  const statement = bindings.length > 0 ? database.prepare(query).bind(...bindings) : database.prepare(query);
  return statement.run();
}

function resolveRequiredImage(
  mediaKey: string | undefined,
  imageUrl: string | undefined,
  path: string,
): string {
  const image = resolveStoredMediaUrl({
    mediaKey,
    mediaUrl: imageUrl,
  });

  if (!image) {
    throw new PortalContentValidationError(`${path}: benötigt imageUrl oder mediaKey`);
  }

  return image;
}

function mediaValueForExport(mediaKey: string | undefined, imageUrl: string | undefined): string | undefined {
  if (imageUrl?.trim()) {
    return imageUrl.trim();
  }

  if (mediaKey?.trim()) {
    return buildMediaPath(mediaKey.trim());
  }

  return undefined;
}

export function buildPressReleasePayload(input: EditorialEntryWriteInput) {
  const content = input.content as PressReleaseDraftContent;

  return parsePressemitteilung(
    {
      slug: input.slug,
      title: input.title,
      date: content.date,
      ressort: content.ressort,
      teaser: content.teaser,
      image: resolveRequiredImage(content.mediaKey, content.imageUrl, `editor.${input.type}.image`),
      imageAlt: content.imageAlt,
      imageCredit: content.imageCredit,
      tags: content.tags,
      body: content.body,
      isFeatured: content.isFeatured,
      relatedTopicSlugs: content.relatedTopicSlugs.length > 0 ? content.relatedTopicSlugs : undefined,
      relatedNormSlugs: content.relatedNormSlugs.length > 0 ? content.relatedNormSlugs : undefined,
      relatedPressSlugs: content.relatedPressSlugs.length > 0 ? content.relatedPressSlugs : undefined,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildEventPayload(input: EditorialEntryWriteInput) {
  const content = input.content as EventDraftContent;

  return parseTermin(
    {
      slug: input.slug,
      title: input.title,
      date: content.date,
      location: content.location,
      teaser: content.teaser,
      body: content.body,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildJobPayload(input: EditorialEntryWriteInput) {
  const content = input.content as JobDraftContent;

  return parseStellenangebot(
    {
      slug: input.slug,
      title: input.title,
      ressort: content.ressort,
      standort: content.standort,
      arbeitsbereich: content.arbeitsbereich,
      datePosted: content.datePosted,
      applicationDeadline: content.applicationDeadline,
      employmentType: content.employmentType,
      payGrade: content.payGrade,
      teaser: content.teaser,
      body: content.body,
      contact: content.contact,
      image: mediaValueForExport(content.mediaKey, content.imageUrl),
      imageAlt: content.imageAlt,
      imageCredit: content.imageCredit,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildProjectStatusPayload(input: EditorialEntryWriteInput) {
  const content = input.content as ProjectStatusDraftContent;

  if (!Number.isFinite(content.position)) {
    throw new PortalContentValidationError(`editor.${input.type}[${input.slug}].position: muss eine Zahl sein`);
  }

  if (!content.href.trim()) {
    throw new PortalContentValidationError(`editor.${input.type}[${input.slug}].href: muss gesetzt sein`);
  }

  return {
    id: input.slug,
    title: input.title,
    description: content.description.trim(),
    status: content.status,
    ressort: content.ressort.trim(),
    href: content.href.trim(),
    references: content.references,
    position: content.position,
  };
}

export function buildServicePagePayload(input: EditorialEntryWriteInput) {
  const content = input.content as ServicePageDraftContent;

  return parseSeite(
    {
      slug: input.slug,
      title: input.title,
      body: content.body,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildTopicPayload(input: EditorialEntryWriteInput) {
  const content = input.content as TopicDraftContent;

  return parseThemenseite(
    {
      slug: input.slug,
      title: input.title,
      teaser: content.teaser,
      status: content.status,
      hero: content.hero,
      beschlossen: content.beschlossen,
      umgesetzt: content.umgesetzt,
      naechsteSchritte: content.naechsteSchritte,
      rechtsgrundlagen: content.rechtsgrundlagen,
      faq: content.faq,
      federfuehrendesRessort: content.federfuehrendesRessort,
      mitzeichnungsressorts: content.mitzeichnungsressorts.length > 0 ? content.mitzeichnungsressorts : undefined,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildMinistryPayload(input: EditorialEntryWriteInput) {
  const content = input.content as MinistryDraftContent;

  return parseMinisterium(
    {
      slug: input.slug,
      name: content.name,
      kurzname: content.kurzname,
      leitung: content.leitung,
      teaser: content.teaser,
      aufgaben: content.aufgaben,
      kontakt: content.kontakt ?? {},
      bild: resolveRequiredImage(content.mediaKey, content.imageUrl, `editor.${input.type}.bild`),
      bildAlt: content.imageAlt,
      bildnachweis: content.imageCredit ?? '',
      themen: content.themen,
      verknuepfteLinks: content.verknuepfteLinks,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildGovernmentMemberPayload(input: EditorialEntryWriteInput) {
  const content = input.content as GovernmentMemberDraftContent;

  return parseRegierungMitglied(
    {
      slug: input.slug,
      name: content.name,
      amt: content.amt,
      ressort: content.ressort,
      reihenfolge: content.reihenfolge,
      kurzbiografie: content.kurzbiografie,
      langbiografie: content.langbiografie,
      bild: resolveRequiredImage(content.mediaKey, content.imageUrl, `editor.${input.type}.bild`),
      bildAlt: content.imageAlt,
      bildnachweis: content.imageCredit ?? '',
      kontakt: content.kontakt,
      zitat: content.zitat,
    },
    `editor.${input.type}[${input.slug}]`,
  );
}

export function buildContentPayload(input: EditorialEntryWriteInput): unknown {
  switch (input.type) {
    case 'pressemitteilung':
      return buildPressReleasePayload(input);
    case 'termin':
      return buildEventPayload(input);
    case 'stellenangebot':
      return buildJobPayload(input);
    case 'projektstatus':
      return buildProjectStatusPayload(input);
    case 'service-seite':
      return buildServicePagePayload(input);
    case 'themenseite':
      return buildTopicPayload(input);
    case 'ressort':
      return buildMinistryPayload(input);
    case 'regierungsmitglied':
      return buildGovernmentMemberPayload(input);
    default:
      throw new Error(`Inhaltstyp "${input.type}" wird nicht unterstützt.`);
  }
}

export function buildExportArtifact(input: EditorialEntryWriteInput): EditorialExportArtifact {
  const storagePath = getEditorialStoragePath(input.type, input.slug);

  if (!storagePath) {
    throw new Error(`Für ${input.type} ist kein Exportpfad definiert.`);
  }

  const payload = buildContentPayload(input);

  return {
    path: storagePath,
    filename: storagePath.split('/').at(-1) ?? `${input.slug}.json`,
    payload,
  };
}

export async function publishDirectContent(
  database: D1Database,
  input: EditorialEntryWriteInput,
): Promise<unknown> {
  switch (input.type) {
    case 'pressemitteilung': {
      const payload = buildPressReleasePayload(input);
      const content = input.content as PressReleaseDraftContent;
      const result = await execute(
        database,
        `
          INSERT INTO press_releases (
            slug,
            title,
            published_at,
            ressort,
            teaser,
            image_url,
            media_key,
            image_alt,
            image_credit,
            tags_json,
            body_json,
            is_featured,
            related_topic_slugs_json,
            related_norm_slugs_json,
            related_press_slugs_json,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(slug) DO UPDATE SET
            title = excluded.title,
            published_at = excluded.published_at,
            ressort = excluded.ressort,
            teaser = excluded.teaser,
            image_url = excluded.image_url,
            media_key = excluded.media_key,
            image_alt = excluded.image_alt,
            image_credit = excluded.image_credit,
            tags_json = excluded.tags_json,
            body_json = excluded.body_json,
            is_featured = excluded.is_featured,
            related_topic_slugs_json = excluded.related_topic_slugs_json,
            related_norm_slugs_json = excluded.related_norm_slugs_json,
            related_press_slugs_json = excluded.related_press_slugs_json,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          payload.slug,
          payload.title,
          payload.date,
          payload.ressort,
          payload.teaser,
          content.imageUrl ?? null,
          content.mediaKey ?? null,
          payload.imageAlt,
          payload.imageCredit,
          JSON.stringify(payload.tags),
          JSON.stringify(payload.body),
          payload.isFeatured ? 1 : 0,
          JSON.stringify(payload.relatedTopicSlugs ?? []),
          JSON.stringify(payload.relatedNormSlugs ?? []),
          JSON.stringify(payload.relatedPressSlugs ?? []),
        ],
      );

      if (!result.success) {
        throw new Error('Pressemitteilung konnte nicht veröffentlicht werden.');
      }

      return payload;
    }

    case 'termin': {
      const payload = buildEventPayload(input);
      const content = input.content as EventDraftContent;
      const result = await execute(
        database,
        `
          INSERT INTO events (
            slug,
            title,
            event_date,
            location,
            teaser,
            body_json,
            image_url,
            media_key,
            image_alt,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(slug) DO UPDATE SET
            title = excluded.title,
            event_date = excluded.event_date,
            location = excluded.location,
            teaser = excluded.teaser,
            body_json = excluded.body_json,
            image_url = excluded.image_url,
            media_key = excluded.media_key,
            image_alt = excluded.image_alt,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          payload.slug,
          payload.title,
          payload.date,
          payload.location,
          payload.teaser,
          JSON.stringify(payload.body),
          content.imageUrl ?? null,
          content.mediaKey ?? null,
          content.imageAlt ?? null,
        ],
      );

      if (!result.success) {
        throw new Error('Termin konnte nicht veröffentlicht werden.');
      }

      return payload;
    }

    case 'stellenangebot': {
      const payload = buildJobPayload(input);
      const content = input.content as JobDraftContent;
      const result = await execute(
        database,
        `
          INSERT INTO jobs (
            slug,
            title,
            ressort,
            standort,
            arbeitsbereich,
            date_posted,
            application_deadline,
            employment_type,
            pay_grade,
            teaser,
            body_json,
            contact_json,
            image_url,
            media_key,
            image_alt,
            image_credit,
            is_active,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(slug) DO UPDATE SET
            title = excluded.title,
            ressort = excluded.ressort,
            standort = excluded.standort,
            arbeitsbereich = excluded.arbeitsbereich,
            date_posted = excluded.date_posted,
            application_deadline = excluded.application_deadline,
            employment_type = excluded.employment_type,
            pay_grade = excluded.pay_grade,
            teaser = excluded.teaser,
            body_json = excluded.body_json,
            contact_json = excluded.contact_json,
            image_url = excluded.image_url,
            media_key = excluded.media_key,
            image_alt = excluded.image_alt,
            image_credit = excluded.image_credit,
            is_active = excluded.is_active,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          payload.slug,
          payload.title,
          payload.ressort,
          payload.standort,
          payload.arbeitsbereich,
          payload.datePosted,
          payload.applicationDeadline,
          payload.employmentType,
          payload.payGrade ?? null,
          payload.teaser,
          JSON.stringify(payload.body),
          JSON.stringify(payload.contact ?? null),
          content.imageUrl ?? null,
          content.mediaKey ?? null,
          payload.imageAlt ?? null,
          payload.imageCredit ?? null,
          content.isActive ? 1 : 0,
        ],
      );

      if (!result.success) {
        throw new Error('Stellenangebot konnte nicht veröffentlicht werden.');
      }

      return payload;
    }

    case 'projektstatus': {
      const payload = buildProjectStatusPayload(input);
      const result = await execute(
        database,
        `
          INSERT INTO project_status (
            id,
            title,
            description,
            status,
            ressort,
            href,
            references_json,
            position,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            ressort = excluded.ressort,
            href = excluded.href,
            references_json = excluded.references_json,
            position = excluded.position,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          payload.id,
          payload.title,
          payload.description,
          payload.status,
          payload.ressort,
          payload.href,
          JSON.stringify(payload.references),
          payload.position,
        ],
      );

      if (!result.success) {
        throw new Error('Projektstatus konnte nicht veröffentlicht werden.');
      }

      return payload;
    }

    default:
      throw new Error(`Direkte Veröffentlichung ist für ${input.type} nicht vorgesehen.`);
  }
}

export function formatParagraphsForTextarea(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join('\n\n') : '';
}

export function formatLinesForTextarea(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join('\n') : '';
}

export function formatCsvForInput(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : '';
}

export function formatTopicReferencesForTextarea(values: { label: string; normSlug?: string; note?: string }[] | undefined): string {
  if (!values || values.length === 0) {
    return '';
  }

  return values
    .map((entry) => [entry.label, entry.normSlug ?? '', entry.note ?? ''].filter((part, index, items) => part || index < items.length - 1).join(' | '))
    .join('\n');
}

export function formatFaqForTextarea(values: { question: string; answer: string }[] | undefined): string {
  if (!values || values.length === 0) {
    return '';
  }

  return values.map((entry) => `${entry.question} | ${entry.answer}`).join('\n');
}

export function formatLinksForTextarea(values: PortalLink[] | undefined): string {
  if (!values || values.length === 0) {
    return '';
  }

  return values.map((entry) => `${entry.label} | ${entry.href}`).join('\n');
}

export function formatActionPlanReferencesForTextarea(values: ActionPlanReference[] | undefined): string {
  if (!values || values.length === 0) {
    return '';
  }

  return values.map((entry) => `${entry.label} | ${entry.normSlug}`).join('\n');
}

export function getPreviewImage(
  content: EditorialEntryContent,
): { url?: string; alt?: string; credit?: string } {
  if ('mediaKey' in content || 'imageUrl' in content) {
    const record = content as {
      mediaKey?: string;
      imageUrl?: string;
      imageAlt?: string;
      imageCredit?: string;
    };

    return {
      url: resolveStoredMediaUrl({
        mediaKey: record.mediaKey,
        mediaUrl: record.imageUrl,
      }),
      alt: record.imageAlt,
      credit: record.imageCredit,
    };
  }

  return {};
}

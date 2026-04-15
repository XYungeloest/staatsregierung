import type {
  ActionPlanItem,
  ActionPlanReference,
  ActionPlanStatus,
} from '../portal/modules.ts';
import {
  parsePressemitteilung,
  parseStellenangebot,
  parseTermin,
  PortalContentValidationError,
  type PortalContact,
  type Pressemitteilung,
  type Stellenangebot,
  type Termin,
} from '../portal/schema.ts';
import { resolveStoredMediaUrl } from './media.ts';

export interface PressReleaseRow {
  slug: string;
  title: string;
  published_at: string;
  ressort: string;
  teaser: string;
  image_url: string | null;
  media_key: string | null;
  image_alt: string;
  image_credit: string;
  tags_json: string;
  body_json: string;
  is_featured: number | boolean;
  related_topic_slugs_json: string;
  related_norm_slugs_json: string;
  related_press_slugs_json: string;
}

export interface EventRow {
  slug: string;
  title: string;
  event_date: string;
  location: string;
  teaser: string;
  body_json: string;
  image_url: string | null;
  media_key: string | null;
  image_alt: string | null;
}

export interface JobRow {
  slug: string;
  title: string;
  ressort: string;
  standort: string;
  arbeitsbereich: string;
  date_posted: string;
  application_deadline: string;
  employment_type: string;
  pay_grade: string | null;
  teaser: string;
  body_json: string;
  contact_json: string | null;
  image_url: string | null;
  media_key: string | null;
  image_alt: string | null;
  image_credit: string | null;
  is_active: number | boolean;
}

export interface ProjectStatusRow {
  id: string;
  title: string;
  description: string;
  status: string;
  ressort: string;
  href: string;
  references_json: string;
  position: number;
}

function parseJsonText<T>(value: string | null, path: string, fallback: T): T {
  if (value === null || value === '') {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new PortalContentValidationError(`${path}: enthält ungültiges JSON`);
  }
}

function parseStringArray(value: string | null, path: string): string[] {
  const parsed = parseJsonText<unknown>(value, path, []);

  if (!Array.isArray(parsed)) {
    throw new PortalContentValidationError(`${path}: muss ein JSON-Array sein`);
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new PortalContentValidationError(`${path}[${index}]: muss ein nichtleerer String sein`);
    }

    return entry.trim();
  });
}

function parseBodyArray(value: string | null, path: string): string[] {
  return parseStringArray(value, path);
}

function parseContactJson(value: string | null, path: string): PortalContact | undefined {
  if (value === null || value === '') {
    return undefined;
  }

  const parsed = parseJsonText<unknown>(value, path, undefined);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PortalContentValidationError(`${path}: muss ein Objekt sein`);
  }

  return parsed as PortalContact;
}

function parseActionPlanStatus(value: string, path: string): ActionPlanStatus {
  if (value === 'umgesetzt' || value === 'teilweise_umgesetzt' || value === 'angelegt') {
    return value;
  }

  throw new PortalContentValidationError(`${path}: enthält einen unbekannten Status`);
}

function parseReferencesJson(value: string | null, path: string): ActionPlanReference[] | undefined {
  const parsed = parseJsonText<unknown>(value, path, []);

  if (!Array.isArray(parsed)) {
    throw new PortalContentValidationError(`${path}: muss ein JSON-Array sein`);
  }

  if (parsed.length === 0) {
    return undefined;
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new PortalContentValidationError(`${path}[${index}]: muss ein Objekt sein`);
    }

    const record = entry as Record<string, unknown>;
    const label = record.label;
    const normSlug = record.normSlug;

    if (typeof label !== 'string' || label.trim().length === 0) {
      throw new PortalContentValidationError(`${path}[${index}].label: muss ein nichtleerer String sein`);
    }

    if (typeof normSlug !== 'string' || normSlug.trim().length === 0) {
      throw new PortalContentValidationError(
        `${path}[${index}].normSlug: muss ein nichtleerer String sein`,
      );
    }

    return {
      label: label.trim(),
      normSlug: normSlug.trim(),
    };
  });
}

function parseFlag(value: number | boolean): boolean {
  return value === true || value === 1;
}

export function mapPressReleaseRow(row: PressReleaseRow): Pressemitteilung {
  const image = resolveStoredMediaUrl({
    mediaKey: row.media_key,
    mediaUrl: row.image_url,
  });

  if (!image) {
    throw new PortalContentValidationError(
      `press_releases[${row.slug}].image: benötigt image_url oder media_key`,
    );
  }

  const relatedTopicSlugs = parseStringArray(
    row.related_topic_slugs_json,
    `press_releases[${row.slug}].related_topic_slugs_json`,
  );
  const relatedNormSlugs = parseStringArray(
    row.related_norm_slugs_json,
    `press_releases[${row.slug}].related_norm_slugs_json`,
  );
  const relatedPressSlugs = parseStringArray(
    row.related_press_slugs_json,
    `press_releases[${row.slug}].related_press_slugs_json`,
  );

  return parsePressemitteilung(
    {
      slug: row.slug,
      title: row.title,
      date: row.published_at,
      ressort: row.ressort,
      teaser: row.teaser,
      image,
      imageAlt: row.image_alt,
      imageCredit: row.image_credit,
      tags: parseStringArray(row.tags_json, `press_releases[${row.slug}].tags_json`),
      body: parseBodyArray(row.body_json, `press_releases[${row.slug}].body_json`),
      isFeatured: parseFlag(row.is_featured),
      relatedTopicSlugs: relatedTopicSlugs.length > 0 ? relatedTopicSlugs : undefined,
      relatedNormSlugs: relatedNormSlugs.length > 0 ? relatedNormSlugs : undefined,
      relatedPressSlugs: relatedPressSlugs.length > 0 ? relatedPressSlugs : undefined,
    },
    `press_releases[${row.slug}]`,
  );
}

export function mapEventRow(row: EventRow): Termin {
  return parseTermin(
    {
      slug: row.slug,
      title: row.title,
      date: row.event_date,
      location: row.location,
      teaser: row.teaser,
      body: parseBodyArray(row.body_json, `events[${row.slug}].body_json`),
    },
    `events[${row.slug}]`,
  );
}

export function mapJobRow(row: JobRow): Stellenangebot {
  const image = resolveStoredMediaUrl({
    mediaKey: row.media_key,
    mediaUrl: row.image_url,
  });

  return parseStellenangebot(
    {
      slug: row.slug,
      title: row.title,
      ressort: row.ressort,
      standort: row.standort,
      arbeitsbereich: row.arbeitsbereich,
      datePosted: row.date_posted,
      applicationDeadline: row.application_deadline,
      employmentType: row.employment_type,
      payGrade: row.pay_grade ?? undefined,
      teaser: row.teaser,
      body: parseBodyArray(row.body_json, `jobs[${row.slug}].body_json`),
      contact: parseContactJson(row.contact_json, `jobs[${row.slug}].contact_json`),
      image,
      imageAlt: row.image_alt ?? undefined,
      imageCredit: row.image_credit ?? undefined,
    },
    `jobs[${row.slug}]`,
  );
}

export function mapProjectStatusRow(row: ProjectStatusRow): ActionPlanItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: parseActionPlanStatus(row.status, `project_status[${row.id}].status`),
    ressort: row.ressort,
    href: row.href,
    references: parseReferencesJson(
      row.references_json,
      `project_status[${row.id}].references_json`,
    ),
  };
}

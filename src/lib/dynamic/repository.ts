import type { ActionPlanItem } from '../portal/modules.ts';
import type { Pressemitteilung, Stellenangebot, Termin } from '../portal/schema.ts';
import {
  mapEventRow,
  mapJobRow,
  mapPressReleaseRow,
  mapProjectStatusRow,
  type EventRow,
  type JobRow,
  type PressReleaseRow,
  type ProjectStatusRow,
} from './schema.ts';

async function queryAll<T>(
  database: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<T[]> {
  const statement = bindings.length > 0 ? database.prepare(query).bind(...bindings) : database.prepare(query);
  const result = await statement.all<T>();

  if (!result.success) {
    throw new Error(`D1-Abfrage fehlgeschlagen: ${query}`);
  }

  return result.results;
}

async function queryFirst<T>(
  database: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<T | undefined> {
  const rows = await queryAll<T>(database, query, bindings);
  return rows[0];
}

export async function listPressReleases(database: D1Database): Promise<Pressemitteilung[]> {
  const rows = await queryAll<PressReleaseRow>(
    database,
    `
      SELECT
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
        related_press_slugs_json
      FROM press_releases
      ORDER BY published_at DESC, title ASC
    `,
  );

  return rows.map(mapPressReleaseRow);
}

export async function listFeaturedPressReleases(
  database: D1Database,
  limit = 2,
): Promise<Pressemitteilung[]> {
  const rows = await queryAll<PressReleaseRow>(
    database,
    `
      SELECT
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
        related_press_slugs_json
      FROM press_releases
      WHERE is_featured = 1
      ORDER BY published_at DESC, title ASC
      LIMIT ?
    `,
    [limit],
  );

  return rows.map(mapPressReleaseRow);
}

export async function getPressReleaseBySlug(
  database: D1Database,
  slug: string,
): Promise<Pressemitteilung | undefined> {
  const row = await queryFirst<PressReleaseRow>(
    database,
    `
      SELECT
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
        related_press_slugs_json
      FROM press_releases
      WHERE slug = ?
      LIMIT 1
    `,
    [slug],
  );

  return row ? mapPressReleaseRow(row) : undefined;
}

export async function listEvents(database: D1Database): Promise<Termin[]> {
  const rows = await queryAll<EventRow>(
    database,
    `
      SELECT
        slug,
        title,
        event_date,
        location,
        teaser,
        body_json,
        image_url,
        media_key,
        image_alt
      FROM events
      ORDER BY event_date ASC, title ASC
    `,
  );

  return rows.map(mapEventRow);
}

export async function getEventBySlug(
  database: D1Database,
  slug: string,
): Promise<Termin | undefined> {
  const row = await queryFirst<EventRow>(
    database,
    `
      SELECT
        slug,
        title,
        event_date,
        location,
        teaser,
        body_json,
        image_url,
        media_key,
        image_alt
      FROM events
      WHERE slug = ?
      LIMIT 1
    `,
    [slug],
  );

  return row ? mapEventRow(row) : undefined;
}

export async function listJobs(
  database: D1Database,
  options: { includeInactive?: boolean } = {},
): Promise<Stellenangebot[]> {
  const rows = await queryAll<JobRow>(
    database,
    `
      SELECT
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
        is_active
      FROM jobs
      ${options.includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY date_posted DESC, application_deadline ASC, title ASC
    `,
  );

  return rows.map(mapJobRow);
}

export async function getJobBySlug(
  database: D1Database,
  slug: string,
): Promise<Stellenangebot | undefined> {
  const row = await queryFirst<JobRow>(
    database,
    `
      SELECT
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
        is_active
      FROM jobs
      WHERE slug = ?
      LIMIT 1
    `,
    [slug],
  );

  return row ? mapJobRow(row) : undefined;
}

export async function listProjectStatuses(database: D1Database): Promise<ActionPlanItem[]> {
  const rows = await queryAll<ProjectStatusRow>(
    database,
    `
      SELECT
        id,
        title,
        description,
        status,
        ressort,
        href,
        references_json,
        position
      FROM project_status
      ORDER BY position ASC
    `,
  );

  return rows.map(mapProjectStatusRow);
}

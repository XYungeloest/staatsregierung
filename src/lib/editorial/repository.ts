import type {
  EditorialEntryContent,
  EditorialEntry,
  EditorialEntryMetadata,
  EditorialEntryRecord,
  EditorialEntryState,
  EditorialSaveResult,
  EditorialPublishedVersionRow,
  EditorialTypeSummary,
  EditorialVersion,
  EditorialVersionRecord,
  EditorialEntryWriteInput,
  MediaAsset,
  MediaAssetRecord,
  MediaAssetWriteInput,
  PublishLogWriteInput,
} from './schema.ts';
import {
  fromDatabasePublishMode,
  toDatabasePublishMode,
  type EditorialEntryStatus,
  type EditorialEntryType,
} from './studio.ts';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

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
  const statement = bindings.length > 0 ? database.prepare(query).bind(...bindings) : database.prepare(query);
  const result = await statement.first<T>();
  return result ?? undefined;
}

async function execute(
  database: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<void> {
  const statement = bindings.length > 0 ? database.prepare(query).bind(...bindings) : database.prepare(query);
  const result = await statement.run();

  if (!result.success) {
    throw new Error(`D1-Schreibvorgang fehlgeschlagen: ${query}`);
  }
}

function mapEditorialEntry(row: EditorialEntryRecord): EditorialEntry {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    route: row.route,
    title: row.title,
    status: row.status,
    publishMode: fromDatabasePublishMode(row.publish_mode),
    author: row.author ?? undefined,
    metadata: parseJson<EditorialEntryMetadata>(row.metadata_json, {}),
    content: parseJson<EditorialEntryContent>(row.content_json, {} as EditorialEntryContent),
    currentVersionId: row.current_version_id ?? undefined,
    publishedVersionId: row.published_version_id ?? undefined,
    currentVersionNumber: row.current_version_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
  };
}

function mapEditorialVersion(row: EditorialVersionRecord): EditorialVersion {
  return {
    id: row.id,
    entryId: row.entry_id,
    versionNumber: row.version_number,
    status: row.status,
    action: row.action,
    author: row.author ?? undefined,
    summary: row.summary ?? undefined,
    metadata: parseJson<EditorialEntryMetadata>(row.metadata_json, {}),
    content: parseJson<EditorialEntryContent>(row.content_json, {} as EditorialEntryContent),
    publishedPayload: parseJson(row.published_payload_json, undefined),
    createdAt: row.created_at,
  };
}

function mapMediaAsset(row: MediaAssetRecord): MediaAsset {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    altText: row.alt_text,
    credit: row.credit ?? undefined,
    mimeType: row.mime_type ?? undefined,
    byteSize: row.byte_size ?? undefined,
    filename: row.filename ?? undefined,
    author: row.author ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEditorialEntries(
  database: D1Database,
  options: { type?: EditorialEntryType; statuses?: EditorialEntryStatus[] } = {},
): Promise<EditorialEntry[]> {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (options.type) {
    clauses.push('type = ?');
    bindings.push(options.type);
  }

  if (options.statuses && options.statuses.length > 0) {
    clauses.push(`status IN (${options.statuses.map(() => '?').join(', ')})`);
    bindings.push(...options.statuses);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await queryAll<EditorialEntryRecord>(
    database,
    `
      SELECT
        id,
        type,
        slug,
        route,
        title,
        status,
        publish_mode,
        author,
        metadata_json,
        content_json,
        current_version_id,
        published_version_id,
        current_version_number,
        created_at,
        updated_at,
        published_at
      FROM editor_entries
      ${whereClause}
      ORDER BY updated_at DESC, title ASC
    `,
    bindings,
  );

  return rows.map(mapEditorialEntry);
}

export async function listEditorialTypeSummaries(
  database: D1Database,
): Promise<EditorialTypeSummary[]> {
  const rows = await queryAll<{
    type: EditorialEntryType;
    total_count: number;
    draft_count: number;
    published_count: number;
    export_ready_count: number;
  }>(
    database,
    `
      SELECT
        type,
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_count,
        SUM(CASE WHEN status = 'export_ready' THEN 1 ELSE 0 END) AS export_ready_count
      FROM editor_entries
      GROUP BY type
      ORDER BY type ASC
    `,
  );

  return rows.map((row) => ({
    type: row.type,
    totalCount: Number(row.total_count),
    draftCount: Number(row.draft_count),
    publishedCount: Number(row.published_count),
    exportReadyCount: Number(row.export_ready_count),
  }));
}

export async function getEditorialEntryById(
  database: D1Database,
  id: string,
): Promise<EditorialEntry | undefined> {
  const row = await queryFirst<EditorialEntryRecord>(
    database,
    `
      SELECT
        id,
        type,
        slug,
        route,
        title,
        status,
        publish_mode,
        author,
        metadata_json,
        content_json,
        current_version_id,
        published_version_id,
        current_version_number,
        created_at,
        updated_at,
        published_at
      FROM editor_entries
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return row ? mapEditorialEntry(row) : undefined;
}

export async function getEditorialEntryByTypeAndSlug(
  database: D1Database,
  type: EditorialEntryType,
  slug: string,
): Promise<EditorialEntry | undefined> {
  const row = await queryFirst<EditorialEntryRecord>(
    database,
    `
      SELECT
        id,
        type,
        slug,
        route,
        title,
        status,
        publish_mode,
        author,
        metadata_json,
        content_json,
        current_version_id,
        published_version_id,
        current_version_number,
        created_at,
        updated_at,
        published_at
      FROM editor_entries
      WHERE type = ? AND slug = ?
      LIMIT 1
    `,
    [type, slug],
  );

  return row ? mapEditorialEntry(row) : undefined;
}

export async function listEditorialVersions(
  database: D1Database,
  entryId: string,
): Promise<EditorialVersion[]> {
  const rows = await queryAll<EditorialVersionRecord>(
    database,
    `
      SELECT
        id,
        entry_id,
        version_number,
        status,
        action,
        author,
        summary,
        metadata_json,
        content_json,
        published_payload_json,
        created_at
      FROM editor_versions
      WHERE entry_id = ?
      ORDER BY version_number DESC, created_at DESC
    `,
    [entryId],
  );

  return rows.map(mapEditorialVersion);
}

export async function getEditorialVersionById(
  database: D1Database,
  versionId: string,
): Promise<EditorialVersion | undefined> {
  const row = await queryFirst<EditorialVersionRecord>(
    database,
    `
      SELECT
        id,
        entry_id,
        version_number,
        status,
        action,
        author,
        summary,
        metadata_json,
        content_json,
        published_payload_json,
        created_at
      FROM editor_versions
      WHERE id = ?
      LIMIT 1
    `,
    [versionId],
  );

  return row ? mapEditorialVersion(row) : undefined;
}

export async function getPublishedEditorialVersionByTypeAndSlug(
  database: D1Database,
  type: EditorialEntryType,
  slug: string,
): Promise<EditorialVersion | undefined> {
  const row = await queryFirst<EditorialPublishedVersionRow>(
    database,
    `
      SELECT
        versions.id,
        versions.entry_id,
        versions.version_number,
        versions.status,
        versions.action,
        versions.author,
        versions.summary,
        versions.metadata_json,
        versions.content_json,
        versions.published_payload_json,
        versions.created_at,
        entries.slug AS entry_slug,
        entries.route AS entry_route,
        entries.title AS entry_title,
        entries.type AS entry_type
      FROM editor_entries AS entries
      INNER JOIN editor_versions AS versions
        ON versions.id = entries.published_version_id
      WHERE entries.type = ? AND entries.slug = ?
      LIMIT 1
    `,
    [type, slug],
  );

  return row ? mapEditorialVersion(row) : undefined;
}

export async function getEditorialEntryStateByTypeAndSlug(
  database: D1Database,
  type: EditorialEntryType,
  slug: string,
): Promise<EditorialEntryState> {
  const entry = await getEditorialEntryByTypeAndSlug(database, type, slug);
  const publishedVersion = entry?.publishedVersionId
    ? await getEditorialVersionById(database, entry.publishedVersionId)
    : undefined;

  return {
    entry,
    publishedVersion,
    hasLiveVersion: Boolean(entry?.publishedVersionId && publishedVersion),
    hasPendingChanges: Boolean(
      entry?.publishedVersionId &&
        entry.currentVersionId &&
        entry.currentVersionId !== entry.publishedVersionId,
    ),
  };
}

export async function saveEditorialEntry(
  database: D1Database,
  input: EditorialEntryWriteInput,
): Promise<EditorialSaveResult> {
  const existingEntry = input.entryId ? await getEditorialEntryById(database, input.entryId) : undefined;
  const duplicateEntry =
    !existingEntry || existingEntry.slug !== input.slug || existingEntry.type !== input.type
      ? await getEditorialEntryByTypeAndSlug(database, input.type, input.slug)
      : undefined;

  if (duplicateEntry && duplicateEntry.id !== existingEntry?.id) {
    throw new Error(`Für ${input.type} ist der Slug "${input.slug}" bereits belegt.`);
  }

  const entryId = existingEntry?.id ?? input.entryId ?? crypto.randomUUID();
  const versionNumber = (existingEntry?.currentVersionNumber ?? 0) + 1;
  const versionId = crypto.randomUUID();
  const metadataJson = JSON.stringify(input.metadata);
  const contentJson = JSON.stringify(input.content);
  const publishedPayloadJson = input.publishedPayload ? JSON.stringify(input.publishedPayload) : null;
  const hasExistingLiveVersion = Boolean(existingEntry?.publishedVersionId);
  const publishedVersionId =
    input.liveBehavior === 'publish'
      ? versionId
      : input.liveBehavior === 'reset'
        ? null
        : existingEntry?.publishedVersionId ?? null;
  const nextStatus =
    input.liveBehavior === 'publish'
      ? 'published'
      : hasExistingLiveVersion && input.liveBehavior !== 'reset'
        ? 'published'
        : 'draft';
  const publishedAt =
    input.liveBehavior === 'publish'
      ? new Date().toISOString()
      : input.liveBehavior === 'reset'
        ? null
        : existingEntry?.publishedAt ?? null;
  const databasePublishMode = toDatabasePublishMode(input.publishMode);

  if (!existingEntry) {
    await execute(
      database,
      `
        INSERT INTO editor_entries (
          id,
          type,
          slug,
          route,
          title,
          status,
          publish_mode,
          author,
          metadata_json,
          content_json,
          current_version_id,
          published_version_id,
          current_version_number,
          created_at,
          updated_at,
          published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      `,
      [
        entryId,
        input.type,
        input.slug,
        input.route,
        input.title,
        nextStatus,
        databasePublishMode,
        input.author ?? null,
        metadataJson,
        contentJson,
        versionId,
        publishedVersionId,
        versionNumber,
        publishedAt,
      ],
    );
  } else {
    await execute(
      database,
      `
        UPDATE editor_entries
        SET
          slug = ?,
          route = ?,
          title = ?,
          status = ?,
          publish_mode = ?,
          author = ?,
          metadata_json = ?,
          content_json = ?,
          current_version_id = ?,
          published_version_id = ?,
          current_version_number = ?,
          updated_at = CURRENT_TIMESTAMP,
          published_at = ?
        WHERE id = ?
      `,
      [
        input.slug,
        input.route,
        input.title,
        nextStatus,
        databasePublishMode,
        input.author ?? null,
        metadataJson,
        contentJson,
        versionId,
        publishedVersionId,
        versionNumber,
        publishedAt,
        entryId,
      ],
    );
  }

  await execute(
    database,
    `
      INSERT INTO editor_versions (
        id,
        entry_id,
        version_number,
        status,
        action,
        author,
        summary,
        metadata_json,
        content_json,
        published_payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [
      versionId,
      entryId,
      versionNumber,
      nextStatus,
      input.action,
      input.author ?? null,
      input.summary ?? null,
      metadataJson,
      contentJson,
      publishedPayloadJson,
    ],
  );

  return {
    entryId,
    versionId,
    versionNumber,
  };
}

export async function writePublishLog(
  database: D1Database,
  input: PublishLogWriteInput,
): Promise<void> {
  await execute(
    database,
    `
      INSERT INTO publish_log (
        id,
        entry_id,
        version_id,
        target_type,
        target_identifier,
        mode,
        status,
        detail,
        payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [
      crypto.randomUUID(),
      input.entryId,
      input.versionId ?? null,
      input.targetType,
      input.targetIdentifier ?? null,
      toDatabasePublishMode(input.mode),
      input.status,
      input.detail ?? null,
      input.payload ? JSON.stringify(input.payload) : null,
    ],
  );
}

export async function listMediaAssets(database: D1Database): Promise<MediaAsset[]> {
  const rows = await queryAll<MediaAssetRecord>(
    database,
    `
      SELECT
        id,
        key,
        title,
        alt_text,
        credit,
        mime_type,
        byte_size,
        filename,
        author,
        created_at,
        updated_at
      FROM media_assets
      ORDER BY created_at DESC, title ASC
    `,
  );

  return rows.map(mapMediaAsset);
}

export async function getMediaAssetByKey(
  database: D1Database,
  key: string,
): Promise<MediaAsset | undefined> {
  const row = await queryFirst<MediaAssetRecord>(
    database,
    `
      SELECT
        id,
        key,
        title,
        alt_text,
        credit,
        mime_type,
        byte_size,
        filename,
        author,
        created_at,
        updated_at
      FROM media_assets
      WHERE key = ?
      LIMIT 1
    `,
    [key],
  );

  return row ? mapMediaAsset(row) : undefined;
}

export async function saveMediaAsset(
  database: D1Database,
  input: MediaAssetWriteInput,
): Promise<string> {
  const existing = await getMediaAssetByKey(database, input.key);
  const mediaId = existing?.id ?? input.id ?? crypto.randomUUID();

  if (!existing) {
    await execute(
      database,
      `
        INSERT INTO media_assets (
          id,
          key,
          title,
          alt_text,
          credit,
          mime_type,
          byte_size,
          filename,
          author,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        mediaId,
        input.key,
        input.title,
        input.altText,
        input.credit ?? null,
        input.mimeType ?? null,
        input.byteSize ?? null,
        input.filename ?? null,
        input.author ?? null,
      ],
    );
  } else {
    await execute(
      database,
      `
        UPDATE media_assets
        SET
          title = ?,
          alt_text = ?,
          credit = ?,
          mime_type = ?,
          byte_size = ?,
          filename = ?,
          author = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.title,
        input.altText,
        input.credit ?? null,
        input.mimeType ?? null,
        input.byteSize ?? null,
        input.filename ?? null,
        input.author ?? null,
        mediaId,
      ],
    );
  }

  return mediaId;
}

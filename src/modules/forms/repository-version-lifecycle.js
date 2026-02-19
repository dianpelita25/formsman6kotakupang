import { getDefaultDraft } from './core.js';
import { parseJson } from './repository-json.js';

export async function ensurePublishedVersion(sql, schoolId, createdBy) {
  const existingPublished = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;

  if (existingPublished.length) {
    return existingPublished[0];
  }

  const { meta, coreFields, extraFields } = getDefaultDraft();
  const [inserted] = await sql`
    WITH next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM form_versions
      WHERE school_id = ${schoolId}
    )
    INSERT INTO form_versions (
      id,
      school_id,
      version,
      status,
      meta,
      core_schema,
      extra_schema,
      published_at,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${schoolId},
      next_version.version,
      'published',
      ${JSON.stringify(meta)},
      ${JSON.stringify(coreFields)},
      ${JSON.stringify(extraFields)},
      NOW(),
      ${createdBy}
    FROM next_version
    ON CONFLICT (school_id, version) DO NOTHING
    RETURNING id, version, meta, core_schema, extra_schema;
  `;

  if (inserted) {
    return inserted;
  }

  const fallbackPublished = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return fallbackPublished[0] || null;
}

export async function ensureDraftVersion(sql, schoolId, createdBy) {
  const existingDraft = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;

  if (existingDraft.length) {
    return existingDraft[0];
  }

  const published = await ensurePublishedVersion(sql, schoolId, createdBy);
  if (!published) {
    throw new Error('Form published belum tersedia saat membuat draft.');
  }

  const [inserted] = await sql`
    WITH source AS (
      SELECT
        ${JSON.stringify(parseJson(published.meta, {}))}::jsonb AS meta,
        ${JSON.stringify(parseJson(published.core_schema, []))}::jsonb AS core_schema,
        ${JSON.stringify(parseJson(published.extra_schema, []))}::jsonb AS extra_schema
    ),
    next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM form_versions
      WHERE school_id = ${schoolId}
    )
    INSERT INTO form_versions (
      id,
      school_id,
      version,
      status,
      meta,
      core_schema,
      extra_schema,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${schoolId},
      next_version.version,
      'draft',
      source.meta,
      source.core_schema,
      source.extra_schema,
      ${createdBy}
    FROM source, next_version
    ON CONFLICT (school_id) WHERE status = 'draft'
    DO UPDATE SET updated_at = form_versions.updated_at
    RETURNING id, version, meta, core_schema, extra_schema;
  `;

  if (inserted) {
    return inserted;
  }

  const fallbackDraft = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return fallbackDraft[0] || null;
}

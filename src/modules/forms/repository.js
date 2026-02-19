import { getSqlClient } from '../../lib/db/sql.js';
import { parseJson } from './repository-json.js';
import { ensureDraftVersion, ensurePublishedVersion } from './repository-version-lifecycle.js';

function normalizeVersionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    schoolId: row.school_id,
    version: Number(row.version),
    status: row.status,
    publishedAt: row.published_at || null,
    meta: parseJson(row.meta, {}),
    coreFields: parseJson(row.core_schema, []),
    extraFields: parseJson(row.extra_schema, []),
  };
}

export async function getPublishedFormBySchoolId(env, schoolId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id, school_id, version, status, published_at, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function getDraftFormBySchoolId(env, schoolId, createdBy = null) {
  const sql = getSqlClient(env);
  const draft = await ensureDraftVersion(sql, schoolId, createdBy);
  return normalizeVersionRow(draft);
}

export async function saveDraftForm(env, { schoolId, draftId, meta, coreFields, extraFields, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE form_versions
    SET
      meta = ${JSON.stringify(meta)},
      core_schema = ${JSON.stringify(coreFields)},
      extra_schema = ${JSON.stringify(extraFields)},
      created_by = COALESCE(${actorId}, created_by),
      updated_at = NOW()
    WHERE id = ${draftId}
      AND school_id = ${schoolId}
      AND status = 'draft'
    RETURNING
      id, school_id, version, status, published_at, meta, core_schema, extra_schema;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function publishDraftForm(env, { schoolId, actorId }) {
  const sql = getSqlClient(env);
  const publishedRows = await sql`
    WITH selected_draft AS (
      SELECT id
      FROM form_versions
      WHERE school_id = ${schoolId}
        AND status = 'draft'
      ORDER BY version DESC
      LIMIT 1
      FOR UPDATE
    ),
    archived AS (
      UPDATE form_versions
      SET
        status = 'archived',
        updated_at = NOW()
      WHERE school_id = ${schoolId}
        AND status = 'published'
        AND id <> (SELECT id FROM selected_draft)
    ),
    published AS (
      UPDATE form_versions
      SET
        status = 'published',
        published_at = NOW(),
        created_by = COALESCE(${actorId}, created_by),
        updated_at = NOW()
      WHERE id = (SELECT id FROM selected_draft)
      RETURNING
        id, school_id, version, status, published_at, meta, core_schema, extra_schema
    )
    SELECT * FROM published;
  `;

  const published = normalizeVersionRow(publishedRows[0]);
  if (!published) return null;

  await ensureDraftVersion(sql, schoolId, actorId);
  return published;
}

export async function getLatestFormVersionIdBySchoolId(env, schoolId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return rows[0]?.id || null;
}

export async function ensureSchoolFormsInitialized(env, schoolId, createdBy = null) {
  const sql = getSqlClient(env);
  await ensurePublishedVersion(sql, schoolId, createdBy);
  await ensureDraftVersion(sql, schoolId, createdBy);
}

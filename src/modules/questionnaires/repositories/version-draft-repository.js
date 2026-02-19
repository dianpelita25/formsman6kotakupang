import { getSqlClient } from './sql-client.js';
import { normalizeDefaultDraft, normalizeVersionRow, parseJson } from './shared.js';
import { getPublishedVersionByQuestionnaireId } from './version-read-repository.js';

export async function createPublishedVersion(env, { questionnaireId, meta, schema, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    WITH next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM questionnaire_versions
      WHERE questionnaire_id = ${questionnaireId}
    )
    INSERT INTO questionnaire_versions (
      id,
      questionnaire_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${questionnaireId},
      next_version.version,
      'published',
      ${JSON.stringify(meta)},
      ${JSON.stringify(schema)},
      NOW(),
      ${actorId}
    FROM next_version
    ON CONFLICT (questionnaire_id) WHERE status = 'published'
    DO NOTHING
    RETURNING
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function getDraftVersionByQuestionnaireId(env, questionnaireId, actorId = null, fallbackDraft = null) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;

  if (rows[0]) {
    return normalizeVersionRow(rows[0]);
  }

  const published = await getPublishedVersionByQuestionnaireId(env, questionnaireId);
  const resolvedFallback = normalizeDefaultDraft(fallbackDraft);
  const sourceMeta = published?.meta || resolvedFallback.meta;
  const sourceFields = published?.fields || resolvedFallback.coreFields;
  const sourceSchema = {
    fields: sourceFields,
    coreFields: parseJson(published?.schema?.coreFields, []),
    extraFields: parseJson(published?.schema?.extraFields, []),
  };

  const inserted = await sql`
    WITH next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM questionnaire_versions
      WHERE questionnaire_id = ${questionnaireId}
    )
    INSERT INTO questionnaire_versions (
      id,
      questionnaire_id,
      version,
      status,
      meta,
      schema,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${questionnaireId},
      next_version.version,
      'draft',
      ${JSON.stringify(sourceMeta)},
      ${JSON.stringify(sourceSchema)},
      ${actorId}
    FROM next_version
    ON CONFLICT (questionnaire_id) WHERE status = 'draft'
    DO UPDATE SET updated_at = questionnaire_versions.updated_at
    RETURNING
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at;
  `;

  if (inserted[0]) return normalizeVersionRow(inserted[0]);

  const fallback = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return normalizeVersionRow(fallback[0]);
}

export async function saveDraftVersion(env, { questionnaireId, draftId, meta, schema, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE questionnaire_versions
    SET
      meta = ${JSON.stringify(meta)},
      schema = ${JSON.stringify(schema)},
      created_by = COALESCE(${actorId}, created_by),
      updated_at = NOW()
    WHERE id = ${draftId}
      AND questionnaire_id = ${questionnaireId}
      AND status = 'draft'
    RETURNING
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at;
  `;
  return normalizeVersionRow(rows[0]);
}

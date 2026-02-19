import { getSqlClient } from './sql-client.js';
import { normalizeVersionRow } from './shared.js';

export async function getPublishedVersionByQuestionnaireId(env, questionnaireId) {
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
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function getQuestionnaireVersionById(env, questionnaireId, questionnaireVersionId) {
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
      AND id = ${questionnaireVersionId}
    LIMIT 1;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function listQuestionnaireVersionsByQuestionnaireId(env, questionnaireId) {
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
    ORDER BY version DESC;
  `;
  return rows.map((row) => normalizeVersionRow(row)).filter(Boolean);
}

import { getSqlClient } from './sql-client.js';
import { normalizeVersionRow } from './shared.js';

export async function publishDraftVersion(env, { questionnaireId, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    WITH scope_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(${String(questionnaireId)}::text)::bigint) AS locked
    ),
    selected_draft AS (
      SELECT qv.id
      FROM questionnaire_versions qv
      CROSS JOIN scope_lock
      WHERE qv.questionnaire_id = ${questionnaireId}
        AND qv.status = 'draft'
      ORDER BY qv.version DESC
      LIMIT 1
      FOR UPDATE
    ),
    archived AS (
      UPDATE questionnaire_versions
      SET status = 'archived', updated_at = NOW()
      WHERE questionnaire_id = ${questionnaireId}
        AND status = 'published'
        AND id <> (SELECT id FROM selected_draft)
      RETURNING id
    ),
    published AS (
      UPDATE questionnaire_versions
      SET
        status = 'published',
        published_at = NOW(),
        created_by = COALESCE(${actorId}, created_by),
        updated_at = NOW()
      WHERE id = (SELECT id FROM selected_draft)
        AND (SELECT COUNT(*) FROM archived) >= 0
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
        updated_at
    )
    SELECT * FROM published;
  `;
  return normalizeVersionRow(rows[0]);
}

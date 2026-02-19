import { mapPromptRow } from './row-mapper.js';
import { buildPromptScopeFilter } from './scope-predicate.js';
import { getSqlClient } from './sql-client.js';
import { normalizeScopeAndTarget } from './target-repository.js';

export async function publishPromptDraft(env, { mode, scope, schoolId, tenantId, questionnaireId, actorId, changeNote }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });
  const scopeFilter = buildPromptScopeFilter(target);

  const rows = await sql`
    WITH selected_draft AS (
      SELECT id, mode, scope, tenant_id, questionnaire_id, template, change_note
      FROM ai_prompt_versions_v2
      WHERE mode = ${mode}
        AND scope = ${target.scope}
        AND ${scopeFilter.canMatch}
        AND tenant_id IS NOT DISTINCT FROM ${scopeFilter.tenantId}
        AND questionnaire_id IS NOT DISTINCT FROM ${scopeFilter.questionnaireId}
        AND status = 'draft'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    ),
    archived AS (
      UPDATE ai_prompt_versions_v2
      SET status = 'archived'
      WHERE mode = ${mode}
        AND scope = ${target.scope}
        AND ${scopeFilter.canMatch}
        AND tenant_id IS NOT DISTINCT FROM ${scopeFilter.tenantId}
        AND questionnaire_id IS NOT DISTINCT FROM ${scopeFilter.questionnaireId}
        AND status = 'published'
      RETURNING id
    ),
    published AS (
      UPDATE ai_prompt_versions_v2
      SET
        status = 'published',
        published_at = NOW(),
        change_note = COALESCE(${changeNote || ''}, change_note),
        created_by = ${actorId}
      WHERE id = (SELECT id FROM selected_draft)
        AND (SELECT COUNT(*) FROM archived) >= 0
      RETURNING
        id,
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        status,
        template,
        change_note,
        created_by,
        TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at
    ),
    next_draft AS (
      INSERT INTO ai_prompt_versions_v2 (
        id,
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        status,
        template,
        change_note,
        created_by
      )
      SELECT
        ${crypto.randomUUID()},
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        'draft',
        template,
        '',
        ${actorId}
      FROM published
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    SELECT * FROM published;
  `;

  return mapPromptRow(rows[0]);
}

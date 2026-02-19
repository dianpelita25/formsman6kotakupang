import { mapPromptRow } from './row-mapper.js';
import { buildPromptScopeFilter } from './scope-predicate.js';
import { getSqlClient } from './sql-client.js';
import { normalizeScopeAndTarget } from './target-repository.js';

async function createPromptDraft(env, { mode, scope, schoolId, tenantId, questionnaireId, template, changeNote, actorId }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });

  const rows = await sql`
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
    VALUES (
      ${crypto.randomUUID()},
      ${mode},
      ${target.scope},
      ${target.tenantId},
      ${target.questionnaireId},
      'draft',
      ${template},
      ${changeNote || ''},
      ${actorId}
    )
    ON CONFLICT DO NOTHING
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
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at;
  `;

  return mapPromptRow(rows[0]);
}

export async function savePromptDraft(
  env,
  { mode, scope, schoolId, tenantId, questionnaireId, template, changeNote, actorId }
) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });
  const scopeFilter = buildPromptScopeFilter(target);

  const rows = await sql`
    UPDATE ai_prompt_versions_v2
    SET
      template = ${template},
      change_note = ${changeNote || ''},
      created_by = ${actorId}
    WHERE mode = ${mode}
      AND scope = ${target.scope}
      AND ${scopeFilter.canMatch}
      AND tenant_id IS NOT DISTINCT FROM ${scopeFilter.tenantId}
      AND questionnaire_id IS NOT DISTINCT FROM ${scopeFilter.questionnaireId}
      AND status = 'draft'
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
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at;
  `;

  if (rows[0]) {
    return mapPromptRow(rows[0]);
  }

  const inserted = await createPromptDraft(env, {
    mode,
    scope,
    schoolId,
    tenantId,
    questionnaireId,
    template,
    changeNote,
    actorId,
  });
  if (inserted) return inserted;

  const fallbackRows = await sql`
    SELECT
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
    FROM ai_prompt_versions_v2
    WHERE mode = ${mode}
      AND scope = ${target.scope}
      AND ${scopeFilter.canMatch}
      AND tenant_id IS NOT DISTINCT FROM ${scopeFilter.tenantId}
      AND questionnaire_id IS NOT DISTINCT FROM ${scopeFilter.questionnaireId}
      AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return mapPromptRow(fallbackRows[0]);
}

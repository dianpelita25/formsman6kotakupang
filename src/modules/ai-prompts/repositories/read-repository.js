import { mapPromptRow } from './row-mapper.js';
import { buildPromptScopeFilter } from './scope-predicate.js';
import { getSqlClient } from './sql-client.js';
import { maxLimit, normalizeScopeAndTarget } from './target-repository.js';

export async function getPromptByStatus(env, { mode, scope, schoolId, tenantId, questionnaireId, status }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });
  const scopeFilter = buildPromptScopeFilter(target);

  const rows = await sql`
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
      AND status = ${status}
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return mapPromptRow(rows[0]);
}

export async function listPromptHistory(env, { mode, scope, schoolId, tenantId, questionnaireId, limit = 20 }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });
  const scopeFilter = buildPromptScopeFilter(target);

  const rows = await sql`
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
    ORDER BY created_at DESC
    LIMIT ${maxLimit(limit)};
  `;

  return rows.map(mapPromptRow);
}

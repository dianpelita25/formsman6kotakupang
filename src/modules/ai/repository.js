import { getSqlClient } from '../../lib/db/sql.js';

export async function insertAiAnalysis(env, { schoolId, formVersionId, mode, analysis, meta }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO ai_analysis (school_id, form_version_id, mode, analysis, meta)
    VALUES (${schoolId}, ${formVersionId}, ${mode}, ${analysis}, ${JSON.stringify(meta || {})})
    RETURNING id, school_id, form_version_id, mode, TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at;
  `;
  return rows[0] || null;
}

export async function getLatestAiAnalysis(env, { schoolId, mode }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id,
      school_id,
      form_version_id,
      mode,
      analysis,
      meta,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM ai_analysis
    WHERE school_id = ${schoolId}
      AND mode = ${mode}
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function insertAiAnalysisV2(env, { tenantId, questionnaireId, questionnaireVersionId, mode, analysis, meta, legacyAiAnalysisId = null }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO ai_analysis_v2 (
      legacy_ai_analysis_id,
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      mode,
      analysis,
      meta
    )
    VALUES (
      ${legacyAiAnalysisId},
      ${tenantId},
      ${questionnaireId},
      ${questionnaireVersionId},
      ${mode},
      ${analysis},
      ${JSON.stringify(meta || {})}
    )
    ON CONFLICT (legacy_ai_analysis_id) DO NOTHING
    RETURNING id, tenant_id, questionnaire_id, questionnaire_version_id, mode, TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at;
  `;
  return rows[0] || null;
}

export async function getLatestAiAnalysisV2(
  env,
  { tenantId, questionnaireId, questionnaireVersionId = null, mode, from = null, to = null }
) {
  const sql = getSqlClient(env);
  const fromFilter = String(from || '').trim() || null;
  const toFilter = String(to || '').trim() || null;
  const rows = await sql`
    SELECT
      id,
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      mode,
      analysis,
      meta,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM ai_analysis_v2
    WHERE tenant_id = ${tenantId}
      AND questionnaire_id = ${questionnaireId}
      AND (${questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${questionnaireVersionId})
      AND (
        (${fromFilter}::text IS NULL AND NULLIF(COALESCE(meta->'filters'->>'from', ''), '') IS NULL)
        OR (${fromFilter}::text IS NOT NULL AND COALESCE(meta->'filters'->>'from', '') = ${fromFilter})
      )
      AND (
        (${toFilter}::text IS NULL AND NULLIF(COALESCE(meta->'filters'->>'to', ''), '') IS NULL)
        OR (${toFilter}::text IS NOT NULL AND COALESCE(meta->'filters'->>'to', '') = ${toFilter})
      )
      AND mode = ${mode}
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return rows[0] || null;
}

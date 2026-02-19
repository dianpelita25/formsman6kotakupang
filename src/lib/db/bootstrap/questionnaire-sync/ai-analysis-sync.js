export async function syncAiAnalysisV2FromLegacy(sql) {
  await sql`
    INSERT INTO ai_analysis_v2 (
      legacy_ai_analysis_id,
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      mode,
      analysis,
      meta,
      created_at
    )
    SELECT
      ai.id,
      ai.school_id,
      COALESCE(qv.questionnaire_id, q_default.id) AS questionnaire_id,
      COALESCE(qv.id, qv_default.id) AS questionnaire_version_id,
      ai.mode,
      ai.analysis,
      ai.meta,
      ai.created_at
    FROM ai_analysis ai
    LEFT JOIN questionnaire_versions qv
      ON qv.legacy_form_version_id = ai.form_version_id
    LEFT JOIN questionnaires q_default
      ON q_default.tenant_id = ai.school_id
      AND q_default.is_default = TRUE
    LEFT JOIN questionnaire_versions qv_default
      ON qv_default.questionnaire_id = q_default.id
      AND qv_default.status = 'published'
    WHERE ai.school_id IS NOT NULL
      AND COALESCE(qv.questionnaire_id, q_default.id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM ai_analysis_v2 v2
        WHERE v2.legacy_ai_analysis_id = ai.id
      );
  `;
}

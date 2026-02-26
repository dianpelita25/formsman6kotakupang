import { getSqlClient } from './sql-client.js';

export async function getQuestionnaireSummaryStatsV2(env, filters) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total_responses,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS responses_today,
      TO_CHAR(MAX(created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_submitted_at
    FROM responses_v2
    WHERE tenant_id = ${filters.tenantId}
      AND questionnaire_id = ${filters.questionnaireId}
      AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
      AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
      AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to});
  `;
  return rows[0] || null;
}

export async function getQuestionnaireTrendRowsV2(env, filters) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS total
    FROM responses_v2
    WHERE tenant_id = ${filters.tenantId}
      AND questionnaire_id = ${filters.questionnaireId}
      AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
      AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
      AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
    GROUP BY 1
    ORDER BY 1 ASC;
  `;
}

export async function listQuestionnaireSchoolBenchmarkRows(env, filters) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      t.id AS tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      q.id AS questionnaire_id,
      q.slug AS questionnaire_slug,
      COUNT(rv2.id)::int AS total_responses,
      COUNT(*) FILTER (WHERE rv2.created_at >= date_trunc('day', NOW()))::int AS responses_today,
      TO_CHAR(MAX(rv2.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_submitted_at
    FROM questionnaires q
    JOIN tenants t ON t.id = q.tenant_id
    LEFT JOIN responses_v2 rv2
      ON rv2.tenant_id = t.id
      AND rv2.questionnaire_id = q.id
      AND (${filters.from}::timestamptz IS NULL OR rv2.created_at >= ${filters.from})
      AND (${filters.to}::timestamptz IS NULL OR rv2.created_at < ${filters.to})
    WHERE q.slug = ${filters.questionnaireSlug}
      AND q.is_active = TRUE
      AND t.is_active = TRUE
    GROUP BY t.id, t.slug, t.name, q.id, q.slug
    ORDER BY t.name ASC;
  `;
}


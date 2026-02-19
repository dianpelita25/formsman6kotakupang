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


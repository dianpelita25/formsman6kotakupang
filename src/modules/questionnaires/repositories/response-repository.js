import { getSqlClient } from './sql-client.js';
import { normalizeResponseV2Row } from './shared.js';

export async function insertResponseV2(env, { tenantId, questionnaireId, questionnaireVersionId, respondent, answers, payload }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO responses_v2 (
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      respondent,
      answers,
      payload
    )
    VALUES (
      ${tenantId},
      ${questionnaireId},
      ${questionnaireVersionId},
      ${JSON.stringify(respondent || {})},
      ${JSON.stringify(answers || {})},
      ${JSON.stringify(payload || {})}
    )
    RETURNING id, created_at;
  `;
  return rows[0] || null;
}

export async function listQuestionnaireResponsesV2(env, filters) {
  const sql = getSqlClient(env);
  const searchPattern = filters.search ? `%${filters.search}%` : null;
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * pageSize;

  const [countRows, itemRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS total
      FROM responses_v2
      WHERE tenant_id = ${filters.tenantId}
        AND questionnaire_id = ${filters.questionnaireId}
        AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
        AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
        AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        AND (
          ${searchPattern}::text IS NULL
          OR respondent::text ILIKE ${searchPattern}
          OR answers::text ILIKE ${searchPattern}
          OR payload::text ILIKE ${searchPattern}
        );
    `,
    sql`
      SELECT
        id,
        tenant_id,
        questionnaire_id,
        questionnaire_version_id,
        respondent,
        answers,
        payload,
        TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM responses_v2
      WHERE tenant_id = ${filters.tenantId}
        AND questionnaire_id = ${filters.questionnaireId}
        AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
        AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
        AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        AND (
          ${searchPattern}::text IS NULL
          OR respondent::text ILIKE ${searchPattern}
          OR answers::text ILIKE ${searchPattern}
          OR payload::text ILIKE ${searchPattern}
        )
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset};
    `,
  ]);

  return {
    page,
    pageSize,
    total: Number(countRows?.[0]?.total || 0),
    items: itemRows.map(normalizeResponseV2Row).filter(Boolean),
  };
}

export async function listQuestionnaireResponsesForAggregation(env, filters, limit = 5000) {
  const sql = getSqlClient(env);
  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const resolvedLimit = hasLimit ? Math.max(1, Number(limit)) : null;
  const rows = hasLimit
    ? await sql`
        SELECT
          id,
          tenant_id,
          questionnaire_id,
          questionnaire_version_id,
          respondent,
          answers,
          payload,
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM responses_v2
        WHERE tenant_id = ${filters.tenantId}
          AND questionnaire_id = ${filters.questionnaireId}
          AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
          AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
          AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        ORDER BY created_at DESC
        LIMIT ${resolvedLimit};
      `
    : await sql`
        SELECT
          id,
          tenant_id,
          questionnaire_id,
          questionnaire_version_id,
          respondent,
          answers,
          payload,
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM responses_v2
        WHERE tenant_id = ${filters.tenantId}
          AND questionnaire_id = ${filters.questionnaireId}
          AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
          AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
          AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        ORDER BY created_at DESC;
      `;
  return rows.map(normalizeResponseV2Row).filter(Boolean);
}


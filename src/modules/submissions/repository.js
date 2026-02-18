import { getSqlClient } from '../../lib/db/sql.js';

export async function insertResponse(env, input) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO responses (
      school_id,
      form_version_id,
      nama_guru,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12,
      extra_answers,
      payload
    )
    VALUES (
      ${input.schoolId},
      ${input.formVersionId},
      ${input.core.namaGuru},
      ${input.core.lamaMengajar},
      ${input.core.mataPelajaran},
      ${input.core.q1},
      ${input.core.q2},
      ${input.core.q3},
      ${input.core.q4},
      ${input.core.q5},
      ${input.core.q6},
      ${input.core.q7},
      ${input.core.q8},
      ${input.core.q9},
      ${input.core.q10},
      ${input.core.q11},
      ${input.core.q12},
      ${JSON.stringify(input.extraAnswers || {})},
      ${JSON.stringify(input.payload)}
    )
    RETURNING id, created_at;
  `;
  return rows[0] || null;
}

export async function listResponses(env, { schoolId, page, pageSize, search }) {
  const sql = getSqlClient(env);
  const offset = (page - 1) * pageSize;
  const searchLike = `%${search}%`;

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total
    FROM responses
    WHERE school_id = ${schoolId}
      AND (
        ${search} = ''
        OR nama_guru ILIKE ${searchLike}
        OR mata_pelajaran ILIKE ${searchLike}
        OR lama_mengajar ILIKE ${searchLike}
      );
  `;

  const rows = await sql`
    SELECT
      id,
      form_version_id,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      nama_guru,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12,
      extra_answers
    FROM responses
    WHERE school_id = ${schoolId}
      AND (
        ${search} = ''
        OR nama_guru ILIKE ${searchLike}
        OR mata_pelajaran ILIKE ${searchLike}
        OR lama_mengajar ILIKE ${searchLike}
      )
    ORDER BY created_at DESC
    LIMIT ${pageSize}
    OFFSET ${offset};
  `;

  return {
    total: Number(countRow?.total || 0),
    items: rows,
  };
}

export async function getAllResponsesForCsv(env, schoolId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      id,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      nama_guru,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12,
      extra_answers
    FROM responses
    WHERE school_id = ${schoolId}
    ORDER BY created_at DESC;
  `;
}

export async function getSummaryStats(env, schoolId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total_responses,
      ROUND(AVG(q12)::numeric, 2) AS avg_q12,
      ROUND(AVG((q7 + q8 + q9 + q11) / 4.0)::numeric, 2) AS avg_ai_adoption,
      ROUND(
        (
          COUNT(*) FILTER (WHERE q10 IN ('Sangat Berminat', 'Berminat'))
          * 100.0 / NULLIF(COUNT(*), 0)
        )::numeric,
        2
      ) AS interested_pct
    FROM responses
    WHERE school_id = ${schoolId};
  `;
  return rows[0] || null;
}

export async function getQuestionAverages(env, schoolId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      ROUND(AVG(q1)::numeric, 2) AS q1,
      ROUND(AVG(q2)::numeric, 2) AS q2,
      ROUND(AVG(q3)::numeric, 2) AS q3,
      ROUND(AVG(q4)::numeric, 2) AS q4,
      ROUND(AVG(q5)::numeric, 2) AS q5,
      ROUND(AVG(q6)::numeric, 2) AS q6,
      ROUND(AVG(q7)::numeric, 2) AS q7,
      ROUND(AVG(q8)::numeric, 2) AS q8,
      ROUND(AVG(q9)::numeric, 2) AS q9,
      ROUND(AVG(q11)::numeric, 2) AS q11,
      ROUND(AVG(q12)::numeric, 2) AS q12
    FROM responses
    WHERE school_id = ${schoolId};
  `;
  return rows[0] || null;
}

export async function getQ10Distribution(env, schoolId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT q10, COUNT(*)::int AS total
    FROM responses
    WHERE school_id = ${schoolId}
    GROUP BY q10;
  `;
}

export async function getTrend(env, schoolId, days) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS total
    FROM responses
    WHERE school_id = ${schoolId}
      AND created_at >= NOW() - (${days}::text || ' days')::interval
    GROUP BY 1
    ORDER BY 1;
  `;
}

export async function getResponsesForAi(env, schoolId, days) {
  const sql = getSqlClient(env);
  if (Number.isFinite(Number(days))) {
    return sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        lama_mengajar,
        mata_pelajaran,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12
      FROM responses
      WHERE school_id = ${schoolId}
        AND created_at >= NOW() - (${days}::text || ' days')::interval
      ORDER BY created_at DESC;
    `;
  }

  return sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12
    FROM responses
    WHERE school_id = ${schoolId}
    ORDER BY created_at DESC;
  `;
}

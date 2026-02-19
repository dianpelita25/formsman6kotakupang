import { getSqlClient } from '../../../lib/db/sql.js';

export async function ensureSubmissionTable() {
  const sql = getSqlClient();

  await sql`
    CREATE TABLE IF NOT EXISTS form_responses (
      id BIGSERIAL PRIMARY KEY,
      nama_guru TEXT NOT NULL,
      lama_mengajar TEXT NOT NULL,
      mata_pelajaran TEXT NOT NULL,
      q1 SMALLINT NOT NULL,
      q2 SMALLINT NOT NULL,
      q3 SMALLINT NOT NULL,
      q4 SMALLINT NOT NULL,
      q5 SMALLINT NOT NULL,
      q6 SMALLINT NOT NULL,
      q7 SMALLINT NOT NULL,
      q8 SMALLINT NOT NULL,
      q9 SMALLINT NOT NULL,
      q10 TEXT NOT NULL,
      q11 SMALLINT NOT NULL,
      q12 SMALLINT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

export async function insertSubmission(data) {
  const sql = getSqlClient();

  const [row] = await sql`
    INSERT INTO form_responses (
      nama_guru, lama_mengajar, mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12,
      payload
    )
    VALUES (
      ${data.namaGuru}, ${data.lamaMengajar}, ${data.mataPelajaran},
      ${data.q1}, ${data.q2}, ${data.q3}, ${data.q4}, ${data.q5}, ${data.q6}, ${data.q7}, ${data.q8}, ${data.q9}, ${data.q10}, ${data.q11}, ${data.q12},
      ${JSON.stringify(data)}
    )
    RETURNING id, created_at;
  `;

  return row;
}

export async function getSummaryStats() {
  const sql = getSqlClient();

  const [row] = await sql`
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
    FROM form_responses;
  `;

  return row;
}

export async function getQuestionAverages() {
  const sql = getSqlClient();

  const [row] = await sql`
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
    FROM form_responses;
  `;

  return row;
}

export async function getQ10Distribution() {
  const sql = getSqlClient();

  const rows = await sql`
    SELECT q10, COUNT(*)::int AS total
    FROM form_responses
    GROUP BY q10;
  `;

  return rows;
}

export async function getSubmissionTrend({ days = 30 } = {}) {
  const sql = getSqlClient();

  const rows = await sql`
    SELECT
      TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS total
    FROM form_responses
    WHERE created_at >= NOW() - (${days}::text || ' days')::interval
    GROUP BY 1
    ORDER BY 1;
  `;

  return rows;
}

export async function getAllResponsesForCsv() {
  const sql = getSqlClient();

  const rows = await sql`
    SELECT
      id,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      nama_guru,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12
    FROM form_responses
    ORDER BY created_at DESC;
  `;

  return rows;
}

export async function getResponsesForAi({ days } = {}) {
  const sql = getSqlClient();

  const hasDays = Number.isFinite(Number(days));

  const rows = hasDays
    ? await sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
          lama_mengajar,
          mata_pelajaran,
          q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12
        FROM form_responses
        WHERE created_at >= NOW() - (${days}::text || ' days')::interval
        ORDER BY created_at DESC;
      `
    : await sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
          lama_mengajar,
          mata_pelajaran,
          q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12
        FROM form_responses
        ORDER BY created_at DESC;
      `;

  return rows;
}

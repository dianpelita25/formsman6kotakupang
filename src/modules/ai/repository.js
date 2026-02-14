import { getSqlClient } from '../../lib/db/client.js';

export async function ensureAiAnalysisTable() {
  const sql = getSqlClient();

  await sql`
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id BIGSERIAL PRIMARY KEY,
      analysis TEXT NOT NULL,
      meta JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

export async function insertAiAnalysis({ analysis, meta }) {
  const sql = getSqlClient();

  const [row] = await sql`
    INSERT INTO ai_analysis (analysis, meta)
    VALUES (${analysis}, ${JSON.stringify(meta ?? {})})
    RETURNING id, created_at;
  `;

  return row;
}

export async function getLatestAiAnalysis() {
  const sql = getSqlClient();

  const [row] = await sql`
    SELECT
      id,
      analysis,
      meta,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM ai_analysis
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return row;
}

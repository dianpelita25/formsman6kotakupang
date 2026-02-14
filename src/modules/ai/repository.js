import { getSqlClient } from '../../lib/db/client.js';

export async function ensureAiAnalysisTable() {
  const sql = getSqlClient();

  await sql`
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id BIGSERIAL PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'internal',
      analysis TEXT NOT NULL,
      meta JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Backward compatible migration for old rows without mode column.
  await sql`
    ALTER TABLE ai_analysis
    ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'internal';
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_analysis_mode_created_at
    ON ai_analysis (mode, created_at DESC);
  `;
}

export async function insertAiAnalysis({ mode, analysis, meta }) {
  const sql = getSqlClient();

  const [row] = await sql`
    INSERT INTO ai_analysis (mode, analysis, meta)
    VALUES (${mode}, ${analysis}, ${JSON.stringify(meta ?? {})})
    RETURNING id, mode, created_at;
  `;

  return row;
}

export async function getLatestAiAnalysis({ mode }) {
  const sql = getSqlClient();

  const [row] = await sql`
    SELECT
      id,
      mode,
      analysis,
      meta,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM ai_analysis
    WHERE mode = ${mode}
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return row;
}

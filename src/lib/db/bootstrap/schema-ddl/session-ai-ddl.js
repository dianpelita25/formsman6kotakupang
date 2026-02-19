export async function createSessionAndAiTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id BIGSERIAL PRIMARY KEY,
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      form_version_id UUID REFERENCES form_versions(id) ON DELETE SET NULL,
      mode TEXT NOT NULL DEFAULT 'internal',
      analysis TEXT NOT NULL,
      meta JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_analysis_v2 (
      id BIGSERIAL PRIMARY KEY,
      legacy_ai_analysis_id BIGINT UNIQUE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
      questionnaire_version_id UUID REFERENCES questionnaire_versions(id) ON DELETE SET NULL,
      mode TEXT NOT NULL DEFAULT 'internal',
      analysis TEXT NOT NULL,
      meta JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    ALTER TABLE ai_analysis_v2
    ADD COLUMN IF NOT EXISTS legacy_ai_analysis_id BIGINT;
  `;

  await sql`
    ALTER TABLE ai_analysis
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
  `;

  await sql`
    ALTER TABLE ai_analysis
    ADD COLUMN IF NOT EXISTS form_version_id UUID REFERENCES form_versions(id) ON DELETE SET NULL;
  `;

  await sql`
    ALTER TABLE ai_analysis
    ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'internal';
  `;
}

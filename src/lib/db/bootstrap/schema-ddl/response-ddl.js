export async function createResponseTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS responses (
      id BIGSERIAL PRIMARY KEY,
      legacy_response_id BIGINT UNIQUE,
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      form_version_id UUID NOT NULL REFERENCES form_versions(id) ON DELETE RESTRICT,
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
      extra_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS responses_v2 (
      id BIGSERIAL PRIMARY KEY,
      legacy_response_id BIGINT UNIQUE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
      questionnaire_version_id UUID NOT NULL REFERENCES questionnaire_versions(id) ON DELETE RESTRICT,
      respondent JSONB NOT NULL DEFAULT '{}'::jsonb,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS form_open_devices (
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
      device_hash TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      open_count INT NOT NULL DEFAULT 1,
      PRIMARY KEY (tenant_id, questionnaire_id, device_hash)
    );
  `;
}

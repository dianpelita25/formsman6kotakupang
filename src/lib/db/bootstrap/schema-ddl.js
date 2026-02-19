export async function createIdentityTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS schools (
      id UUID PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tenant_type TEXT NOT NULL DEFAULT 'school' CHECK (tenant_type IN ('school', 'business', 'government', 'class', 'community', 'event', 'other')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS school_memberships (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('superadmin', 'school_admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        (role = 'superadmin' AND school_id IS NULL)
        OR
        (role = 'school_admin' AND school_id IS NOT NULL)
      ),
      UNIQUE (user_id, school_id, role)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tenant_memberships (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('superadmin', 'tenant_admin', 'analyst')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, tenant_id, role)
    );
  `;
}

export async function createFormQuestionnaireTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS form_versions (
      id UUID PRIMARY KEY,
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      meta JSONB NOT NULL,
      core_schema JSONB NOT NULL,
      extra_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
      published_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (school_id, version)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS questionnaires (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general_feedback',
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, slug)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS questionnaire_versions (
      id UUID PRIMARY KEY,
      questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
      legacy_form_version_id UUID UNIQUE,
      version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      meta JSONB NOT NULL,
      schema JSONB NOT NULL,
      published_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (questionnaire_id, version)
    );
  `;

  await sql`
    ALTER TABLE questionnaire_versions
    ADD COLUMN IF NOT EXISTS legacy_form_version_id UUID;
  `;
}

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
}

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

export async function createPromptTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_prompt_versions (
      id UUID PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('internal', 'external_pemerintah', 'external_mitra', 'live_guru')),
      scope TEXT NOT NULL CHECK (scope IN ('global', 'school')),
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      template TEXT NOT NULL,
      change_note TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      CHECK (
        (scope = 'global' AND school_id IS NULL)
        OR
        (scope = 'school' AND school_id IS NOT NULL)
      )
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_prompt_versions_v2 (
      id UUID PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('internal', 'external_pemerintah', 'external_mitra', 'live_guru')),
      scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant', 'questionnaire')),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      template TEXT NOT NULL,
      change_note TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      CHECK (
        (scope = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
        OR
        (scope = 'tenant' AND tenant_id IS NOT NULL AND questionnaire_id IS NULL)
        OR
        (scope = 'questionnaire' AND tenant_id IS NOT NULL AND questionnaire_id IS NOT NULL)
      )
    );
  `;
}

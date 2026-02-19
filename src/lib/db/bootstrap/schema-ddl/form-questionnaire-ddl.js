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

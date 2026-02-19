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

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tenant_type TEXT NOT NULL DEFAULT 'school' CHECK (tenant_type IN ('school', 'business', 'government', 'class', 'community', 'event', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS tenant_memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'tenant_admin', 'analyst')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id, role)
);

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

CREATE TABLE IF NOT EXISTS questionnaire_versions (
  id UUID PRIMARY KEY,
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  legacy_form_version_id UUID,
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

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  id BIGSERIAL PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  form_version_id UUID REFERENCES form_versions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'internal',
  analysis TEXT NOT NULL,
  meta JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analysis_v2 (
  id BIGSERIAL PRIMARY KEY,
  legacy_ai_analysis_id BIGINT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  questionnaire_version_id UUID REFERENCES questionnaire_versions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'internal',
  analysis TEXT NOT NULL,
  meta JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_school_memberships_user_id ON school_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_school_memberships_school_id ON school_memberships (school_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_memberships_superadmin_user
  ON school_memberships (user_id)
  WHERE role = 'superadmin';
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id ON tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id ON tenant_memberships (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_memberships_superadmin_tenant
  ON tenant_memberships (user_id, tenant_id)
  WHERE role = 'superadmin';
CREATE INDEX IF NOT EXISTS idx_form_versions_school_status ON form_versions (school_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_versions_one_published_per_school
  ON form_versions (school_id)
  WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_versions_one_draft_per_school
  ON form_versions (school_id)
  WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant_active
  ON questionnaires (tenant_id, is_active, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaires_one_default_per_tenant
  ON questionnaires (tenant_id)
  WHERE is_default = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_one_published
  ON questionnaire_versions (questionnaire_id)
  WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_one_draft
  ON questionnaire_versions (questionnaire_id)
  WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_legacy_form_version
  ON questionnaire_versions (legacy_form_version_id)
  WHERE legacy_form_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_responses_school_created_at ON responses (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_v2_tenant_questionnaire_created_at
  ON responses_v2 (tenant_id, questionnaire_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_v2_questionnaire_version_created_at
  ON responses_v2 (questionnaire_id, questionnaire_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_school_mode_created_at ON ai_analysis (school_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_v2_lookup
  ON ai_analysis_v2 (tenant_id, questionnaire_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_v2_version_lookup
  ON ai_analysis_v2 (tenant_id, questionnaire_id, questionnaire_version_id, mode, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analysis_v2_legacy_id
  ON ai_analysis_v2 (legacy_ai_analysis_id)
  WHERE legacy_ai_analysis_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_global_mode_status
  ON ai_prompt_versions (mode, status)
  WHERE scope = 'global' AND status IN ('draft', 'published');
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_school_mode_status
  ON ai_prompt_versions (mode, school_id, status)
  WHERE scope = 'school' AND status IN ('draft', 'published');
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_lookup
  ON ai_prompt_versions (mode, scope, school_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_v2_global_mode_status
  ON ai_prompt_versions_v2 (mode, status)
  WHERE scope = 'global' AND status IN ('draft', 'published');
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_v2_tenant_mode_status
  ON ai_prompt_versions_v2 (mode, tenant_id, status)
  WHERE scope = 'tenant' AND status IN ('draft', 'published');
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_v2_questionnaire_mode_status
  ON ai_prompt_versions_v2 (mode, questionnaire_id, status)
  WHERE scope = 'questionnaire' AND status IN ('draft', 'published');
CREATE INDEX IF NOT EXISTS idx_ai_prompt_v2_lookup
  ON ai_prompt_versions_v2 (mode, scope, tenant_id, questionnaire_id, status, created_at DESC);

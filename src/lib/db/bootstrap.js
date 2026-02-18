import { getSqlClient } from './sql.js';
import { getDefaultDraft } from '../../modules/forms/core.js';
import { getDefaultPromptTemplateMap } from '../../modules/ai-prompts/templates.js';

export const LEGACY_SCHOOL_SLUG = 'sman6-kotakupang';
export const LEGACY_REDIRECT_PREFIX = '/formsman6kotakupang';
export const DEFAULT_TENANT_TYPE = 'school';
export const DEFAULT_QUESTIONNAIRE_SLUG = 'feedback-utama';
export const DEFAULT_QUESTIONNAIRE_NAME = 'Feedback Utama';

const REQUIRED_RUNTIME_TABLES = [
  'schools',
  'users',
  'school_memberships',
  'form_versions',
  'responses',
  'sessions',
  'ai_analysis',
  'ai_prompt_versions',
  'tenants',
  'tenant_memberships',
  'questionnaires',
  'questionnaire_versions',
  'responses_v2',
  'ai_prompt_versions_v2',
  'ai_analysis_v2',
];

const schemaPromisesByMode = new Map();

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function resolveBootstrapMode(env, options = {}) {
  if (options.forceFullBootstrap) return 'full';

  const explicitMode = String(options.mode || env?.DB_BOOTSTRAP_MODE || '')
    .trim()
    .toLowerCase();
  if (explicitMode === 'full' || explicitMode === 'check') {
    return explicitMode;
  }

  const appEnv = String(env?.APP_ENV || 'local').trim().toLowerCase();
  if (appEnv === 'production' || appEnv === 'staging') {
    return 'check';
  }
  return 'full';
}

export async function ensurePlatformSchema(env, options = {}) {
  const mode = resolveBootstrapMode(env, options);
  const existingPromise = schemaPromisesByMode.get(mode);
  if (existingPromise) {
    return existingPromise;
  }

  const promise =
    mode === 'full'
      ? initializeSchema(env)
      : verifySchemaReady(env).catch((error) => {
          throw new Error(error?.message || 'Schema belum siap. Jalankan pnpm migrate:multi');
        });

  schemaPromisesByMode.set(
    mode,
    promise.catch((error) => {
      schemaPromisesByMode.delete(mode);
      throw error;
    })
  );
  return schemaPromisesByMode.get(mode);
}

async function verifySchemaReady(env) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${REQUIRED_RUNTIME_TABLES});
  `;

  const available = new Set(rows.map((row) => row.table_name));
  const missing = REQUIRED_RUNTIME_TABLES.filter((tableName) => !available.has(tableName));
  if (missing.length) {
    throw new Error(`Schema belum lengkap. Tabel hilang: ${missing.join(', ')}. Jalankan pnpm migrate:multi`);
  }
}

async function initializeSchema(env) {
  const sql = getSqlClient(env);

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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_school_memberships_user_id
    ON school_memberships (user_id);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_school_memberships_school_id
    ON school_memberships (school_id);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id
    ON tenant_memberships (user_id);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id
    ON tenant_memberships (tenant_id);
  `;

  await dedupeSuperadminMemberships(sql);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_school_memberships_superadmin_user
    ON school_memberships (user_id)
    WHERE role = 'superadmin';
  `;

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

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_legacy_form_version
    ON questionnaire_versions (legacy_form_version_id)
    WHERE legacy_form_version_id IS NOT NULL;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_form_versions_school_status
    ON form_versions (school_id, status);
  `;

  await normalizeFormVersionStatuses(sql);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_form_versions_one_published_per_school
    ON form_versions (school_id)
    WHERE status = 'published';
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_form_versions_one_draft_per_school
    ON form_versions (school_id)
    WHERE status = 'draft';
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant_active
    ON questionnaires (tenant_id, is_active, created_at DESC);
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaires_one_default_per_tenant
    ON questionnaires (tenant_id)
    WHERE is_default = TRUE;
  `;

  await normalizeQuestionnaireVersionStatuses(sql);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_one_published
    ON questionnaire_versions (questionnaire_id)
    WHERE status = 'published';
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_one_draft
    ON questionnaire_versions (questionnaire_id)
    WHERE status = 'draft';
  `;

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
    CREATE INDEX IF NOT EXISTS idx_responses_school_created_at
    ON responses (school_id, created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_responses_v2_tenant_questionnaire_created_at
    ON responses_v2 (tenant_id, questionnaire_id, created_at DESC);
  `;

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
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions (user_id);
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
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analysis_v2_legacy_id
    ON ai_analysis_v2 (legacy_ai_analysis_id)
    WHERE legacy_ai_analysis_id IS NOT NULL;
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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_analysis_school_mode_created_at
    ON ai_analysis (school_id, mode, created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_analysis_mode_created_at
    ON ai_analysis (mode, created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_analysis_v2_lookup
    ON ai_analysis_v2 (tenant_id, questionnaire_id, mode, created_at DESC);
  `;

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

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_global_mode_status
    ON ai_prompt_versions (mode, status)
    WHERE scope = 'global' AND status IN ('draft', 'published');
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_school_mode_status
    ON ai_prompt_versions (mode, school_id, status)
    WHERE scope = 'school' AND status IN ('draft', 'published');
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_lookup
    ON ai_prompt_versions (mode, scope, school_id, status, created_at DESC);
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_v2_global_mode_status
    ON ai_prompt_versions_v2 (mode, status)
    WHERE scope = 'global' AND status IN ('draft', 'published');
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_v2_tenant_mode_status
    ON ai_prompt_versions_v2 (mode, tenant_id, status)
    WHERE scope = 'tenant' AND status IN ('draft', 'published');
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_v2_questionnaire_mode_status
    ON ai_prompt_versions_v2 (mode, questionnaire_id, status)
    WHERE scope = 'questionnaire' AND status IN ('draft', 'published');
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_prompt_v2_lookup
    ON ai_prompt_versions_v2 (mode, scope, tenant_id, questionnaire_id, status, created_at DESC);
  `;

  const legacySchool = await ensureLegacySchool(sql);
  const publishedVersion = await ensurePublishedVersion(sql, legacySchool.id, null);
  await migrateLegacyResponses(sql, legacySchool.id, publishedVersion.id);
  await migrateLegacyAiRows(sql, legacySchool.id, publishedVersion.id);
  await ensureDefaultAiPromptVersions(sql);
  await syncTenantsFromSchools(sql);
  await syncTenantMembershipsFromSchoolMemberships(sql);
  await syncQuestionnairesFromFormVersions(sql);
  await syncResponsesV2FromResponses(sql);
  await syncAiAnalysisV2FromLegacy(sql);
  await ensureDefaultAiPromptVersionsV2(sql);
  await syncTenantPromptOverridesFromLegacy(sql);
}

async function dedupeSuperadminMemberships(sql) {
  await sql`
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY created_at ASC, ctid ASC
        ) AS rn
      FROM school_memberships
      WHERE role = 'superadmin'
    )
    DELETE FROM school_memberships sm
    USING ranked r
    WHERE sm.ctid = r.ctid
      AND r.rn > 1;
  `;
}

async function normalizeFormVersionStatuses(sql) {
  await sql`
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY school_id, status
          ORDER BY version DESC, created_at DESC, ctid DESC
        ) AS rn
      FROM form_versions
      WHERE status IN ('published', 'draft')
    )
    UPDATE form_versions fv
    SET
      status = 'archived',
      updated_at = NOW()
    FROM ranked r
    WHERE fv.ctid = r.ctid
      AND r.rn > 1;
  `;
}

async function normalizeQuestionnaireVersionStatuses(sql) {
  await sql`
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY questionnaire_id, status
          ORDER BY version DESC, created_at DESC, ctid DESC
        ) AS rn
      FROM questionnaire_versions
      WHERE status IN ('published', 'draft')
    )
    UPDATE questionnaire_versions qv
    SET
      status = 'archived',
      updated_at = NOW()
    FROM ranked r
    WHERE qv.ctid = r.ctid
      AND r.rn > 1;
  `;
}

async function syncTenantsFromSchools(sql) {
  await sql`
    INSERT INTO tenants (id, slug, name, tenant_type, is_active, created_at)
    SELECT
      s.id,
      s.slug,
      s.name,
      ${DEFAULT_TENANT_TYPE},
      s.is_active,
      s.created_at
    FROM schools s
    ON CONFLICT (id) DO UPDATE
    SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      tenant_type = EXCLUDED.tenant_type,
      is_active = EXCLUDED.is_active;
  `;
}

async function syncTenantMembershipsFromSchoolMemberships(sql) {
  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role, created_at)
    SELECT
      sm.user_id,
      sm.school_id,
      'tenant_admin',
      sm.created_at
    FROM school_memberships sm
    WHERE sm.role = 'school_admin'
      AND sm.school_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = sm.school_id)
    ON CONFLICT DO NOTHING;
  `;

  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role, created_at)
    SELECT
      sm.user_id,
      t.id,
      'superadmin',
      sm.created_at
    FROM school_memberships sm
    CROSS JOIN tenants t
    WHERE sm.role = 'superadmin'
    ON CONFLICT DO NOTHING;
  `;
}

async function getDefaultQuestionnaireByTenantId(sql, tenantId) {
  const rows = await sql`
    SELECT id, tenant_id, slug, name, is_default
    FROM questionnaires
    WHERE tenant_id = ${tenantId}
      AND is_default = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
  `;
  return rows[0] || null;
}

async function ensureDefaultQuestionnaire(sql, { tenantId, createdBy = null, name = DEFAULT_QUESTIONNAIRE_NAME }) {
  const existingDefault = await getDefaultQuestionnaireByTenantId(sql, tenantId);
  if (existingDefault) {
    return existingDefault;
  }

  await sql`
    UPDATE questionnaires
    SET is_default = FALSE
    WHERE tenant_id = ${tenantId}
      AND is_default = TRUE;
  `;

  const rows = await sql`
    INSERT INTO questionnaires (
      id,
      tenant_id,
      slug,
      name,
      category,
      description,
      is_active,
      is_default,
      created_by
    )
    VALUES (
      ${crypto.randomUUID()},
      ${tenantId},
      ${DEFAULT_QUESTIONNAIRE_SLUG},
      ${name},
      'general_feedback',
      'Questionnaire default hasil migrasi dari form sekolah lama',
      TRUE,
      TRUE,
      ${createdBy}
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_active = TRUE,
      is_default = TRUE
    RETURNING id, tenant_id, slug, name, is_default;
  `;

  return rows[0] || null;
}

function buildQuestionnaireSchemaFromLegacyForm(row) {
  const coreFields = parseJson(row.core_schema, []);
  const extraFields = parseJson(row.extra_schema, []);
  return {
    fields: [...coreFields, ...extraFields],
    coreFields,
    extraFields,
    legacy: {
      schoolId: row.school_id,
      formVersionId: row.id,
    },
  };
}

async function syncQuestionnairesFromFormVersions(sql) {
  const schools = await sql`
    SELECT id, name
    FROM schools
    ORDER BY created_at ASC;
  `;

  for (const school of schools) {
    const questionnaire = await ensureDefaultQuestionnaire(sql, {
      tenantId: school.id,
      createdBy: null,
      name: DEFAULT_QUESTIONNAIRE_NAME,
    });
    if (!questionnaire?.id) continue;

    const formVersions = await sql`
      SELECT
        id,
        school_id,
        version,
        status,
        meta,
        core_schema,
        extra_schema,
        published_at,
        created_by,
        created_at,
        updated_at
      FROM form_versions
      WHERE school_id = ${school.id}
      ORDER BY version ASC;
    `;

    for (const versionRow of formVersions) {
      const schema = buildQuestionnaireSchemaFromLegacyForm(versionRow);
      await sql`
        INSERT INTO questionnaire_versions (
          id,
          questionnaire_id,
          legacy_form_version_id,
          version,
          status,
          meta,
          schema,
          published_at,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()},
          ${questionnaire.id},
          ${versionRow.id},
          ${versionRow.version},
          ${versionRow.status},
          ${JSON.stringify(parseJson(versionRow.meta, {}))},
          ${JSON.stringify(schema)},
          ${versionRow.published_at},
          ${versionRow.created_by},
          ${versionRow.created_at},
          ${versionRow.updated_at}
        )
        ON CONFLICT (legacy_form_version_id) DO UPDATE
        SET
          questionnaire_id = EXCLUDED.questionnaire_id,
          version = EXCLUDED.version,
          status = EXCLUDED.status,
          meta = EXCLUDED.meta,
          schema = EXCLUDED.schema,
          published_at = EXCLUDED.published_at,
          created_by = COALESCE(EXCLUDED.created_by, questionnaire_versions.created_by),
          updated_at = COALESCE(EXCLUDED.updated_at, questionnaire_versions.updated_at);
      `;
    }
  }
}

async function syncResponsesV2FromResponses(sql) {
  await sql`
    INSERT INTO responses_v2 (
      legacy_response_id,
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      respondent,
      answers,
      payload,
      created_at
    )
      SELECT
        r.id,
        r.school_id,
        q.id,
        qv.id,
      jsonb_build_object(
        'namaGuru', r.nama_guru,
        'lamaMengajar', r.lama_mengajar,
        'mataPelajaran', r.mata_pelajaran
      ),
      (
        jsonb_build_object(
          'namaGuru', r.nama_guru,
          'lamaMengajar', r.lama_mengajar,
          'mataPelajaran', r.mata_pelajaran,
          'q1', r.q1,
          'q2', r.q2,
          'q3', r.q3,
          'q4', r.q4,
          'q5', r.q5,
          'q6', r.q6,
          'q7', r.q7,
          'q8', r.q8,
          'q9', r.q9,
          'q10', r.q10,
          'q11', r.q11,
          'q12', r.q12
        ) || COALESCE(r.extra_answers, '{}'::jsonb)
      ),
      COALESCE(r.payload, '{}'::jsonb),
      r.created_at
    FROM responses r
    JOIN questionnaire_versions qv
      ON qv.legacy_form_version_id = r.form_version_id
    JOIN questionnaires q
      ON q.id = qv.questionnaire_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM responses_v2 rv2
      WHERE rv2.legacy_response_id = r.id
    );
  `;
}

async function syncAiAnalysisV2FromLegacy(sql) {
  await sql`
    INSERT INTO ai_analysis_v2 (
      legacy_ai_analysis_id,
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      mode,
      analysis,
      meta,
      created_at
    )
    SELECT
      ai.id,
      ai.school_id,
      COALESCE(qv.questionnaire_id, q_default.id) AS questionnaire_id,
      COALESCE(qv.id, qv_default.id) AS questionnaire_version_id,
      ai.mode,
      ai.analysis,
      ai.meta,
      ai.created_at
    FROM ai_analysis ai
    LEFT JOIN questionnaire_versions qv
      ON qv.legacy_form_version_id = ai.form_version_id
    LEFT JOIN questionnaires q_default
      ON q_default.tenant_id = ai.school_id
      AND q_default.is_default = TRUE
    LEFT JOIN questionnaire_versions qv_default
      ON qv_default.questionnaire_id = q_default.id
      AND qv_default.status = 'published'
    WHERE ai.school_id IS NOT NULL
      AND COALESCE(qv.questionnaire_id, q_default.id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM ai_analysis_v2 v2
        WHERE v2.legacy_ai_analysis_id = ai.id
      );
  `;
}

async function ensureLegacySchool(sql) {
  const existingRows = await sql`
    SELECT id, slug, name, is_active
    FROM schools
    WHERE slug = ${LEGACY_SCHOOL_SLUG}
    LIMIT 1;
  `;

  if (existingRows.length) {
    return existingRows[0];
  }

  const id = crypto.randomUUID();
  const [inserted] = await sql`
    INSERT INTO schools (id, slug, name, is_active)
    VALUES (${id}, ${LEGACY_SCHOOL_SLUG}, ${'SMAN 6 Kota Kupang'}, TRUE)
    RETURNING id, slug, name, is_active;
  `;
  return inserted;
}

export async function ensurePublishedVersion(sql, schoolId, createdBy) {
  const existingPublished = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;

  if (existingPublished.length) {
    return existingPublished[0];
  }

  const { meta, coreFields, extraFields } = getDefaultDraft();
  const [inserted] = await sql`
    WITH next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM form_versions
      WHERE school_id = ${schoolId}
    )
    INSERT INTO form_versions (
      id,
      school_id,
      version,
      status,
      meta,
      core_schema,
      extra_schema,
      published_at,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${schoolId},
      next_version.version,
      'published',
      ${JSON.stringify(meta)},
      ${JSON.stringify(coreFields)},
      ${JSON.stringify(extraFields)},
      NOW(),
      ${createdBy}
    FROM next_version
    ON CONFLICT (school_id, version) DO NOTHING
    RETURNING id, version, meta, core_schema, extra_schema;
  `;

  if (inserted) {
    return inserted;
  }

  const fallbackPublished = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return fallbackPublished[0] || null;
}

export async function ensureDraftVersion(sql, schoolId, createdBy) {
  const existingDraft = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;

  if (existingDraft.length) {
    return existingDraft[0];
  }

  const published = await ensurePublishedVersion(sql, schoolId, createdBy);
  if (!published) {
    throw new Error('Form published belum tersedia saat membuat draft.');
  }

  const [inserted] = await sql`
    WITH source AS (
      SELECT
        ${JSON.stringify(parseJson(published.meta, {}))}::jsonb AS meta,
        ${JSON.stringify(parseJson(published.core_schema, []))}::jsonb AS core_schema,
        ${JSON.stringify(parseJson(published.extra_schema, []))}::jsonb AS extra_schema
    ),
    next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM form_versions
      WHERE school_id = ${schoolId}
    )
    INSERT INTO form_versions (
      id,
      school_id,
      version,
      status,
      meta,
      core_schema,
      extra_schema,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${schoolId},
      next_version.version,
      'draft',
      source.meta,
      source.core_schema,
      source.extra_schema,
      ${createdBy}
    FROM source, next_version
    ON CONFLICT (school_id) WHERE status = 'draft'
    DO UPDATE SET updated_at = form_versions.updated_at
    RETURNING id, version, meta, core_schema, extra_schema;
  `;

  if (inserted) {
    return inserted;
  }

  const fallbackDraft = await sql`
    SELECT id, version, meta, core_schema, extra_schema
    FROM form_versions
    WHERE school_id = ${schoolId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return fallbackDraft[0] || null;
}

async function migrateLegacyResponses(sql, schoolId, formVersionId) {
  const [legacyTable] = await sql`
    SELECT to_regclass('public.form_responses')::text AS table_name;
  `;

  if (!legacyTable?.table_name) return;

  await sql`
    INSERT INTO responses (
      legacy_response_id,
      school_id,
      form_version_id,
      nama_guru,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12,
      extra_answers,
      payload,
      created_at
    )
    SELECT
      fr.id,
      ${schoolId},
      ${formVersionId},
      fr.nama_guru,
      fr.lama_mengajar,
      fr.mata_pelajaran,
      fr.q1, fr.q2, fr.q3, fr.q4, fr.q5, fr.q6, fr.q7, fr.q8, fr.q9, fr.q10, fr.q11, fr.q12,
      '{}'::jsonb,
      COALESCE(fr.payload, '{}'::jsonb),
      fr.created_at
    FROM form_responses fr
    WHERE NOT EXISTS (
      SELECT 1
      FROM responses r
      WHERE r.legacy_response_id = fr.id
    );
  `;
}

async function migrateLegacyAiRows(sql, schoolId, formVersionId) {
  const [aiTable] = await sql`
    SELECT to_regclass('public.ai_analysis')::text AS table_name;
  `;
  if (!aiTable?.table_name) return;

  await sql`
    UPDATE ai_analysis
    SET
      school_id = ${schoolId},
      form_version_id = COALESCE(form_version_id, ${formVersionId})
    WHERE school_id IS NULL;
  `;
}

async function ensureDefaultAiPromptVersions(sql) {
  const templates = getDefaultPromptTemplateMap();
  const modes = Object.keys(templates);

  for (const mode of modes) {
    const template = templates[mode];
    await sql`
      INSERT INTO ai_prompt_versions (
        id, mode, scope, school_id, status, template, change_note, created_by, published_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        'published',
        ${template},
        'seed: default global published',
        NULL,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    `;

    await sql`
      INSERT INTO ai_prompt_versions (
        id, mode, scope, school_id, status, template, change_note, created_by
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        'draft',
        ${template},
        'seed: default global draft',
        NULL
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}

async function ensureDefaultAiPromptVersionsV2(sql) {
  const templates = getDefaultPromptTemplateMap();
  const modes = Object.keys(templates);

  for (const mode of modes) {
    const template = templates[mode];
    await sql`
      INSERT INTO ai_prompt_versions_v2 (
        id, mode, scope, tenant_id, questionnaire_id, status, template, change_note, created_by, published_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        NULL,
        'published',
        ${template},
        'seed: global published',
        NULL,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    `;

    await sql`
      INSERT INTO ai_prompt_versions_v2 (
        id, mode, scope, tenant_id, questionnaire_id, status, template, change_note, created_by
      )
      VALUES (
        ${crypto.randomUUID()},
        ${mode},
        'global',
        NULL,
        NULL,
        'draft',
        ${template},
        'seed: global draft',
        NULL
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}

async function syncTenantPromptOverridesFromLegacy(sql) {
  const rows = await sql`
    SELECT
      ap.mode,
      ap.school_id,
      ap.status,
      ap.template,
      ap.change_note,
      ap.created_by,
      ap.created_at,
      ap.published_at
    FROM (
      SELECT
        ap.*,
        ROW_NUMBER() OVER (
          PARTITION BY ap.mode, ap.school_id, ap.status
          ORDER BY ap.created_at DESC, ap.id DESC
        ) AS rn
      FROM ai_prompt_versions ap
      WHERE ap.scope = 'school'
        AND ap.school_id IS NOT NULL
        AND ap.status IN ('draft', 'published')
    ) ap
    WHERE ap.rn = 1;
  `;

  for (const row of rows) {
    await sql`
      INSERT INTO ai_prompt_versions_v2 (
        id,
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        status,
        template,
        change_note,
        created_by,
        created_at,
        published_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${row.mode},
        'tenant',
        ${row.school_id},
        NULL,
        ${row.status},
        ${row.template},
        ${row.change_note},
        ${row.created_by},
        ${row.created_at},
        ${row.published_at}
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}

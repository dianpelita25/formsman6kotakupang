export async function createMembershipIndexes(sql) {
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
}

export async function createSuperadminMembershipIndex(sql) {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_school_memberships_superadmin_user
    ON school_memberships (user_id)
    WHERE role = 'superadmin';
  `;
}

export async function createQuestionnaireLegacyVersionIndex(sql) {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_versions_legacy_form_version
    ON questionnaire_versions (legacy_form_version_id)
    WHERE legacy_form_version_id IS NOT NULL;
  `;
}

export async function createFormVersionLookupIndex(sql) {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_form_versions_school_status
    ON form_versions (school_id, status);
  `;
}

export async function createFormVersionStatusUniqueIndexes(sql) {
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
}

export async function createQuestionnaireLookupIndexes(sql) {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant_active
    ON questionnaires (tenant_id, is_active, created_at DESC);
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaires_one_default_per_tenant
    ON questionnaires (tenant_id)
    WHERE is_default = TRUE;
  `;
}

export async function createQuestionnaireStatusUniqueIndexes(sql) {
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
}

export async function createResponseIndexes(sql) {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_responses_school_created_at
    ON responses (school_id, created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_responses_v2_tenant_questionnaire_created_at
    ON responses_v2 (tenant_id, questionnaire_id, created_at DESC);
  `;
}

export async function createFormOpenDeviceIndexes(sql) {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_form_open_devices_tenant_questionnaire_last_seen
    ON form_open_devices (tenant_id, questionnaire_id, last_seen_at DESC);
  `;
}

export async function createSessionIndex(sql) {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions (user_id);
  `;
}

export async function createLoginThrottleIndexes(sql) {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_login_throttle_state_blocked_until
    ON login_throttle_state (blocked_until);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_login_throttle_state_updated_at
    ON login_throttle_state (updated_at DESC);
  `;
}

export async function createAiIndexes(sql) {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analysis_v2_legacy_id
    ON ai_analysis_v2 (legacy_ai_analysis_id)
    WHERE legacy_ai_analysis_id IS NOT NULL;
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
}

export async function createPromptIndexes(sql) {
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
}

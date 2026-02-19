import { DEFAULT_QUESTIONNAIRE_NAME, DEFAULT_QUESTIONNAIRE_SLUG, DEFAULT_TENANT_TYPE } from './constants.js';
import { parseJson } from './json-utils.js';

export async function syncTenantsFromSchools(sql) {
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

export async function syncTenantMembershipsFromSchoolMemberships(sql) {
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

export async function syncQuestionnairesFromFormVersions(sql) {
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

export async function syncResponsesV2FromResponses(sql) {
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

export async function syncAiAnalysisV2FromLegacy(sql) {
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

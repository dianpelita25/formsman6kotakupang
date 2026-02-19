import { DEFAULT_QUESTIONNAIRE_NAME, DEFAULT_QUESTIONNAIRE_SLUG } from '../constants.js';

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

export async function ensureDefaultQuestionnaire(sql, { tenantId, createdBy = null, name = DEFAULT_QUESTIONNAIRE_NAME }) {
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

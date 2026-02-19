import { getSqlClient } from './sql-client.js';
import {
  DEFAULT_QUESTIONNAIRE_NAME,
  DEFAULT_QUESTIONNAIRE_SLUG,
  normalizeDefaultDraft,
  normalizeQuestionnaireRow,
} from './shared.js';
import { getDraftVersionByQuestionnaireId, getPublishedVersionByQuestionnaireId } from './version-repository.js';

export async function findDefaultQuestionnaireByTenantId(env, tenantId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at
    FROM questionnaires
    WHERE tenant_id = ${tenantId}
      AND is_default = TRUE
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function findQuestionnaireByTenantAndSlug(env, tenantId, slug) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at
    FROM questionnaires
    WHERE tenant_id = ${tenantId}
      AND slug = ${slug}
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function findQuestionnaireByLegacyFormVersionId(env, legacyFormVersionId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      q.id,
      q.tenant_id,
      q.slug,
      q.name,
      q.category,
      q.description,
      q.is_active,
      q.is_default,
      q.created_by,
      q.created_at
    FROM questionnaire_versions qv
    JOIN questionnaires q ON q.id = qv.questionnaire_id
    WHERE qv.legacy_form_version_id = ${legacyFormVersionId}
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function listQuestionnairesByTenantId(env, tenantId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      q.id,
      q.tenant_id,
      q.slug,
      q.name,
      q.category,
      q.description,
      q.is_active,
      q.is_default,
      q.created_by,
      q.created_at,
      COUNT(rv2.id)::int AS total_responses
    FROM questionnaires q
    LEFT JOIN responses_v2 rv2 ON rv2.questionnaire_id = q.id
    WHERE q.tenant_id = ${tenantId}
    GROUP BY q.id, q.tenant_id, q.slug, q.name, q.category, q.description, q.is_active, q.is_default, q.created_by, q.created_at
    ORDER BY q.created_at ASC;
  `;
}

export async function listActiveQuestionnairesByTenantId(env, tenantId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      q.id,
      q.tenant_id,
      q.slug,
      q.name,
      q.category,
      q.description,
      q.is_active,
      q.is_default,
      q.created_by,
      q.created_at
    FROM questionnaires q
    WHERE q.tenant_id = ${tenantId}
      AND q.is_active = TRUE
    ORDER BY q.is_default DESC, q.created_at ASC;
  `;
}

export async function createQuestionnaire(env, { tenantId, slug, name, category, description, createdBy, isDefault }) {
  const sql = getSqlClient(env);
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
      ${slug},
      ${name},
      ${category},
      ${description},
      TRUE,
      ${Boolean(isDefault)},
      ${createdBy}
    )
    RETURNING id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function updateQuestionnaire(env, questionnaireId, payload) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE questionnaires
    SET
      slug = COALESCE(${payload.slug}, slug),
      name = COALESCE(${payload.name}, name),
      category = COALESCE(${payload.category}, category),
      description = COALESCE(${payload.description}, description),
      is_active = COALESCE(${payload.isActive}, is_active)
    WHERE id = ${questionnaireId}
    RETURNING id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function getQuestionnaireById(env, questionnaireId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at
    FROM questionnaires
    WHERE id = ${questionnaireId}
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function ensureDefaultQuestionnaireForTenant(env, tenantId, actorId = null, fallbackDraft = null) {
  const existing = await findDefaultQuestionnaireByTenantId(env, tenantId);
  if (existing) return existing;

  const resolvedFallback = normalizeDefaultDraft(fallbackDraft);
  const created = await createQuestionnaire(env, {
    tenantId,
    slug: DEFAULT_QUESTIONNAIRE_SLUG,
    name: DEFAULT_QUESTIONNAIRE_NAME,
    category: 'general_feedback',
    description: 'Questionnaire default tenant',
    createdBy: actorId,
    isDefault: true,
  });

  const draftMeta = resolvedFallback.meta;
  const draftSchema = {
    fields: resolvedFallback.coreFields,
    coreFields: resolvedFallback.coreFields,
    extraFields: [],
  };

  await getDraftVersionByQuestionnaireId(env, created.id, actorId, resolvedFallback);
  const published = await getPublishedVersionByQuestionnaireId(env, created.id);
  if (!published) {
    const sql = getSqlClient(env);
    await sql`
      WITH next_version AS (
        SELECT COALESCE(MAX(version), 0) + 1 AS version
        FROM questionnaire_versions
        WHERE questionnaire_id = ${created.id}
      )
      INSERT INTO questionnaire_versions (
        id,
        questionnaire_id,
        version,
        status,
        meta,
        schema,
        published_at,
        created_by
      )
      SELECT
        ${crypto.randomUUID()},
        ${created.id},
        next_version.version,
        'published',
        ${JSON.stringify(draftMeta)},
        ${JSON.stringify(draftSchema)},
        NOW(),
        ${actorId}
      FROM next_version
      ON CONFLICT DO NOTHING;
    `;
  }

  await getDraftVersionByQuestionnaireId(env, created.id, actorId, resolvedFallback);
  return created;
}


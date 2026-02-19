import { getDefaultDraft } from '../../forms/core.js';
import {
  createPublishedVersion,
  createQuestionnaire,
  findDefaultQuestionnaireByTenantId,
  findQuestionnaireByLegacyFormVersionId,
  findQuestionnaireByTenantAndSlug,
  getDraftVersionByQuestionnaireId,
  getPublishedVersionByQuestionnaireId,
  getQuestionnaireById,
  listActiveQuestionnairesByTenantId,
  listQuestionnairesByTenantId,
  updateQuestionnaire,
} from '../repository.js';
import { normalizeQuestionnaireCreatePayload } from '../schema.js';

export async function listTenantQuestionnaires(env, tenantId) {
  const rows = await listQuestionnairesByTenantId(env, tenantId);
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description || '',
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    totalResponses: Number(row.total_responses || 0),
  }));
}

export async function listPublicQuestionnairesByTenant(env, tenantId) {
  const rows = await listActiveQuestionnairesByTenantId(env, tenantId);
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description || '',
    isDefault: row.is_default,
  }));
}

export async function getDefaultQuestionnaireByTenantId(env, tenantId) {
  return findDefaultQuestionnaireByTenantId(env, tenantId);
}

export async function getQuestionnaireByIdForTenant(env, questionnaireId) {
  return getQuestionnaireById(env, questionnaireId);
}

export async function getQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug) {
  return findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
}

export async function getQuestionnaireByLegacyFormVersionId(env, legacyFormVersionId) {
  return findQuestionnaireByLegacyFormVersionId(env, legacyFormVersionId);
}

export async function createTenantQuestionnaire(env, tenantId, actorId, payload) {
  const normalized = normalizeQuestionnaireCreatePayload(payload);
  if (!normalized.ok) {
    return normalized;
  }

  try {
    const created = await createQuestionnaire(env, {
      tenantId,
      slug: normalized.data.slug,
      name: normalized.data.name,
      category: normalized.data.category,
      description: normalized.data.description,
      createdBy: actorId,
      isDefault: false,
    });

    const defaultDraft = getDefaultDraft();
    await createPublishedVersion(env, {
      questionnaireId: created.id,
      meta: defaultDraft.meta,
      schema: {
        fields: defaultDraft.coreFields,
        coreFields: defaultDraft.coreFields,
        extraFields: [],
      },
      actorId,
    });
    await getDraftVersionByQuestionnaireId(env, created.id, actorId, defaultDraft);

    return {
      ok: true,
      status: 201,
      data: created,
    };
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return { ok: false, status: 409, message: 'Slug questionnaire sudah dipakai dalam organisasi ini.' };
    }
    throw error;
  }
}

export async function patchQuestionnaire(env, tenantId, questionnaireId, payload) {
  const next = {};
  if (payload?.name != null) {
    const value = String(payload.name || '').trim();
    if (!value) return { ok: false, status: 400, message: 'Nama questionnaire tidak valid.' };
    next.name = value;
  }
  if (payload?.slug != null) {
    const normalized = String(payload.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!normalized) return { ok: false, status: 400, message: 'Slug questionnaire tidak valid.' };
    next.slug = normalized;
  }
  if (payload?.category != null) {
    next.category = String(payload.category || '').trim().toLowerCase() || 'general_feedback';
  }
  if (payload?.description != null) {
    next.description = String(payload.description || '').trim();
  }
  if (payload?.isActive != null) {
    next.isActive = Boolean(payload.isActive);
  }

  if (!Object.keys(next).length) {
    return { ok: false, status: 400, message: 'Tidak ada perubahan.' };
  }

  const updated = await updateQuestionnaire(env, questionnaireId, next);
  if (!updated) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  if (updated.tenantId !== tenantId) return { ok: false, status: 403, message: 'Forbidden' };

  return { ok: true, status: 200, data: updated };
}

export async function getPublishedQuestionnaireSchemaBySlug(env, tenantId, questionnaireSlug) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire || !questionnaire.isActive) {
    return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  }

  const published = await getPublishedVersionByQuestionnaireId(env, questionnaire.id);
  if (!published) {
    return { ok: false, status: 404, message: 'Questionnaire belum dipublish.' };
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      version: published.version,
      questionnaireVersionId: published.id,
      meta: published.meta,
      fields: Array.isArray(published.schema?.fields) ? published.schema.fields : [],
    },
  };
}

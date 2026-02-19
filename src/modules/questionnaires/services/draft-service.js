import { getDefaultDraft } from '../../forms/core.js';
import {
  findQuestionnaireByTenantAndSlug,
  getDraftVersionByQuestionnaireId,
  listQuestionnaireVersionsByQuestionnaireId,
  publishDraftVersion,
  saveDraftVersion,
} from '../repository.js';
import { normalizeQuestionnaireDraftInput } from '../schema.js';

export async function getTenantQuestionnaireDraft(env, tenantId, questionnaireSlug, actorId) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  const draft = await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId, getDefaultDraft());
  if (!draft) return { ok: false, status: 404, message: 'Draft questionnaire tidak ditemukan.' };

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      draft,
    },
  };
}

export async function getTenantQuestionnaireVersions(env, tenantId, questionnaireSlug) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  const versions = await listQuestionnaireVersionsByQuestionnaireId(env, questionnaire.id);
  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      versions: versions.map((entry) => ({
        id: entry.id,
        version: entry.version,
        status: entry.status,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt,
      })),
    },
  };
}

export async function updateTenantQuestionnaireDraft(env, tenantId, questionnaireSlug, actorId, payload) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  const normalized = normalizeQuestionnaireDraftInput(payload);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      message: normalized.message,
      errors: normalized.errors,
    };
  }

  const draft = await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId, getDefaultDraft());
  if (!draft) return { ok: false, status: 404, message: 'Draft questionnaire tidak ditemukan.' };

  const saved = await saveDraftVersion(env, {
    questionnaireId: questionnaire.id,
    draftId: draft.id,
    meta: normalized.data.meta,
    schema: {
      fields: normalized.data.fields,
      ...normalized.data.schema,
    },
    actorId,
  });

  if (!saved) {
    return { ok: false, status: 500, message: 'Gagal menyimpan draft questionnaire.' };
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      draft: saved,
    },
  };
}

export async function publishTenantQuestionnaireDraft(env, tenantId, questionnaireSlug, actorId) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  let published;
  try {
    published = await publishDraftVersion(env, {
      questionnaireId: questionnaire.id,
      actorId,
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('uq_questionnaire_versions_one_published') || message.includes('duplicate key value')) {
      return {
        ok: false,
        status: 409,
        message: 'Terjadi konflik publish. Muat ulang draf lalu coba publish lagi.',
      };
    }
    throw error;
  }
  if (!published) return { ok: false, status: 404, message: 'Draft questionnaire tidak ditemukan.' };

  await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId, getDefaultDraft());

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      published,
    },
  };
}

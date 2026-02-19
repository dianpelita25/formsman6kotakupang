import {
  findQuestionnaireByTenantAndSlug,
  getQuestionnaireVersionById,
  getPublishedVersionByQuestionnaireId,
} from './repository.js';

export async function resolveQuestionnaireContext(env, tenantId, questionnaireSlug, rawVersionId = null) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) {
    return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  }

  const requestedVersionId = String(rawVersionId || '').trim() || null;
  if (requestedVersionId) {
    const selected = await getQuestionnaireVersionById(env, questionnaire.id, requestedVersionId);
    if (!selected) {
      return { ok: false, status: 404, message: 'Versi questionnaire tidak ditemukan.' };
    }
    return { ok: true, questionnaire, selectedVersion: selected, questionnaireVersionId: selected.id };
  }

  const published = await getPublishedVersionByQuestionnaireId(env, questionnaire.id);
  return {
    ok: true,
    questionnaire,
    selectedVersion: published || null,
    questionnaireVersionId: published?.id || null,
  };
}

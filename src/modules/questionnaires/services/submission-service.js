import { findDefaultQuestionnaireByTenantId, insertResponseV2 } from '../repository.js';
import { validateSubmissionPayload } from '../validation.js';
import { extractRespondent } from '../response-utils.js';
import { getPublishedQuestionnaireSchemaBySlug } from './catalog-service.js';

export async function submitQuestionnaireResponse(env, tenantId, questionnaireSlug, payload) {
  const published = await getPublishedQuestionnaireSchemaBySlug(env, tenantId, questionnaireSlug);
  if (!published.ok) return published;

  const validation = validateSubmissionPayload(published.data.fields, payload);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      message: validation.message,
      errors: validation.errors,
    };
  }

  const inserted = await insertResponseV2(env, {
    tenantId,
    questionnaireId: published.data.questionnaire.id,
    questionnaireVersionId: published.data.questionnaireVersionId,
    respondent: extractRespondent(validation.data),
    answers: validation.data,
    payload: validation.data,
  });

  if (!inserted) {
    return { ok: false, status: 500, message: 'Gagal menyimpan response questionnaire.' };
  }

  return {
    ok: true,
    status: 201,
    data: {
      id: inserted.id,
      createdAt: inserted.created_at,
    },
  };
}

export async function submitDefaultTenantQuestionnaireResponse(env, tenantId, payload) {
  const questionnaire = await findDefaultQuestionnaireByTenantId(env, tenantId);
  if (!questionnaire) {
    return { ok: false, status: 404, message: 'Questionnaire default tenant tidak ditemukan.' };
  }
  return submitQuestionnaireResponse(env, tenantId, questionnaire.slug, payload);
}

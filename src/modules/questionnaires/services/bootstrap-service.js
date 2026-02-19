import { getDefaultDraft } from '../../forms/core.js';
import {
  createPublishedVersion,
  ensureDefaultQuestionnaireForTenant,
  getDraftVersionByQuestionnaireId,
  getPublishedVersionByQuestionnaireId,
} from '../repository.js';

export async function ensureTenantQuestionnaireInitialized(env, tenantId, actorId = null) {
  const defaultDraft = getDefaultDraft();
  const questionnaire = await ensureDefaultQuestionnaireForTenant(env, tenantId, actorId, defaultDraft);
  const published = await getPublishedVersionByQuestionnaireId(env, questionnaire.id);

  if (!published) {
    const draft = defaultDraft;
    await createPublishedVersion(env, {
      questionnaireId: questionnaire.id,
      meta: draft.meta,
      schema: {
        fields: draft.coreFields,
        coreFields: draft.coreFields,
        extraFields: [],
      },
      actorId,
    });
  }

  await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId, defaultDraft);
  return questionnaire;
}

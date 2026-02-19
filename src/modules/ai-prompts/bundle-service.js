import { normalizeAiMode } from '../shared/ai-modes.js';
import { getPromptByStatus } from './repository.js';
import { mapEffectivePrompt } from './effective-prompt.js';
import { inferScope, normalizeScope, validateScopePayload } from './scope-resolution.js';

export async function getAiPromptBundle(env, query = {}) {
  const mode = normalizeAiMode(query.mode);
  if (!mode) {
    return { ok: false, status: 400, message: 'Mode prompt AI tidak valid.' };
  }

  const resolvedScope = normalizeScope(query.scope) || inferScope(query);
  const target = await validateScopePayload(env, {
    scope: resolvedScope,
    schoolId: query.schoolId,
    tenantId: query.tenantId,
    questionnaireId: query.questionnaireId,
  });
  if (!target.ok) return target;

  const [globalDraft, globalPublished, tenantDraft, tenantPublished, questionnaireDraft, questionnairePublished] =
    await Promise.all([
      getPromptByStatus(env, { mode, scope: 'global', status: 'draft' }),
      getPromptByStatus(env, { mode, scope: 'global', status: 'published' }),
      target.tenantId
        ? getPromptByStatus(env, { mode, scope: 'tenant', tenantId: target.tenantId, status: 'draft' })
        : Promise.resolve(null),
      target.tenantId
        ? getPromptByStatus(env, { mode, scope: 'tenant', tenantId: target.tenantId, status: 'published' })
        : Promise.resolve(null),
      target.questionnaireId
        ? getPromptByStatus(env, {
            mode,
            scope: 'questionnaire',
            tenantId: target.tenantId,
            questionnaireId: target.questionnaireId,
            status: 'draft',
          })
        : Promise.resolve(null),
      target.questionnaireId
        ? getPromptByStatus(env, {
            mode,
            scope: 'questionnaire',
            tenantId: target.tenantId,
            questionnaireId: target.questionnaireId,
            status: 'published',
          })
        : Promise.resolve(null),
    ]);

  const effective = mapEffectivePrompt(mode, questionnairePublished, tenantPublished, globalPublished);

  return {
    ok: true,
    status: 200,
    data: {
      mode,
      scope: target.scope,
      schoolId: target.schoolId,
      tenantId: target.tenantId,
      questionnaireId: target.questionnaireId,
      effective,
      globalDraft,
      globalPublished,
      tenantDraft,
      tenantPublished,
      questionnaireDraft,
      questionnairePublished,
      schoolDraft: tenantDraft,
      schoolPublished: tenantPublished,
    },
  };
}

import { normalizeAiMode } from '../shared/ai-modes.js';
import { getPromptByStatus } from './repository.js';
import { mapEffectivePrompt } from './effective-prompt.js';
import { getDefaultPromptTemplate, buildPromptTemplateContext, renderPromptTemplate } from './templates.js';

export async function resolveRenderedPrompt(env, { mode, school, tenant, questionnaire, summary, distribution, responses }) {
  const normalizedMode = normalizeAiMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode prompt AI tidak valid.');
  }

  const tenantId = questionnaire?.tenantId || tenant?.id || school?.id || null;
  const questionnaireId = questionnaire?.id || null;

  const [questionnairePublished, tenantPublished, globalPublished] = await Promise.all([
    questionnaireId
      ? getPromptByStatus(env, {
          mode: normalizedMode,
          scope: 'questionnaire',
          tenantId,
          questionnaireId,
          status: 'published',
        })
      : Promise.resolve(null),
    tenantId
      ? getPromptByStatus(env, { mode: normalizedMode, scope: 'tenant', tenantId, status: 'published' })
      : Promise.resolve(null),
    getPromptByStatus(env, { mode: normalizedMode, scope: 'global', status: 'published' }),
  ]);

  const effective = mapEffectivePrompt(normalizedMode, questionnairePublished, tenantPublished, globalPublished);
  const context = buildPromptTemplateContext({
    school,
    tenant,
    questionnaire,
    summary,
    distribution,
    responses,
  });

  try {
    const rendered = renderPromptTemplate(effective.template, context);
    return {
      mode: normalizedMode,
      source: effective.source,
      template: effective.template,
      rendered,
    };
  } catch {
    const fallbackTemplate = getDefaultPromptTemplate(normalizedMode);
    return {
      mode: normalizedMode,
      source: 'fallback',
      template: fallbackTemplate,
      rendered: renderPromptTemplate(fallbackTemplate, context),
    };
  }
}

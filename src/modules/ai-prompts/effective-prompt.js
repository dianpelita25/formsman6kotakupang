import { getDefaultPromptTemplate } from './templates.js';

export function mapEffectivePrompt(mode, questionnairePublished, tenantPublished, globalPublished) {
  if (questionnairePublished?.template) {
    return {
      mode,
      source: 'questionnaire',
      template: questionnairePublished.template,
      tenantId: questionnairePublished.tenantId,
      questionnaireId: questionnairePublished.questionnaireId,
      publishedAt: questionnairePublished.publishedAt,
    };
  }

  if (tenantPublished?.template) {
    return {
      mode,
      source: 'tenant',
      template: tenantPublished.template,
      tenantId: tenantPublished.tenantId,
      questionnaireId: null,
      publishedAt: tenantPublished.publishedAt,
    };
  }

  if (globalPublished?.template) {
    return {
      mode,
      source: 'global',
      template: globalPublished.template,
      tenantId: null,
      questionnaireId: null,
      publishedAt: globalPublished.publishedAt,
    };
  }

  return {
    mode,
    source: 'fallback',
    template: getDefaultPromptTemplate(mode),
    tenantId: null,
    questionnaireId: null,
    publishedAt: null,
  };
}

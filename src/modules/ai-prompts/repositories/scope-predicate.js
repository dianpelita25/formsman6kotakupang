export function buildPromptScopeFilter(target) {
  const scope = String(target?.scope || 'global').trim().toLowerCase();
  const tenantId = target?.tenantId || null;
  const questionnaireId = target?.questionnaireId || null;

  if (scope === 'global') {
    return {
      canMatch: true,
      tenantId: null,
      questionnaireId: null,
    };
  }

  if (scope === 'tenant') {
    return {
      canMatch: Boolean(tenantId),
      tenantId: tenantId || null,
      questionnaireId: null,
    };
  }

  if (scope === 'questionnaire') {
    return {
      canMatch: Boolean(tenantId && questionnaireId),
      tenantId: tenantId || null,
      questionnaireId: questionnaireId || null,
    };
  }

  return {
    canMatch: false,
    tenantId: null,
    questionnaireId: null,
  };
}

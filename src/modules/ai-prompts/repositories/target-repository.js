export function normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId }) {
  const normalizedScope = String(scope || 'global')
    .trim()
    .toLowerCase();
  if (normalizedScope === 'school') {
    return {
      scope: 'tenant',
      tenantId: schoolId || tenantId || null,
      questionnaireId: null,
    };
  }
  if (normalizedScope === 'tenant') {
    return {
      scope: 'tenant',
      tenantId: tenantId || schoolId || null,
      questionnaireId: null,
    };
  }
  if (normalizedScope === 'questionnaire') {
    return {
      scope: 'questionnaire',
      tenantId: tenantId || schoolId || null,
      questionnaireId: questionnaireId || null,
    };
  }
  return {
    scope: 'global',
    tenantId: null,
    questionnaireId: null,
  };
}

export function maxLimit(input) {
  const limit = Number(input);
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(limit, 100));
}

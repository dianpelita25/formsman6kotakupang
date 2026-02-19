import { getDefaultQuestionnaireByTenantId, getQuestionnaireByTenantAndSlug } from './service.js';

export async function findDefaultQuestionnaireByTenantId(env, tenantId) {
  return getDefaultQuestionnaireByTenantId(env, tenantId);
}

export async function findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug) {
  return getQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
}

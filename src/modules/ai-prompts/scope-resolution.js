import { getSchoolById } from '../schools/service.js';
import { getTenantById } from '../tenants/service.js';
import { getQuestionnaireByIdForTenant } from '../questionnaires/service.js';

const VALID_SCOPES = new Set(['global', 'school', 'tenant', 'questionnaire']);

export function normalizeScope(value) {
  const scope = String(value || '')
    .trim()
    .toLowerCase();
  return VALID_SCOPES.has(scope) ? scope : null;
}

export function normalizeId(value) {
  const id = String(value || '').trim();
  return id || null;
}

export function inferScope(query = {}) {
  if (normalizeId(query.questionnaireId)) return 'questionnaire';
  if (normalizeId(query.schoolId) || normalizeId(query.tenantId)) return 'tenant';
  return 'global';
}

export async function validateScopePayload(env, payload = {}) {
  const scope = normalizeScope(payload.scope || 'global');
  if (!scope) {
    return { ok: false, status: 400, message: 'Scope prompt AI tidak valid.' };
  }

  if (scope === 'global') {
    return { ok: true, scope: 'global', schoolId: null, tenantId: null, questionnaireId: null };
  }

  if (scope === 'school') {
    const schoolId = normalizeId(payload.schoolId || payload.tenantId);
    if (!schoolId) {
      return { ok: false, status: 400, message: 'schoolId wajib diisi untuk scope school.' };
    }
    const school = await getSchoolById(env, schoolId);
    if (!school) {
      return { ok: false, status: 404, message: 'Sekolah untuk override prompt tidak ditemukan.' };
    }
    return { ok: true, scope: 'tenant', schoolId: school.id, tenantId: school.id, questionnaireId: null };
  }

  if (scope === 'tenant') {
    const tenantId = normalizeId(payload.tenantId || payload.schoolId);
    if (!tenantId) {
      return { ok: false, status: 400, message: 'tenantId wajib diisi untuk scope tenant.' };
    }
    const tenant = await getTenantById(env, tenantId);
    if (!tenant) {
      return { ok: false, status: 404, message: 'Tenant untuk override prompt tidak ditemukan.' };
    }
    return { ok: true, scope: 'tenant', schoolId: tenant.id, tenantId: tenant.id, questionnaireId: null };
  }

  const tenantId = normalizeId(payload.tenantId || payload.schoolId);
  const questionnaireId = normalizeId(payload.questionnaireId);
  if (!tenantId || !questionnaireId) {
    return { ok: false, status: 400, message: 'tenantId dan questionnaireId wajib diisi untuk scope questionnaire.' };
  }

  const [tenant, questionnaire] = await Promise.all([
    getTenantById(env, tenantId),
    getQuestionnaireByIdForTenant(env, questionnaireId),
  ]);
  if (!tenant) {
    return { ok: false, status: 404, message: 'Tenant tidak ditemukan.' };
  }
  if (!questionnaire || questionnaire.tenantId !== tenant.id) {
    return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan pada tenant ini.' };
  }

  return {
    ok: true,
    scope: 'questionnaire',
    schoolId: tenant.id,
    tenantId: tenant.id,
    questionnaireId: questionnaire.id,
  };
}

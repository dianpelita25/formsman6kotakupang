import { normalizeAiMode } from '../ai/modes.js';
import { findSchoolById } from '../schools/repository.js';
import { findTenantById } from '../tenants/repository.js';
import { getQuestionnaireById } from '../questionnaires/repository.js';
import { getPromptByStatus, listPromptHistory, publishPromptDraft, savePromptDraft } from './repository.js';
import { buildPromptTemplateContext, getDefaultPromptTemplate, renderPromptTemplate, validatePromptTemplate } from './templates.js';

const VALID_SCOPES = new Set(['global', 'school', 'tenant', 'questionnaire']);

function normalizeScope(value) {
  const scope = String(value || '')
    .trim()
    .toLowerCase();
  return VALID_SCOPES.has(scope) ? scope : null;
}

function normalizeId(value) {
  const id = String(value || '').trim();
  return id || null;
}

async function validateScopePayload(env, payload = {}) {
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
    const school = await findSchoolById(env, schoolId);
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
    const tenant = await findTenantById(env, tenantId);
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
    findTenantById(env, tenantId),
    getQuestionnaireById(env, questionnaireId),
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

function mapEffectivePrompt(mode, questionnairePublished, tenantPublished, globalPublished) {
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

function inferScope(query) {
  if (normalizeId(query.questionnaireId)) return 'questionnaire';
  if (normalizeId(query.schoolId) || normalizeId(query.tenantId)) return 'tenant';
  return 'global';
}

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

export async function saveAiPromptDraft(env, actorId, payload = {}) {
  const mode = normalizeAiMode(payload.mode);
  if (!mode) {
    return { ok: false, status: 400, message: 'Mode prompt AI tidak valid.' };
  }

  const target = await validateScopePayload(env, payload);
  if (!target.ok) return target;

  const validatedTemplate = validatePromptTemplate(payload.template);
  if (!validatedTemplate.ok) {
    return { ok: false, status: 400, message: validatedTemplate.message };
  }

  const changeNote = String(payload.changeNote || '').trim().slice(0, 500);
  const draft = await savePromptDraft(env, {
    mode,
    scope: target.scope,
    schoolId: target.schoolId,
    tenantId: target.tenantId,
    questionnaireId: target.questionnaireId,
    template: validatedTemplate.data,
    changeNote,
    actorId,
  });

  return {
    ok: true,
    status: 200,
    data: draft,
  };
}

export async function publishAiPrompt(env, actorId, payload = {}) {
  const mode = normalizeAiMode(payload.mode);
  if (!mode) {
    return { ok: false, status: 400, message: 'Mode prompt AI tidak valid.' };
  }

  const target = await validateScopePayload(env, payload);
  if (!target.ok) return target;

  const changeNote = String(payload.changeNote || '').trim().slice(0, 500);
  const published = await publishPromptDraft(env, {
    mode,
    scope: target.scope,
    schoolId: target.schoolId,
    tenantId: target.tenantId,
    questionnaireId: target.questionnaireId,
    actorId,
    changeNote,
  });

  if (!published) {
    return { ok: false, status: 404, message: 'Draft prompt tidak ditemukan untuk dipublish.' };
  }

  return {
    ok: true,
    status: 200,
    data: published,
  };
}

export async function getAiPromptHistory(env, query = {}) {
  const mode = normalizeAiMode(query.mode);
  if (!mode) {
    return { ok: false, status: 400, message: 'Mode prompt AI tidak valid.' };
  }

  const target = await validateScopePayload(env, {
    scope: query.scope || inferScope(query),
    schoolId: query.schoolId,
    tenantId: query.tenantId,
    questionnaireId: query.questionnaireId,
  });
  if (!target.ok) return target;

  const history = await listPromptHistory(env, {
    mode,
    scope: target.scope,
    schoolId: target.schoolId,
    tenantId: target.tenantId,
    questionnaireId: target.questionnaireId,
    limit: query.limit,
  });

  return {
    ok: true,
    status: 200,
    data: history,
  };
}

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

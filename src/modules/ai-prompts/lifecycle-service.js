import { normalizeAiMode } from '../shared/ai-modes.js';
import { listPromptHistory, publishPromptDraft, savePromptDraft } from './repository.js';
import { inferScope, validateScopePayload } from './scope-resolution.js';
import { validatePromptTemplate } from './templates.js';

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

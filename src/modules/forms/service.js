import { normalizeDraftInput } from './schema.js';
import {
  ensureSchoolFormsInitialized,
  getDraftFormBySchoolId,
  getPublishedFormBySchoolId,
  publishDraftForm,
  saveDraftForm,
} from './repository.js';

export async function getPublishedFormSchema(env, schoolId) {
  const published = await getPublishedFormBySchoolId(env, schoolId);
  if (!published) return null;

  return {
    formVersionId: published.id,
    version: published.version,
    meta: published.meta,
    fields: [...published.coreFields, ...(published.extraFields || [])],
    coreFields: published.coreFields,
    extraFields: published.extraFields || [],
  };
}

export async function getDraftFormSchema(env, schoolId, actorId) {
  const draft = await getDraftFormBySchoolId(env, schoolId, actorId);
  if (!draft) return null;
  return {
    ...draft,
    formVersionId: draft.id,
  };
}

export async function updateDraftFormSchema(env, schoolId, actorId, payload) {
  const normalized = normalizeDraftInput(payload);
  if (!normalized.ok) return normalized;

  const draft = await getDraftFormBySchoolId(env, schoolId, actorId);
  if (!draft) {
    return {
      ok: false,
      status: 404,
      message: 'Draft form tidak ditemukan.',
    };
  }

  const saved = await saveDraftForm(env, {
    schoolId,
    draftId: draft.id,
    meta: normalized.data.meta,
    coreFields: normalized.data.coreFields,
    extraFields: normalized.data.extraFields,
    actorId,
  });

  if (!saved) {
    return {
      ok: false,
      status: 500,
      message: 'Gagal menyimpan draft form.',
    };
  }

  return {
    ok: true,
    status: 200,
    data: saved,
  };
}

export async function publishDraft(env, schoolId, actorId) {
  const published = await publishDraftForm(env, { schoolId, actorId });
  if (!published) {
    return {
      ok: false,
      status: 404,
      message: 'Draft form tidak ditemukan.',
    };
  }
  return {
    ok: true,
    status: 200,
    data: published,
  };
}

export async function ensureLegacySchoolFormVersions(env, schoolId, createdBy = null) {
  await ensureSchoolFormsInitialized(env, schoolId, createdBy);
}

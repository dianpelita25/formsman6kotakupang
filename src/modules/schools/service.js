import { createSchool, findSchoolById, findSchoolBySlug, listActiveSchoolsPublic, listSchools, updateSchool } from './repository.js';
import { ensureUserForAdminAccount, grantSchoolAdminAccess, grantTenantAdminAccess } from '../auth/service.js';
import { ensureLegacySchoolFormVersions } from '../forms/service.js';
import { ensureTenantQuestionnaireInitialized } from '../questionnaires/service.js';
import { slugify } from '../shared/text/slugify.js';
import { syncTenantFromSchool } from '../tenant-school-sync/service.js';
import { syncTenantSuperadminsForTenant } from '../tenants/service.js';

export async function resolveSchoolBySlug(env, slug, { onlyActive = false } = {}) {
  const normalizedSlug = slugify(slug);
  if (!normalizedSlug) return null;
  const school = await findSchoolBySlug(env, normalizedSlug);
  if (!school) return null;
  if (onlyActive && !school.is_active) return null;
  return school;
}

export async function listAllSchools(env) {
  return listSchools(env);
}

export async function listPublicSchools(env) {
  return listActiveSchoolsPublic(env);
}

export async function getSchoolById(env, schoolId) {
  return findSchoolById(env, schoolId);
}

export async function createNewSchool(env, payload, actorId) {
  const name = String(payload?.name || '').trim();
  const slug = slugify(payload?.slug || payload?.name);

  if (!name || !slug) {
    return {
      ok: false,
      status: 400,
      message: 'Nama dan slug sekolah wajib diisi.',
    };
  }

  try {
    const school = await createSchool(env, { name, slug, createdBy: actorId });
    await syncTenantFromSchool(env, school);
    await ensureLegacySchoolFormVersions(env, school.id, actorId);
    await syncTenantSuperadminsForTenant(env, school.id);
    await ensureTenantQuestionnaireInitialized(env, school.id, actorId);
    return { ok: true, status: 201, data: school };
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return { ok: false, status: 409, message: 'Slug sekolah sudah dipakai.' };
    }
    throw error;
  }
}

export async function patchSchool(env, schoolId, payload) {
  const next = {};
  if (payload?.name != null) {
    const name = String(payload.name).trim();
    if (!name) return { ok: false, status: 400, message: 'Nama sekolah tidak valid.' };
    next.name = name;
  }
  if (payload?.slug != null) {
    const slug = slugify(payload.slug);
    if (!slug) return { ok: false, status: 400, message: 'Slug sekolah tidak valid.' };
    next.slug = slug;
  }
  if (payload?.isActive != null) {
    next.isActive = Boolean(payload.isActive);
  }

  if (!Object.keys(next).length) {
    return { ok: false, status: 400, message: 'Tidak ada perubahan.' };
  }

  try {
    const updated = await updateSchool(env, schoolId, next);
    if (!updated) return { ok: false, status: 404, message: 'Sekolah tidak ditemukan.' };
    await syncTenantFromSchool(env, updated);
    return { ok: true, status: 200, data: updated };
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return { ok: false, status: 409, message: 'Slug sekolah sudah dipakai.' };
    }
    throw error;
  }
}

export async function createSchoolAdminAccount(env, schoolId, payload) {
  const school = await findSchoolById(env, schoolId);
  if (!school) {
    return { ok: false, status: 404, message: 'Sekolah tidak ditemukan.' };
  }

  const email = String(payload?.email || '')
    .trim()
    .toLowerCase();
  const password = String(payload?.password || '');
  if (!email || !password) {
    return { ok: false, status: 400, message: 'Email dan password wajib diisi.' };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, message: 'Password minimal 8 karakter.' };
  }

  const userResult = await ensureUserForAdminAccount(env, { email, password });
  if (!userResult.ok) {
    return userResult;
  }

  const userId = userResult.data.userId;
  await grantSchoolAdminAccess(env, userId, schoolId);
  await grantTenantAdminAccess(env, userId, schoolId);
  return {
    ok: true,
    status: 201,
    data: {
      userId,
      email,
      schoolId: school.id,
      schoolSlug: school.slug,
    },
  };
}

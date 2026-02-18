import { createSchool, findSchoolById, findSchoolBySlug, listActiveSchoolsPublic, listSchools, updateSchool } from './repository.js';
import { createUser, findUserByEmail, grantSchoolAdminRole, grantTenantAdminRole } from '../auth/repository.js';
import { hashPassword, randomSalt } from '../../lib/security/hash.js';
import { ensureTenantQuestionnaireInitialized } from '../questionnaires/service.js';
import { syncTenantSuperadmins } from '../tenants/repository.js';

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
    await syncTenantSuperadmins(env, school.id);
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

  const existing = await findUserByEmail(env, email);
  let userId = existing?.id || null;

  if (!userId) {
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    const created = await createUser(env, {
      id: crypto.randomUUID(),
      email,
      passwordHash: hash,
      passwordSalt: salt,
    });
    if (!created) {
      return { ok: false, status: 500, message: 'Gagal membuat user admin.' };
    }
    userId = created.id;
  }

  await grantSchoolAdminRole(env, userId, schoolId);
  await grantTenantAdminRole(env, userId, schoolId);
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

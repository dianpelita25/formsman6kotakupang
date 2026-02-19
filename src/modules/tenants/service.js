import { ensureUserForAdminAccount, grantTenantAdminAccess } from '../auth/service.js';
import { slugify } from '../shared/text/slugify.js';
import { syncSchoolFromTenant } from '../tenant-school-sync/service.js';
import {
  createTenant,
  findTenantById,
  findTenantBySlug,
  listActiveTenants,
  listTenants,
  syncTenantSuperadmins,
  updateTenant,
} from './repository.js';

const VALID_TENANT_TYPES = new Set(['school', 'business', 'government', 'class', 'community', 'event', 'other']);

function normalizeTenantType(value) {
  const tenantType = String(value || 'school')
    .trim()
    .toLowerCase();
  return VALID_TENANT_TYPES.has(tenantType) ? tenantType : null;
}

export async function resolveTenantBySlug(env, slug, { onlyActive = false } = {}) {
  const normalizedSlug = slugify(slug);
  if (!normalizedSlug) return null;
  const tenant = await findTenantBySlug(env, normalizedSlug);
  if (!tenant) return null;
  if (onlyActive && !tenant.is_active) return null;
  return tenant;
}

export async function listAllTenants(env) {
  return listTenants(env);
}

export async function listPublicTenants(env) {
  return listActiveTenants(env);
}

export async function getTenantById(env, tenantId) {
  return findTenantById(env, tenantId);
}

export async function syncTenantSuperadminsForTenant(env, tenantId) {
  await syncTenantSuperadmins(env, tenantId);
}

export async function createNewTenant(env, payload) {
  const name = String(payload?.name || '').trim();
  const slug = slugify(payload?.slug || payload?.name);
  const tenantType = normalizeTenantType(payload?.tenantType || 'school');

  if (!name || !slug) {
    return { ok: false, status: 400, message: 'Nama dan slug organisasi wajib diisi.' };
  }
  if (!tenantType) {
    return { ok: false, status: 400, message: 'tenantType tidak valid.' };
  }

  try {
    const created = await createTenant(env, {
      id: crypto.randomUUID(),
      name,
      slug,
      tenantType,
      isActive: true,
    });
    await syncTenantSuperadmins(env, created.id);

    await syncSchoolFromTenant(env, created);

    return { ok: true, status: 201, data: created };
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return { ok: false, status: 409, message: 'Slug organisasi sudah dipakai.' };
    }
    throw error;
  }
}

export async function patchTenantById(env, tenantId, payload) {
  const next = {};
  if (payload?.name != null) {
    const name = String(payload.name).trim();
    if (!name) return { ok: false, status: 400, message: 'Nama organisasi tidak valid.' };
    next.name = name;
  }
  if (payload?.slug != null) {
    const slug = slugify(payload.slug);
    if (!slug) return { ok: false, status: 400, message: 'Slug organisasi tidak valid.' };
    next.slug = slug;
  }
  if (payload?.tenantType != null) {
    const tenantType = normalizeTenantType(payload.tenantType);
    if (!tenantType) return { ok: false, status: 400, message: 'tenantType tidak valid.' };
    next.tenantType = tenantType;
  }
  if (payload?.isActive != null) {
    next.isActive = Boolean(payload.isActive);
  }

  if (!Object.keys(next).length) {
    return { ok: false, status: 400, message: 'Tidak ada perubahan.' };
  }

  try {
    const updated = await updateTenant(env, tenantId, next);
    if (!updated) return { ok: false, status: 404, message: 'Organisasi tidak ditemukan.' };

    await syncSchoolFromTenant(env, updated);

    return { ok: true, status: 200, data: updated };
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return { ok: false, status: 409, message: 'Slug organisasi sudah dipakai.' };
    }
    throw error;
  }
}

export async function createTenantAdminAccount(env, tenantId, payload) {
  const tenant = await findTenantById(env, tenantId);
  if (!tenant) {
    return { ok: false, status: 404, message: 'Organisasi tidak ditemukan.' };
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
    if (userResult.status === 500) {
      return { ok: false, status: 500, message: 'Gagal membuat user admin organisasi.' };
    }
    return userResult;
  }

  const userId = userResult.data.userId;
  await grantTenantAdminAccess(env, userId, tenant.id);
  return {
    ok: true,
    status: 201,
    data: {
      userId,
      email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    },
  };
}

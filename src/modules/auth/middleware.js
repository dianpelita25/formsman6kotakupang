import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME } from '../../lib/http/session-cookie.js';
import { canAccessSchool, hasSuperadmin, hasTenantAccess, resolveAuthContext } from './service.js';

export async function attachAuth(c, next) {
  const cookieValue = getCookie(c, SESSION_COOKIE_NAME);
  const auth = await resolveAuthContext(c.env, cookieValue);
  c.set('auth', auth);
  await next();
}

export function requireAuth() {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ message: 'Unauthorized' }, 401);
    }
    await next();
  };
}

export function requireSuperadmin() {
  return async (c, next) => {
    const auth = c.get('auth');
    const tenantMemberships = Array.isArray(auth?.tenantMemberships) ? auth.tenantMemberships : [];
    const hasTenantSuperadmin = tenantMemberships.some((membership) => membership.role === 'superadmin');
    if (!auth || (!hasSuperadmin(auth.memberships) && !hasTenantSuperadmin)) {
      return c.json({ message: 'Forbidden' }, 403);
    }
    await next();
  };
}

export function requireSchoolAccessFromParam(paramName = 'schoolSlug') {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const school = c.get('school');
    if (!school) {
      return c.json({ message: `Sekolah ${paramName} tidak ditemukan.` }, 404);
    }

    if (!canAccessSchool(auth.memberships, school.id)) {
      return c.json({ message: 'Forbidden' }, 403);
    }

    await next();
  };
}

export function requireTenantAccessFromParam(paramName = 'tenantSlug', allowedRoles = ['tenant_admin', 'analyst']) {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const tenant = c.get('tenant');
    if (!tenant) {
      return c.json({ message: `Tenant ${paramName} tidak ditemukan.` }, 404);
    }

    if (hasSuperadmin(auth.memberships)) {
      await next();
      return;
    }

    const tenantType = String(tenant.tenant_type || tenant.tenantType || '')
      .trim()
      .toLowerCase();
    if (tenantType === 'school' && canAccessSchool(auth.memberships, tenant.id)) {
      await next();
      return;
    }

    const tenantMemberships = Array.isArray(auth.tenantMemberships) ? auth.tenantMemberships : [];
    if (!hasTenantAccess(tenantMemberships, tenant.id, allowedRoles)) {
      return c.json({ message: 'Forbidden' }, 403);
    }

    await next();
  };
}

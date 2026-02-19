export function resolveRequestId(c) {
  return String(c.get('requestId') || '').trim() || 'unknown';
}

export function jsonError(c, status, message, extra = {}) {
  return c.json(
    {
      message,
      requestId: resolveRequestId(c),
      ...extra,
    },
    status
  );
}

export async function servePublicAsset(c, internalPath) {
  const assets = c.env.ASSETS;
  if (!assets?.fetch) {
    return jsonError(c, 500, 'Assets binding belum terpasang.');
  }
  let target = new URL(internalPath, c.req.url);
  let response = await assets.fetch(new Request(target.toString(), c.req.raw));

  for (let index = 0; index < 5; index += 1) {
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    const location = response.headers.get('location');
    if (!location) {
      return response;
    }
    target = new URL(location, target);
    response = await assets.fetch(new Request(target.toString(), c.req.raw));
  }

  return response;
}

function parseBooleanFlag(input, fallback = false) {
  if (typeof input !== 'string') return fallback;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function isLegacyAdminAliasEnabled(env) {
  const appEnv = String(env?.APP_ENV || 'local').trim().toLowerCase();
  const defaultValue = appEnv !== 'production';
  return parseBooleanFlag(env?.ENABLE_LEGACY_ADMIN_ALIAS, defaultValue);
}

export function createSchoolMiddleware({ resolveSchoolBySlug }) {
  return async function schoolMiddleware(c, next) {
    const slug = c.req.param('schoolSlug');
    const school = await resolveSchoolBySlug(c.env, slug, { onlyActive: false });
    if (!school) {
      return jsonError(c, 404, 'Sekolah tidak ditemukan.');
    }
    c.set('school', school);
    await next();
  };
}

export function createTenantMiddleware({ resolveTenantBySlug }) {
  return async function tenantMiddleware(c, next) {
    const slug = c.req.param('tenantSlug');
    const tenant = await resolveTenantBySlug(c.env, slug, { onlyActive: false });
    if (!tenant) {
      return jsonError(c, 404, 'Organisasi tidak ditemukan.');
    }
    c.set('tenant', tenant);
    await next();
  };
}

export function createRequireDbReady({ ensurePlatformSchema }) {
  return async function requireDbReady(c, next) {
    try {
      await ensurePlatformSchema(c.env);
      await next();
    } catch (error) {
      return jsonError(c, 503, error?.message || 'Database belum siap.');
    }
  };
}

export function createRequireAdminPageAccess({
  canAccessSchool,
  hasSuperadmin,
  hasTenantAccess,
}) {
  return function requireAdminPageAccess(c) {
    const auth = c.get('auth');
    if (!auth) {
      const redirect = encodeURIComponent(c.req.path);
      return c.redirect(`/forms/admin/login?redirect=${redirect}`, 302);
    }

    const school = c.get('school');
    if (school && canAccessSchool(auth.memberships, school.id)) {
      return null;
    }

    const tenant = c.get('tenant');
    if (tenant) {
      if (hasSuperadmin(auth.memberships)) {
        return null;
      }

      const tenantMemberships = Array.isArray(auth.tenantMemberships) ? auth.tenantMemberships : [];
      if (hasTenantAccess(tenantMemberships, tenant.id, ['tenant_admin', 'analyst'])) {
        return null;
      }

      const tenantType = String(tenant.tenant_type || tenant.tenantType || '')
        .trim()
        .toLowerCase();
      if (tenantType === 'school' && canAccessSchool(auth.memberships, tenant.id)) {
        return null;
      }
    }

    return jsonError(c, 403, 'Forbidden');
  };
}

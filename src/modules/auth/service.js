import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  findUserByEmail,
  getSessionByTokenHash,
  getUserMemberships,
  getUserTenantMemberships,
  insertSession,
  revokeSessionByTokenHash,
} from './repository.js';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../../lib/http/session-cookie.js';
import { randomToken, sha256Hex, verifyPassword } from '../../lib/security/hash.js';
import { buildSignedToken, getSessionSecret, splitSignedToken, verifySignedToken } from '../../lib/security/signature.js';

export function mapMemberships(rows) {
  return rows.map((row) => ({
    role: row.role,
    schoolId: row.school_id || null,
    schoolSlug: row.school_slug || null,
    schoolName: row.school_name || null,
    schoolActive: row.school_is_active ?? null,
  }));
}

export function mapTenantMemberships(rows) {
  return rows.map((row) => ({
    role: row.role,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    tenantType: row.tenant_type,
    tenantActive: row.tenant_is_active ?? null,
  }));
}

export function hasSuperadmin(memberships) {
  return memberships.some((membership) => membership.role === 'superadmin');
}

export function canAccessSchool(memberships, schoolId) {
  if (hasSuperadmin(memberships)) return true;
  return memberships.some((membership) => membership.role === 'school_admin' && membership.schoolId === schoolId);
}

export function hasTenantAccess(tenantMemberships, tenantId, allowedRoles = ['tenant_admin', 'analyst']) {
  return tenantMemberships.some(
    (membership) =>
      membership.tenantId === tenantId &&
      (membership.role === 'superadmin' || allowedRoles.includes(membership.role))
  );
}

export async function loginWithEmailPassword(c) {
  const env = c.env;
  let sessionSecret;
  try {
    sessionSecret = getSessionSecret(env);
  } catch (error) {
    console.error(error?.message || error);
    return { ok: false, status: 500, message: 'Konfigurasi session belum siap.' };
  }

  const payload = await c.req.json().catch(() => null);
  const email = String(payload?.email || '')
    .trim()
    .toLowerCase();
  const password = String(payload?.password || '');

  if (!email || !password) {
    return { ok: false, status: 400, message: 'Email dan password wajib diisi.' };
  }

  const user = await findUserByEmail(env, email);
  if (!user || !user.is_active) {
    return { ok: false, status: 401, message: 'Email atau password salah.' };
  }

  const passwordValid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!passwordValid) {
    return { ok: false, status: 401, message: 'Email atau password salah.' };
  }

  const [membershipsRows, tenantMembershipRows] = await Promise.all([
    getUserMemberships(env, user.id),
    getUserTenantMemberships(env, user.id),
  ]);

  const memberships = mapMemberships(membershipsRows);
  const tenantMemberships = mapTenantMemberships(tenantMembershipRows);
  if (!memberships.length && !tenantMemberships.length) {
    return { ok: false, status: 403, message: 'Akun tidak memiliki akses.' };
  }

  const rawToken = randomToken(32);
  const signedToken = await buildSignedToken(rawToken, sessionSecret);
  const tokenHash = await sha256Hex(rawToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await insertSession(env, {
    id: sessionId,
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  setCookie(c, SESSION_COOKIE_NAME, signedToken, buildSessionCookieOptions(c.req.url));

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
    memberships,
    tenantMemberships,
  };
}

export async function resolveAuthContext(c) {
  const cookieValue = getCookie(c, SESSION_COOKIE_NAME);
  if (!cookieValue) return null;

  let sessionSecret;
  try {
    sessionSecret = getSessionSecret(c.env);
  } catch {
    return null;
  }

  const parsed = splitSignedToken(cookieValue);
  if (!parsed) {
    const legacyTokenHash = await sha256Hex(cookieValue);
    await revokeSessionByTokenHash(c.env, legacyTokenHash);
    return null;
  }

  const signatureValid = await verifySignedToken(parsed.token, parsed.signature, sessionSecret);
  if (!signatureValid) {
    const invalidTokenHash = await sha256Hex(parsed.token);
    await revokeSessionByTokenHash(c.env, invalidTokenHash);
    return null;
  }

  const tokenHash = await sha256Hex(parsed.token);
  const session = await getSessionByTokenHash(c.env, tokenHash);
  if (!session) return null;

  const expired = new Date(session.expires_at).getTime() <= Date.now();
  if (session.revoked_at || expired || !session.is_active) {
    await revokeSessionByTokenHash(c.env, tokenHash);
    return null;
  }

  const [membershipsRows, tenantMembershipRows] = await Promise.all([
    getUserMemberships(c.env, session.user_id),
    getUserTenantMemberships(c.env, session.user_id),
  ]);
  const memberships = mapMemberships(membershipsRows);
  const tenantMemberships = mapTenantMemberships(tenantMembershipRows);

  if (!memberships.length && !tenantMemberships.length) {
    return null;
  }

  return {
    userId: session.user_id,
    email: session.email,
    memberships,
    tenantMemberships,
  };
}

export async function logout(c) {
  const cookieValue = getCookie(c, SESSION_COOKIE_NAME);
  const cookieOptions = buildSessionCookieOptions(c.req.url);
  const parsed = splitSignedToken(cookieValue || '');
  const tokenForHash = parsed?.token || cookieValue;
  if (tokenForHash) {
    const tokenHash = await sha256Hex(tokenForHash);
    await revokeSessionByTokenHash(c.env, tokenHash);
  }
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: cookieOptions.secure,
    sameSite: 'Lax',
  });
}

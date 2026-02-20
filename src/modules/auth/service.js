import {
  createUser,
  findUserByEmail,
  grantSchoolAdminRole,
  grantTenantAdminRole,
  getSessionByTokenHash,
  getUserMemberships,
  getUserTenantMemberships,
  insertSession,
  revokeSessionByTokenHash,
} from './repository.js';
import { SESSION_TTL_SECONDS } from '../../lib/http/session-cookie.js';
import { randomToken, sha256Hex } from '../../lib/security/hash.js';
import { buildSignedToken, getSessionSecret, splitSignedToken, verifySignedToken } from '../../lib/security/signature.js';
import { mapMemberships, mapTenantMemberships } from './membership-utils.js';
import { buildPasswordCredential, verifyAndMaybeUpgradePassword } from './password-upgrade.js';
export { canAccessSchool, hasSuperadmin, hasTenantAccess, mapMemberships, mapTenantMemberships } from './membership-utils.js';

export async function loginWithEmailPassword(env, payload) {
  let sessionSecret;
  try {
    sessionSecret = getSessionSecret(env);
  } catch (error) {
    console.error(error?.message || error);
    return { ok: false, status: 500, message: 'Konfigurasi session belum siap.' };
  }

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

  const passwordCheck = await verifyAndMaybeUpgradePassword(env, user, password, email);
  if (!passwordCheck.ok) {
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

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
    memberships,
    tenantMemberships,
    sessionToken: signedToken,
  };
}

export async function resolveAuthContext(env, cookieValue) {
  if (!cookieValue) return null;

  let sessionSecret;
  try {
    sessionSecret = getSessionSecret(env);
  } catch {
    return null;
  }

  const parsed = splitSignedToken(cookieValue);
  if (!parsed) {
    const legacyTokenHash = await sha256Hex(cookieValue);
    await revokeSessionByTokenHash(env, legacyTokenHash);
    return null;
  }

  const signatureValid = await verifySignedToken(parsed.token, parsed.signature, sessionSecret);
  if (!signatureValid) {
    const invalidTokenHash = await sha256Hex(parsed.token);
    await revokeSessionByTokenHash(env, invalidTokenHash);
    return null;
  }

  const tokenHash = await sha256Hex(parsed.token);
  const session = await getSessionByTokenHash(env, tokenHash);
  if (!session) return null;

  const expired = new Date(session.expires_at).getTime() <= Date.now();
  if (session.revoked_at || expired || !session.is_active) {
    await revokeSessionByTokenHash(env, tokenHash);
    return null;
  }

  const [membershipsRows, tenantMembershipRows] = await Promise.all([
    getUserMemberships(env, session.user_id),
    getUserTenantMemberships(env, session.user_id),
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

export async function logout(env, cookieValue) {
  const parsed = splitSignedToken(cookieValue || '');
  const tokenForHash = parsed?.token || cookieValue;
  if (tokenForHash) {
    const tokenHash = await sha256Hex(tokenForHash);
    await revokeSessionByTokenHash(env, tokenHash);
  }
}

export async function ensureUserForAdminAccount(env, { email, password }) {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const rawPassword = String(password || '');
  if (!normalizedEmail || !rawPassword) {
    return {
      ok: false,
      status: 400,
      message: 'Email dan password wajib diisi.',
    };
  }

  const existing = await findUserByEmail(env, normalizedEmail);
  if (existing?.id) {
    return {
      ok: true,
      data: {
        userId: existing.id,
        email: normalizedEmail,
      },
    };
  }

  const credential = await buildPasswordCredential(env, rawPassword);
  const created = await createUser(env, {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    ...credential,
  });

  if (!created?.id) {
    return {
      ok: false,
      status: 500,
      message: 'Gagal membuat user admin.',
    };
  }

  return {
    ok: true,
    data: {
      userId: created.id,
      email: normalizedEmail,
    },
  };
}

export async function grantTenantAdminAccess(env, userId, tenantId) {
  await grantTenantAdminRole(env, userId, tenantId);
}

export async function grantSchoolAdminAccess(env, userId, schoolId) {
  await grantSchoolAdminRole(env, userId, schoolId);
}

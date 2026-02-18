import { getSqlClient } from '../../lib/db/sql.js';

export async function findUserByEmail(env, email) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, email, password_hash, password_salt, is_active
    FROM users
    WHERE email = ${email}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function findUserById(env, userId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, email, is_active
    FROM users
    WHERE id = ${userId}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function getUserMemberships(env, userId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      m.role,
      m.school_id,
      s.slug AS school_slug,
      s.name AS school_name,
      s.is_active AS school_is_active
    FROM school_memberships m
    LEFT JOIN schools s ON s.id = m.school_id
    WHERE m.user_id = ${userId};
  `;
}

export async function getUserTenantMemberships(env, userId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      tm.role,
      tm.tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      t.tenant_type,
      t.is_active AS tenant_is_active
    FROM tenant_memberships tm
    JOIN tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = ${userId};
  `;
}

export async function insertSession(env, { id, userId, tokenHash, expiresAt }) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${id}, ${userId}, ${tokenHash}, ${expiresAt});
  `;
}

export async function getSessionByTokenHash(env, tokenHash) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      s.id,
      s.user_id,
      s.expires_at,
      s.revoked_at,
      u.email,
      u.is_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function revokeSessionByTokenHash(env, tokenHash) {
  const sql = getSqlClient(env);
  await sql`
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL;
  `;
}

export async function createUser(env, { id, email, passwordHash, passwordSalt, isActive = true }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO users (id, email, password_hash, password_salt, is_active)
    VALUES (${id}, ${email}, ${passwordHash}, ${passwordSalt}, ${isActive})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, is_active;
  `;
  return rows[0] || null;
}

export async function updateUserPassword(env, { userId, passwordHash, passwordSalt }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE users
    SET
      password_hash = ${passwordHash},
      password_salt = ${passwordSalt},
      is_active = TRUE
    WHERE id = ${userId}
    RETURNING id, email, is_active;
  `;
  return rows[0] || null;
}

export async function grantSuperadminRole(env, userId) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO school_memberships (user_id, school_id, role)
    VALUES (${userId}, NULL, 'superadmin')
    ON CONFLICT DO NOTHING;
  `;
}

export async function grantSchoolAdminRole(env, userId, schoolId) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO school_memberships (user_id, school_id, role)
    VALUES (${userId}, ${schoolId}, 'school_admin')
    ON CONFLICT (user_id, school_id, role) DO NOTHING;
  `;
}

export async function grantTenantAdminRole(env, userId, tenantId) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role)
    VALUES (${userId}, ${tenantId}, 'tenant_admin')
    ON CONFLICT DO NOTHING;
  `;
}

export async function grantTenantSuperadminRole(env, userId, tenantId) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role)
    VALUES (${userId}, ${tenantId}, 'superadmin')
    ON CONFLICT DO NOTHING;
  `;
}

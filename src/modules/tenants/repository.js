import { getSqlClient } from '../../lib/db/sql.js';

export async function findTenantBySlug(env, slug) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, slug, name, tenant_type, is_active, created_at
    FROM tenants
    WHERE slug = ${slug}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function findTenantById(env, tenantId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, slug, name, tenant_type, is_active, created_at
    FROM tenants
    WHERE id = ${tenantId}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function listTenants(env) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      t.id,
      t.slug,
      t.name,
      t.tenant_type,
      t.is_active,
      t.created_at,
      MAX(CASE WHEN q.is_default THEN q.slug ELSE NULL END) AS default_questionnaire_slug,
      MAX(CASE WHEN q.is_default THEN q.name ELSE NULL END) AS default_questionnaire_name,
      COUNT(DISTINCT q.id)::int AS total_questionnaires,
      COUNT(rv2.id)::int AS total_responses
    FROM tenants t
    LEFT JOIN questionnaires q ON q.tenant_id = t.id
    LEFT JOIN responses_v2 rv2 ON rv2.tenant_id = t.id
    GROUP BY t.id, t.slug, t.name, t.tenant_type, t.is_active, t.created_at
    ORDER BY t.created_at DESC;
  `;
}

export async function listActiveTenants(env) {
  const sql = getSqlClient(env);
  return sql`
    SELECT id, slug, name, tenant_type
    FROM tenants
    WHERE is_active = TRUE
    ORDER BY name ASC;
  `;
}

export async function createTenant(env, { id, slug, name, tenantType, isActive = true }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO tenants (id, slug, name, tenant_type, is_active)
    VALUES (${id}, ${slug}, ${name}, ${tenantType}, ${isActive})
    RETURNING id, slug, name, tenant_type, is_active, created_at;
  `;
  return rows[0] || null;
}

export async function updateTenant(env, tenantId, payload) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE tenants
    SET
      slug = COALESCE(${payload.slug}, slug),
      name = COALESCE(${payload.name}, name),
      tenant_type = COALESCE(${payload.tenantType}, tenant_type),
      is_active = COALESCE(${payload.isActive}, is_active)
    WHERE id = ${tenantId}
    RETURNING id, slug, name, tenant_type, is_active, created_at;
  `;
  return rows[0] || null;
}

export async function countTenantMembershipByRole(env, tenantId, role) {
  const sql = getSqlClient(env);
  const [row] = await sql`
    SELECT COUNT(*)::int AS total
    FROM tenant_memberships
    WHERE tenant_id = ${tenantId}
      AND role = ${role};
  `;
  return Number(row?.total || 0);
}

export async function syncTenantSuperadmins(env, tenantId) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role)
    SELECT sm.user_id, ${tenantId}, 'superadmin'
    FROM school_memberships sm
    WHERE sm.role = 'superadmin'
    ON CONFLICT DO NOTHING;
  `;

  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role)
    SELECT tm.user_id, ${tenantId}, 'superadmin'
    FROM tenant_memberships tm
    WHERE tm.role = 'superadmin'
    ON CONFLICT DO NOTHING;
  `;
}

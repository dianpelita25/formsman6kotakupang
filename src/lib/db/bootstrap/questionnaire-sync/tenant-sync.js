import { DEFAULT_TENANT_TYPE } from '../constants.js';

export async function syncTenantsFromSchools(sql) {
  await sql`
    INSERT INTO tenants (id, slug, name, tenant_type, is_active, created_at)
    SELECT
      s.id,
      s.slug,
      s.name,
      ${DEFAULT_TENANT_TYPE},
      s.is_active,
      s.created_at
    FROM schools s
    ON CONFLICT (id) DO UPDATE
    SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      tenant_type = EXCLUDED.tenant_type,
      is_active = EXCLUDED.is_active;
  `;
}

export async function syncTenantMembershipsFromSchoolMemberships(sql) {
  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role, created_at)
    SELECT
      sm.user_id,
      sm.school_id,
      'tenant_admin',
      sm.created_at
    FROM school_memberships sm
    WHERE sm.role = 'school_admin'
      AND sm.school_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = sm.school_id)
    ON CONFLICT DO NOTHING;
  `;

  await sql`
    INSERT INTO tenant_memberships (user_id, tenant_id, role, created_at)
    SELECT
      sm.user_id,
      t.id,
      'superadmin',
      sm.created_at
    FROM school_memberships sm
    CROSS JOIN tenants t
    WHERE sm.role = 'superadmin'
    ON CONFLICT DO NOTHING;
  `;
}

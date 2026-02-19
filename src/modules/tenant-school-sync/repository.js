import { getSqlClient } from '../../lib/db/sql.js';

export async function upsertTenantFromSchoolRow(env, school) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO tenants (id, slug, name, tenant_type, is_active)
    VALUES (${school.id}, ${school.slug}, ${school.name}, 'school', ${school.is_active})
    ON CONFLICT (id) DO UPDATE
    SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      tenant_type = 'school',
      is_active = EXCLUDED.is_active;
  `;
}

export async function upsertSchoolFromTenantRow(env, tenant) {
  const sql = getSqlClient(env);
  await sql`
    INSERT INTO schools (id, slug, name, is_active)
    VALUES (${tenant.id}, ${tenant.slug}, ${tenant.name}, ${tenant.is_active})
    ON CONFLICT (id) DO UPDATE
    SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      is_active = EXCLUDED.is_active;
  `;
}

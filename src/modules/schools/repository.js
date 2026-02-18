import { getSqlClient } from '../../lib/db/sql.js';
import { ensureDraftVersion, ensurePublishedVersion } from '../../lib/db/bootstrap.js';

export async function findSchoolBySlug(env, slug) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, slug, name, is_active, created_at
    FROM schools
    WHERE slug = ${slug}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function findSchoolById(env, id) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, slug, name, is_active, created_at
    FROM schools
    WHERE id = ${id}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function listSchools(env) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      s.id,
      s.slug,
      s.name,
      s.is_active,
      s.created_at,
      COUNT(r.id)::int AS total_responses
    FROM schools s
    LEFT JOIN responses r ON r.school_id = s.id
    GROUP BY s.id, s.slug, s.name, s.is_active, s.created_at
    ORDER BY s.created_at DESC;
  `;
}

export async function listActiveSchoolsPublic(env) {
  const sql = getSqlClient(env);
  return sql`
    SELECT id, slug, name
    FROM schools
    WHERE is_active = TRUE
    ORDER BY name ASC;
  `;
}

export async function createSchool(env, { slug, name, createdBy }) {
  const sql = getSqlClient(env);
  const schoolId = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO schools (id, slug, name, is_active)
    VALUES (${schoolId}, ${slug}, ${name}, TRUE)
    RETURNING id, slug, name, is_active, created_at;
  `;
  const school = rows[0];
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
  await ensurePublishedVersion(sql, school.id, createdBy);
  await ensureDraftVersion(sql, school.id, createdBy);
  return school;
}

export async function updateSchool(env, schoolId, payload) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE schools
    SET
      name = COALESCE(${payload.name}, name),
      slug = COALESCE(${payload.slug}, slug),
      is_active = COALESCE(${payload.isActive}, is_active)
    WHERE id = ${schoolId}
    RETURNING id, slug, name, is_active, created_at;
  `;
  const updated = rows[0] || null;
  if (updated) {
    await sql`
      INSERT INTO tenants (id, slug, name, tenant_type, is_active)
      VALUES (${updated.id}, ${updated.slug}, ${updated.name}, 'school', ${updated.is_active})
      ON CONFLICT (id) DO UPDATE
      SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        tenant_type = 'school',
        is_active = EXCLUDED.is_active;
    `;
  }
  return updated;
}

import { getSqlClient } from '../../lib/db/sql.js';

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

export async function createSchool(env, { slug, name }) {
  const sql = getSqlClient(env);
  const schoolId = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO schools (id, slug, name, is_active)
    VALUES (${schoolId}, ${slug}, ${name}, TRUE)
    RETURNING id, slug, name, is_active, created_at;
  `;
  return rows[0] || null;
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
  return rows[0] || null;
}

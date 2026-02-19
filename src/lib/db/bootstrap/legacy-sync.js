import {
  ensureDraftVersion as ensureDraftFormVersion,
  ensurePublishedVersion as ensurePublishedFormVersion,
} from '../../../modules/forms/repository-version-lifecycle.js';
import { LEGACY_SCHOOL_SLUG } from './constants.js';
import { parseJson } from './json-utils.js';

export async function ensureLegacySchool(sql) {
  const existingRows = await sql`
    SELECT id, slug, name, is_active
    FROM schools
    WHERE slug = ${LEGACY_SCHOOL_SLUG}
    LIMIT 1;
  `;

  if (existingRows.length) {
    return existingRows[0];
  }

  const id = crypto.randomUUID();
  const [inserted] = await sql`
    INSERT INTO schools (id, slug, name, is_active)
    VALUES (${id}, ${LEGACY_SCHOOL_SLUG}, ${'SMAN 6 Kota Kupang'}, TRUE)
    RETURNING id, slug, name, is_active;
  `;
  return inserted;
}

export async function ensurePublishedVersion(sql, schoolId, createdBy) {
  return ensurePublishedFormVersion(sql, schoolId, createdBy);
}

export async function ensureDraftVersion(sql, schoolId, createdBy) {
  return ensureDraftFormVersion(sql, schoolId, createdBy);
}

export async function migrateLegacyResponses(sql, schoolId, formVersionId) {
  const [legacyTable] = await sql`
    SELECT to_regclass('public.form_responses')::text AS table_name;
  `;

  if (!legacyTable?.table_name) return;

  await sql`
    INSERT INTO responses (
      legacy_response_id,
      school_id,
      form_version_id,
      nama_guru,
      lama_mengajar,
      mata_pelajaran,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12,
      extra_answers,
      payload,
      created_at
    )
    SELECT
      fr.id,
      ${schoolId},
      ${formVersionId},
      fr.nama_guru,
      fr.lama_mengajar,
      fr.mata_pelajaran,
      fr.q1, fr.q2, fr.q3, fr.q4, fr.q5, fr.q6, fr.q7, fr.q8, fr.q9, fr.q10, fr.q11, fr.q12,
      '{}'::jsonb,
      COALESCE(fr.payload, '{}'::jsonb),
      fr.created_at
    FROM form_responses fr
    WHERE NOT EXISTS (
      SELECT 1
      FROM responses r
      WHERE r.legacy_response_id = fr.id
    );
  `;
}

export async function migrateLegacyAiRows(sql, schoolId, formVersionId) {
  const [aiTable] = await sql`
    SELECT to_regclass('public.ai_analysis')::text AS table_name;
  `;
  if (!aiTable?.table_name) return;

  await sql`
    UPDATE ai_analysis
    SET
      school_id = ${schoolId},
      form_version_id = COALESCE(form_version_id, ${formVersionId})
    WHERE school_id IS NULL;
  `;
}

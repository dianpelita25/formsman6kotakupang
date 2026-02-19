export async function dedupeSuperadminMemberships(sql) {
  await sql`
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY created_at ASC, ctid ASC
        ) AS rn
      FROM school_memberships
      WHERE role = 'superadmin'
    )
    DELETE FROM school_memberships sm
    USING ranked r
    WHERE sm.ctid = r.ctid
      AND r.rn > 1;
  `;
}

export async function normalizeFormVersionStatuses(sql) {
  await sql`
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY school_id, status
          ORDER BY version DESC, created_at DESC, ctid DESC
        ) AS rn
      FROM form_versions
      WHERE status IN ('published', 'draft')
    )
    UPDATE form_versions fv
    SET
      status = 'archived',
      updated_at = NOW()
    FROM ranked r
    WHERE fv.ctid = r.ctid
      AND r.rn > 1;
  `;
}

export async function normalizeQuestionnaireVersionStatuses(sql) {
  await sql`
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY questionnaire_id, status
          ORDER BY version DESC, created_at DESC, ctid DESC
        ) AS rn
      FROM questionnaire_versions
      WHERE status IN ('published', 'draft')
    )
    UPDATE questionnaire_versions qv
    SET
      status = 'archived',
      updated_at = NOW()
    FROM ranked r
    WHERE qv.ctid = r.ctid
      AND r.rn > 1;
  `;
}

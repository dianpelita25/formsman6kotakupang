import { getSqlClient } from '../../lib/db/sql.js';

function mapPromptRow(row) {
  if (!row) return null;
  const tenantId = row.tenant_id || null;
  const questionnaireId = row.questionnaire_id || null;
  return {
    id: row.id,
    mode: row.mode,
    scope: row.scope,
    schoolId: tenantId,
    tenantId,
    questionnaireId,
    status: row.status,
    template: row.template,
    changeNote: row.change_note || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    publishedAt: row.published_at || null,
  };
}

function normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId }) {
  const normalizedScope = String(scope || 'global')
    .trim()
    .toLowerCase();
  if (normalizedScope === 'school') {
    return {
      scope: 'tenant',
      tenantId: schoolId || tenantId || null,
      questionnaireId: null,
    };
  }
  if (normalizedScope === 'tenant') {
    return {
      scope: 'tenant',
      tenantId: tenantId || schoolId || null,
      questionnaireId: null,
    };
  }
  if (normalizedScope === 'questionnaire') {
    return {
      scope: 'questionnaire',
      tenantId: tenantId || schoolId || null,
      questionnaireId: questionnaireId || null,
    };
  }
  return {
    scope: 'global',
    tenantId: null,
    questionnaireId: null,
  };
}

function maxLimit(input) {
  const limit = Number(input);
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(limit, 100));
}

export async function getPromptByStatus(env, { mode, scope, schoolId, tenantId, questionnaireId, status }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });

  const rows = await sql`
    SELECT
      id,
      mode,
      scope,
      tenant_id,
      questionnaire_id,
      status,
      template,
      change_note,
      created_by,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at
    FROM ai_prompt_versions_v2
    WHERE mode = ${mode}
      AND scope = ${target.scope}
      AND (
        (${target.scope} = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
        OR (${target.scope} = 'tenant' AND tenant_id = ${target.tenantId} AND questionnaire_id IS NULL)
        OR (${target.scope} = 'questionnaire' AND tenant_id = ${target.tenantId} AND questionnaire_id = ${target.questionnaireId})
      )
      AND status = ${status}
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return mapPromptRow(rows[0]);
}

export async function listPromptHistory(env, { mode, scope, schoolId, tenantId, questionnaireId, limit = 20 }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });

  const rows = await sql`
    SELECT
      id,
      mode,
      scope,
      tenant_id,
      questionnaire_id,
      status,
      template,
      change_note,
      created_by,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at
    FROM ai_prompt_versions_v2
    WHERE mode = ${mode}
      AND scope = ${target.scope}
      AND (
        (${target.scope} = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
        OR (${target.scope} = 'tenant' AND tenant_id = ${target.tenantId} AND questionnaire_id IS NULL)
        OR (${target.scope} = 'questionnaire' AND tenant_id = ${target.tenantId} AND questionnaire_id = ${target.questionnaireId})
      )
    ORDER BY created_at DESC
    LIMIT ${maxLimit(limit)};
  `;

  return rows.map(mapPromptRow);
}

async function createPromptDraft(env, { mode, scope, schoolId, tenantId, questionnaireId, template, changeNote, actorId }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });

  const rows = await sql`
    INSERT INTO ai_prompt_versions_v2 (
      id,
      mode,
      scope,
      tenant_id,
      questionnaire_id,
      status,
      template,
      change_note,
      created_by
    )
    VALUES (
      ${crypto.randomUUID()},
      ${mode},
      ${target.scope},
      ${target.tenantId},
      ${target.questionnaireId},
      'draft',
      ${template},
      ${changeNote || ''},
      ${actorId}
    )
    ON CONFLICT DO NOTHING
    RETURNING
      id,
      mode,
      scope,
      tenant_id,
      questionnaire_id,
      status,
      template,
      change_note,
      created_by,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at;
  `;

  return mapPromptRow(rows[0]);
}

export async function savePromptDraft(env, { mode, scope, schoolId, tenantId, questionnaireId, template, changeNote, actorId }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });

  const rows = await sql`
    UPDATE ai_prompt_versions_v2
    SET
      template = ${template},
      change_note = ${changeNote || ''},
      created_by = ${actorId}
    WHERE mode = ${mode}
      AND scope = ${target.scope}
      AND (
        (${target.scope} = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
        OR (${target.scope} = 'tenant' AND tenant_id = ${target.tenantId} AND questionnaire_id IS NULL)
        OR (${target.scope} = 'questionnaire' AND tenant_id = ${target.tenantId} AND questionnaire_id = ${target.questionnaireId})
      )
      AND status = 'draft'
    RETURNING
      id,
      mode,
      scope,
      tenant_id,
      questionnaire_id,
      status,
      template,
      change_note,
      created_by,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at;
  `;

  if (rows[0]) {
    return mapPromptRow(rows[0]);
  }

  const inserted = await createPromptDraft(env, {
    mode,
    scope,
    schoolId,
    tenantId,
    questionnaireId,
    template,
    changeNote,
    actorId,
  });
  if (inserted) return inserted;

  const fallbackRows = await sql`
    SELECT
      id,
      mode,
      scope,
      tenant_id,
      questionnaire_id,
      status,
      template,
      change_note,
      created_by,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at
    FROM ai_prompt_versions_v2
    WHERE mode = ${mode}
      AND scope = ${target.scope}
      AND (
        (${target.scope} = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
        OR (${target.scope} = 'tenant' AND tenant_id = ${target.tenantId} AND questionnaire_id IS NULL)
        OR (${target.scope} = 'questionnaire' AND tenant_id = ${target.tenantId} AND questionnaire_id = ${target.questionnaireId})
      )
      AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return mapPromptRow(fallbackRows[0]);
}

export async function publishPromptDraft(env, { mode, scope, schoolId, tenantId, questionnaireId, actorId, changeNote }) {
  const sql = getSqlClient(env);
  const target = normalizeScopeAndTarget({ scope, schoolId, tenantId, questionnaireId });

  const rows = await sql`
    WITH selected_draft AS (
      SELECT id, mode, scope, tenant_id, questionnaire_id, template, change_note
      FROM ai_prompt_versions_v2
      WHERE mode = ${mode}
        AND scope = ${target.scope}
        AND (
          (${target.scope} = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
          OR (${target.scope} = 'tenant' AND tenant_id = ${target.tenantId} AND questionnaire_id IS NULL)
          OR (${target.scope} = 'questionnaire' AND tenant_id = ${target.tenantId} AND questionnaire_id = ${target.questionnaireId})
        )
        AND status = 'draft'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    ),
    archived AS (
      UPDATE ai_prompt_versions_v2
      SET status = 'archived'
      WHERE mode = ${mode}
        AND scope = ${target.scope}
        AND (
          (${target.scope} = 'global' AND tenant_id IS NULL AND questionnaire_id IS NULL)
          OR (${target.scope} = 'tenant' AND tenant_id = ${target.tenantId} AND questionnaire_id IS NULL)
          OR (${target.scope} = 'questionnaire' AND tenant_id = ${target.tenantId} AND questionnaire_id = ${target.questionnaireId})
        )
        AND status = 'published'
      RETURNING id
    ),
    published AS (
      UPDATE ai_prompt_versions_v2
      SET
        status = 'published',
        published_at = NOW(),
        change_note = COALESCE(${changeNote || ''}, change_note),
        created_by = ${actorId}
      WHERE id = (SELECT id FROM selected_draft)
        AND (SELECT COUNT(*) FROM archived) >= 0
      RETURNING
        id,
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        status,
        template,
        change_note,
        created_by,
        TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        TO_CHAR(published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at
    ),
    next_draft AS (
      INSERT INTO ai_prompt_versions_v2 (
        id,
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        status,
        template,
        change_note,
        created_by
      )
      SELECT
        ${crypto.randomUUID()},
        mode,
        scope,
        tenant_id,
        questionnaire_id,
        'draft',
        template,
        '',
        ${actorId}
      FROM published
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    SELECT * FROM published;
  `;

  return mapPromptRow(rows[0]);
}

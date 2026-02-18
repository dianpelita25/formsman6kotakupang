import { getSqlClient } from '../../lib/db/sql.js';
import { DEFAULT_QUESTIONNAIRE_NAME, DEFAULT_QUESTIONNAIRE_SLUG } from '../../lib/db/bootstrap.js';
import { getDefaultDraft } from '../forms/core.js';

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeVersionRow(row) {
  if (!row) return null;
  const schema = parseJson(row.schema, {});
  return {
    id: row.id,
    questionnaireId: row.questionnaire_id,
    version: Number(row.version),
    status: row.status,
    publishedAt: row.published_at || null,
    meta: parseJson(row.meta, {}),
    fields: parseJson(schema?.fields, []),
    schema,
    legacyFormVersionId: row.legacy_form_version_id || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeQuestionnaireRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description || '',
    isActive: row.is_active,
    isDefault: row.is_default,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
  };
}

export async function findDefaultQuestionnaireByTenantId(env, tenantId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at
    FROM questionnaires
    WHERE tenant_id = ${tenantId}
      AND is_default = TRUE
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function findQuestionnaireByTenantAndSlug(env, tenantId, slug) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at
    FROM questionnaires
    WHERE tenant_id = ${tenantId}
      AND slug = ${slug}
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function findQuestionnaireByLegacyFormVersionId(env, legacyFormVersionId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      q.id,
      q.tenant_id,
      q.slug,
      q.name,
      q.category,
      q.description,
      q.is_active,
      q.is_default,
      q.created_by,
      q.created_at
    FROM questionnaire_versions qv
    JOIN questionnaires q ON q.id = qv.questionnaire_id
    WHERE qv.legacy_form_version_id = ${legacyFormVersionId}
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function listQuestionnairesByTenantId(env, tenantId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      q.id,
      q.tenant_id,
      q.slug,
      q.name,
      q.category,
      q.description,
      q.is_active,
      q.is_default,
      q.created_by,
      q.created_at,
      COUNT(rv2.id)::int AS total_responses
    FROM questionnaires q
    LEFT JOIN responses_v2 rv2 ON rv2.questionnaire_id = q.id
    WHERE q.tenant_id = ${tenantId}
    GROUP BY q.id, q.tenant_id, q.slug, q.name, q.category, q.description, q.is_active, q.is_default, q.created_by, q.created_at
    ORDER BY q.created_at ASC;
  `;
}

export async function listActiveQuestionnairesByTenantId(env, tenantId) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      q.id,
      q.tenant_id,
      q.slug,
      q.name,
      q.category,
      q.description,
      q.is_active,
      q.is_default,
      q.created_by,
      q.created_at
    FROM questionnaires q
    WHERE q.tenant_id = ${tenantId}
      AND q.is_active = TRUE
    ORDER BY q.is_default DESC, q.created_at ASC;
  `;
}

export async function createQuestionnaire(env, { tenantId, slug, name, category, description, createdBy, isDefault }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO questionnaires (
      id,
      tenant_id,
      slug,
      name,
      category,
      description,
      is_active,
      is_default,
      created_by
    )
    VALUES (
      ${crypto.randomUUID()},
      ${tenantId},
      ${slug},
      ${name},
      ${category},
      ${description},
      TRUE,
      ${Boolean(isDefault)},
      ${createdBy}
    )
    RETURNING id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function updateQuestionnaire(env, questionnaireId, payload) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE questionnaires
    SET
      slug = COALESCE(${payload.slug}, slug),
      name = COALESCE(${payload.name}, name),
      category = COALESCE(${payload.category}, category),
      description = COALESCE(${payload.description}, description),
      is_active = COALESCE(${payload.isActive}, is_active)
    WHERE id = ${questionnaireId}
    RETURNING id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function getQuestionnaireById(env, questionnaireId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT id, tenant_id, slug, name, category, description, is_active, is_default, created_by, created_at
    FROM questionnaires
    WHERE id = ${questionnaireId}
    LIMIT 1;
  `;
  return normalizeQuestionnaireRow(rows[0]);
}

export async function getPublishedVersionByQuestionnaireId(env, questionnaireId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND status = 'published'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function createPublishedVersion(env, { questionnaireId, meta, schema, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    WITH next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM questionnaire_versions
      WHERE questionnaire_id = ${questionnaireId}
    )
    INSERT INTO questionnaire_versions (
      id,
      questionnaire_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${questionnaireId},
      next_version.version,
      'published',
      ${JSON.stringify(meta)},
      ${JSON.stringify(schema)},
      NOW(),
      ${actorId}
    FROM next_version
    ON CONFLICT (questionnaire_id) WHERE status = 'published'
    DO NOTHING
    RETURNING
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function getDraftVersionByQuestionnaireId(env, questionnaireId, actorId = null) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;

  if (rows[0]) {
    return normalizeVersionRow(rows[0]);
  }

  const published = await getPublishedVersionByQuestionnaireId(env, questionnaireId);
  const sourceMeta = published?.meta || getDefaultDraft().meta;
  const sourceFields = published?.fields || getDefaultDraft().coreFields;
  const sourceSchema = {
    fields: sourceFields,
    coreFields: parseJson(published?.schema?.coreFields, []),
    extraFields: parseJson(published?.schema?.extraFields, []),
  };

  const inserted = await sql`
    WITH next_version AS (
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM questionnaire_versions
      WHERE questionnaire_id = ${questionnaireId}
    )
    INSERT INTO questionnaire_versions (
      id,
      questionnaire_id,
      version,
      status,
      meta,
      schema,
      created_by
    )
    SELECT
      ${crypto.randomUUID()},
      ${questionnaireId},
      next_version.version,
      'draft',
      ${JSON.stringify(sourceMeta)},
      ${JSON.stringify(sourceSchema)},
      ${actorId}
    FROM next_version
    ON CONFLICT (questionnaire_id) WHERE status = 'draft'
    DO UPDATE SET updated_at = questionnaire_versions.updated_at
    RETURNING
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at;
  `;

  if (inserted[0]) return normalizeVersionRow(inserted[0]);
  const fallback = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND status = 'draft'
    ORDER BY version DESC
    LIMIT 1;
  `;
  return normalizeVersionRow(fallback[0]);
}

export async function saveDraftVersion(env, { questionnaireId, draftId, meta, schema, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    UPDATE questionnaire_versions
    SET
      meta = ${JSON.stringify(meta)},
      schema = ${JSON.stringify(schema)},
      created_by = COALESCE(${actorId}, created_by),
      updated_at = NOW()
    WHERE id = ${draftId}
      AND questionnaire_id = ${questionnaireId}
      AND status = 'draft'
    RETURNING
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function publishDraftVersion(env, { questionnaireId, actorId }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    WITH scope_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(${String(questionnaireId)}::text)::bigint) AS locked
    ),
    selected_draft AS (
      SELECT qv.id
      FROM questionnaire_versions qv
      CROSS JOIN scope_lock
      WHERE qv.questionnaire_id = ${questionnaireId}
        AND qv.status = 'draft'
      ORDER BY qv.version DESC
      LIMIT 1
      FOR UPDATE
    ),
    archived AS (
      UPDATE questionnaire_versions
      SET status = 'archived', updated_at = NOW()
      WHERE questionnaire_id = ${questionnaireId}
        AND status = 'published'
        AND id <> (SELECT id FROM selected_draft)
      RETURNING id
    ),
    published AS (
      UPDATE questionnaire_versions
      SET
        status = 'published',
        published_at = NOW(),
        created_by = COALESCE(${actorId}, created_by),
        updated_at = NOW()
      WHERE id = (SELECT id FROM selected_draft)
        AND (SELECT COUNT(*) FROM archived) >= 0
      RETURNING
        id,
        questionnaire_id,
        legacy_form_version_id,
        version,
        status,
        meta,
        schema,
        published_at,
        created_by,
        created_at,
        updated_at
    )
    SELECT * FROM published;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function ensureDefaultQuestionnaireForTenant(env, tenantId, actorId = null) {
  const existing = await findDefaultQuestionnaireByTenantId(env, tenantId);
  if (existing) return existing;

  const created = await createQuestionnaire(env, {
    tenantId,
    slug: DEFAULT_QUESTIONNAIRE_SLUG,
    name: DEFAULT_QUESTIONNAIRE_NAME,
    category: 'general_feedback',
    description: 'Questionnaire default tenant',
    createdBy: actorId,
    isDefault: true,
  });

  const draftMeta = getDefaultDraft().meta;
  const draftSchema = {
    fields: getDefaultDraft().coreFields,
    coreFields: getDefaultDraft().coreFields,
    extraFields: [],
  };

  await getDraftVersionByQuestionnaireId(env, created.id, actorId);
  const published = await getPublishedVersionByQuestionnaireId(env, created.id);
  if (!published) {
    const sql = getSqlClient(env);
    await sql`
      WITH next_version AS (
        SELECT COALESCE(MAX(version), 0) + 1 AS version
        FROM questionnaire_versions
        WHERE questionnaire_id = ${created.id}
      )
      INSERT INTO questionnaire_versions (
        id,
        questionnaire_id,
        version,
        status,
        meta,
        schema,
        published_at,
        created_by
      )
      SELECT
        ${crypto.randomUUID()},
        ${created.id},
        next_version.version,
        'published',
        ${JSON.stringify(draftMeta)},
        ${JSON.stringify(draftSchema)},
        NOW(),
        ${actorId}
      FROM next_version
      ON CONFLICT DO NOTHING;
    `;
  }

  await getDraftVersionByQuestionnaireId(env, created.id, actorId);
  return created;
}

export async function insertResponseV2(env, { tenantId, questionnaireId, questionnaireVersionId, respondent, answers, payload }) {
  const sql = getSqlClient(env);
  const rows = await sql`
    INSERT INTO responses_v2 (
      tenant_id,
      questionnaire_id,
      questionnaire_version_id,
      respondent,
      answers,
      payload
    )
    VALUES (
      ${tenantId},
      ${questionnaireId},
      ${questionnaireVersionId},
      ${JSON.stringify(respondent || {})},
      ${JSON.stringify(answers || {})},
      ${JSON.stringify(payload || {})}
    )
    RETURNING id, created_at;
  `;
  return rows[0] || null;
}

export async function getQuestionnaireVersionById(env, questionnaireId, questionnaireVersionId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
      AND id = ${questionnaireVersionId}
    LIMIT 1;
  `;
  return normalizeVersionRow(rows[0]);
}

export async function listQuestionnaireVersionsByQuestionnaireId(env, questionnaireId) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      id,
      questionnaire_id,
      legacy_form_version_id,
      version,
      status,
      meta,
      schema,
      published_at,
      created_by,
      created_at,
      updated_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ${questionnaireId}
    ORDER BY version DESC;
  `;
  return rows.map((row) => normalizeVersionRow(row)).filter(Boolean);
}

function normalizeResponseV2Row(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    tenantId: row.tenant_id,
    questionnaireId: row.questionnaire_id,
    questionnaireVersionId: row.questionnaire_version_id,
    respondent: parseJson(row.respondent, {}),
    answers: parseJson(row.answers, {}),
    payload: parseJson(row.payload, {}),
    createdAt: row.created_at,
  };
}

export async function listQuestionnaireResponsesV2(env, filters) {
  const sql = getSqlClient(env);
  const searchPattern = filters.search ? `%${filters.search}%` : null;
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * pageSize;

  const [countRows, itemRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS total
      FROM responses_v2
      WHERE tenant_id = ${filters.tenantId}
        AND questionnaire_id = ${filters.questionnaireId}
        AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
        AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
        AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        AND (
          ${searchPattern}::text IS NULL
          OR respondent::text ILIKE ${searchPattern}
          OR answers::text ILIKE ${searchPattern}
          OR payload::text ILIKE ${searchPattern}
        );
    `,
    sql`
      SELECT
        id,
        tenant_id,
        questionnaire_id,
        questionnaire_version_id,
        respondent,
        answers,
        payload,
        TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM responses_v2
      WHERE tenant_id = ${filters.tenantId}
        AND questionnaire_id = ${filters.questionnaireId}
        AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
        AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
        AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        AND (
          ${searchPattern}::text IS NULL
          OR respondent::text ILIKE ${searchPattern}
          OR answers::text ILIKE ${searchPattern}
          OR payload::text ILIKE ${searchPattern}
        )
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset};
    `,
  ]);

  return {
    page,
    pageSize,
    total: Number(countRows?.[0]?.total || 0),
    items: itemRows.map(normalizeResponseV2Row).filter(Boolean),
  };
}

export async function listQuestionnaireResponsesForAggregation(env, filters, limit = 5000) {
  const sql = getSqlClient(env);
  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const resolvedLimit = hasLimit ? Math.max(1, Number(limit)) : null;
  const rows = hasLimit
    ? await sql`
        SELECT
          id,
          tenant_id,
          questionnaire_id,
          questionnaire_version_id,
          respondent,
          answers,
          payload,
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM responses_v2
        WHERE tenant_id = ${filters.tenantId}
          AND questionnaire_id = ${filters.questionnaireId}
          AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
          AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
          AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        ORDER BY created_at DESC
        LIMIT ${resolvedLimit};
      `
    : await sql`
        SELECT
          id,
          tenant_id,
          questionnaire_id,
          questionnaire_version_id,
          respondent,
          answers,
          payload,
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM responses_v2
        WHERE tenant_id = ${filters.tenantId}
          AND questionnaire_id = ${filters.questionnaireId}
          AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
          AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
          AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
        ORDER BY created_at DESC;
      `;
  return rows.map(normalizeResponseV2Row).filter(Boolean);
}

export async function getQuestionnaireSummaryStatsV2(env, filters) {
  const sql = getSqlClient(env);
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total_responses,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS responses_today,
      TO_CHAR(MAX(created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_submitted_at
    FROM responses_v2
    WHERE tenant_id = ${filters.tenantId}
      AND questionnaire_id = ${filters.questionnaireId}
      AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
      AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
      AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to});
  `;
  return rows[0] || null;
}

export async function getQuestionnaireTrendRowsV2(env, filters) {
  const sql = getSqlClient(env);
  return sql`
    SELECT
      TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS total
    FROM responses_v2
    WHERE tenant_id = ${filters.tenantId}
      AND questionnaire_id = ${filters.questionnaireId}
      AND (${filters.questionnaireVersionId}::uuid IS NULL OR questionnaire_version_id = ${filters.questionnaireVersionId})
      AND (${filters.from}::timestamptz IS NULL OR created_at >= ${filters.from})
      AND (${filters.to}::timestamptz IS NULL OR created_at < ${filters.to})
    GROUP BY 1
    ORDER BY 1 ASC;
  `;
}

export const DEFAULT_QUESTIONNAIRE_SLUG = 'feedback-utama';
export const DEFAULT_QUESTIONNAIRE_NAME = 'Feedback Utama';

export function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function normalizeDefaultDraft(input) {
  return {
    meta: parseJson(input?.meta, {}),
    coreFields: parseJson(input?.coreFields, []),
  };
}

export function normalizeVersionRow(row) {
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

export function normalizeQuestionnaireRow(row) {
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

export function normalizeResponseV2Row(row) {
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

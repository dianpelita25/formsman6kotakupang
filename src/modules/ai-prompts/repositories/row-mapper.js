export function mapPromptRow(row) {
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

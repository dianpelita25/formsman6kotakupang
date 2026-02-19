import { resolveQuestionnaireContext } from './context.js';
import { resolveVersionFields } from './distribution.js';
import {
  normalizeFromFilter,
  normalizePage,
  normalizePageSize,
  normalizeSearch,
  normalizeToFilter,
} from './query-utils.js';
import { escapeCsvValue, formatAnswerForCsv, toResponseListItem } from './response-utils.js';
import { listQuestionnaireResponsesForAggregation, listQuestionnaireResponsesV2 } from './repository.js';

export async function getTenantQuestionnaireResponses(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
    search: normalizeSearch(query.search),
    page: normalizePage(query.page),
    pageSize: normalizePageSize(query.pageSize),
  };

  const result = await listQuestionnaireResponsesV2(env, filters);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      filters: {
        page: result.page,
        pageSize: result.pageSize,
        search: filters.search,
        from: filters.from,
        to: filters.to,
        questionnaireVersionId: context.questionnaireVersionId,
      },
      total: result.total,
      items: result.items.map(toResponseListItem),
    },
  };
}

export async function exportTenantQuestionnaireResponsesCsv(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const rows = await listQuestionnaireResponsesForAggregation(env, filters, 20000);
  const fields = resolveVersionFields(context.selectedVersion || {});

  const respondentKeys = new Set();
  const answerKeyOrder = [];
  const answerKeySet = new Set();

  fields.forEach((field) => {
    if (!field?.name) return;
    if (!answerKeySet.has(field.name)) {
      answerKeySet.add(field.name);
      answerKeyOrder.push(field.name);
    }
  });

  rows.forEach((row) => {
    Object.keys(row.respondent || {}).forEach((key) => respondentKeys.add(key));
    Object.keys(row.answers || {}).forEach((key) => {
      if (!answerKeySet.has(key)) {
        answerKeySet.add(key);
        answerKeyOrder.push(key);
      }
    });
  });

  const respondentColumns = Array.from(respondentKeys).sort();
  const headers = [
    'id',
    'submitted_at',
    'questionnaire_version_id',
    ...respondentColumns.map((key) => `respondent.${key}`),
    ...answerKeyOrder.map((key) => `answer.${key}`),
  ];

  const lines = [headers.map(escapeCsvValue).join(',')];
  rows.forEach((row) => {
    const values = [
      row.id,
      row.createdAt,
      row.questionnaireVersionId,
      ...respondentColumns.map((key) => row.respondent?.[key] ?? ''),
      ...answerKeyOrder.map((key) => formatAnswerForCsv(row.answers?.[key])),
    ];
    lines.push(values.map(escapeCsvValue).join(','));
  });

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      csv: lines.join('\n'),
    },
  };
}

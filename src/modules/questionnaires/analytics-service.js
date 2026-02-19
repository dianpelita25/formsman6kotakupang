import { resolveQuestionnaireContext } from './context.js';
import { computeDistribution, resolveVersionFields } from './distribution.js';
import {
  addDays,
  formatDay,
  normalizeDays,
  normalizeFromFilter,
  normalizeToFilter,
  resolveTrendEnd,
  resolveTrendStart,
} from './query-utils.js';
import {
  getQuestionnaireSummaryStatsV2,
  getQuestionnaireTrendRowsV2,
  listQuestionnaireResponsesForAggregation,
} from './repository.js';

function buildAnalyticsFilters(tenantId, questionnaireId, questionnaireVersionId, query = {}) {
  return {
    tenantId,
    questionnaireId,
    questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };
}

function buildSummaryPayload(summaryRow, distribution) {
  return {
    totalResponses: Number(summaryRow?.total_responses || 0),
    responsesToday: Number(summaryRow?.responses_today || 0),
    lastSubmittedAt: summaryRow?.last_submitted_at || null,
    avgScaleOverall: distribution.avgScaleOverall,
    totalScaleQuestions: Object.keys(distribution.questionAverages).length,
    totalRadioAnswers: distribution.totalRadioAnswers,
    totalChoiceAnswers: distribution.totalChoiceAnswers,
    totalCheckboxAnswers: distribution.totalCheckboxAnswers,
    totalTextAnswers: distribution.totalTextAnswers,
    questionAverages: distribution.questionAverages,
    scaleAverages: distribution.scaleAverages,
    criteriaSummary: distribution.criteriaSummary,
    segmentSummary: distribution.segmentSummary,
    totalQuestionsWithCriterion: distribution.totalQuestionsWithCriterion,
  };
}

function buildDistributionPayload(distribution, totalResponses) {
  return {
    totalResponses,
    questions: distribution.byQuestion,
    questionAverages: distribution.questionAverages,
    scaleAverages: distribution.scaleAverages,
    criteriaSummary: distribution.criteriaSummary,
    segmentSummary: distribution.segmentSummary,
    totalQuestionsWithCriterion: distribution.totalQuestionsWithCriterion,
  };
}

function toAiSourceRows(rows, limit = 120) {
  const parsedLimit = Number(limit);
  const resolvedLimit = Number.isFinite(parsedLimit) ? Math.max(0, Math.floor(parsedLimit)) : 120;
  const selected = resolvedLimit > 0 ? rows.slice(0, resolvedLimit) : [];
  return selected.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    respondent: row.respondent || {},
    answers: row.answers || {},
  }));
}

async function loadAnalyticsDataset(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = buildAnalyticsFilters(tenantId, context.questionnaire.id, context.questionnaireVersionId, query);
  const responses = await listQuestionnaireResponsesForAggregation(env, filters, null);
  const fields = resolveVersionFields(context.selectedVersion || {});
  const distribution = computeDistribution(fields, responses);

  return {
    ok: true,
    context,
    filters,
    responses,
    distribution,
  };
}

export async function getTenantQuestionnaireAnalyticsSummary(env, tenantId, questionnaireSlug, query = {}) {
  const dataset = await loadAnalyticsDataset(env, tenantId, questionnaireSlug, query);
  if (!dataset.ok) return dataset;
  const summaryRow = await getQuestionnaireSummaryStatsV2(env, dataset.filters);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: dataset.context.questionnaire,
      questionnaireVersionId: dataset.context.questionnaireVersionId,
      ...buildSummaryPayload(summaryRow, dataset.distribution),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsDistribution(env, tenantId, questionnaireSlug, query = {}) {
  const dataset = await loadAnalyticsDataset(env, tenantId, questionnaireSlug, query);
  if (!dataset.ok) return dataset;

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: dataset.context.questionnaire,
      questionnaireVersionId: dataset.context.questionnaireVersionId,
      ...buildDistributionPayload(dataset.distribution, dataset.responses.length),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsBundle(
  env,
  tenantId,
  questionnaireSlug,
  query = {},
  options = {}
) {
  const dataset = await loadAnalyticsDataset(env, tenantId, questionnaireSlug, query);
  if (!dataset.ok) return dataset;
  const summaryRow = await getQuestionnaireSummaryStatsV2(env, dataset.filters);
  const sourceLimit = options?.sourceLimit ?? 120;

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: dataset.context.questionnaire,
      questionnaireVersionId: dataset.context.questionnaireVersionId,
      summary: buildSummaryPayload(summaryRow, dataset.distribution),
      distribution: buildDistributionPayload(dataset.distribution, dataset.responses.length),
      responses: toAiSourceRows(dataset.responses, sourceLimit),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsTrend(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const days = normalizeDays(query.days);
  const fromIso = normalizeFromFilter(query.from);
  const toIso = normalizeToFilter(query.to);
  const effectiveFrom = resolveTrendStart(fromIso, days);

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: effectiveFrom,
    to: toIso,
  };

  const rows = await getQuestionnaireTrendRowsV2(env, filters);
  const byDay = new Map(rows.map((row) => [String(row.day), Number(row.total || 0)]));

  const fromDate = new Date(effectiveFrom);
  const toDate = resolveTrendEnd(toIso);
  const points = [];
  for (let date = new Date(fromDate); date <= toDate; date = addDays(date, 1)) {
    const day = formatDay(date);
    points.push({
      day,
      total: byDay.get(day) || 0,
    });
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      days,
      from: effectiveFrom,
      to: toIso,
      points,
    },
  };
}

export async function getTenantQuestionnaireAiSource(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const responses = await listQuestionnaireResponsesForAggregation(env, filters, 120);
  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      responses: toAiSourceRows(responses, 120),
    },
  };
}

import { resolveQuestionnaireContext } from './context.js';
import { buildDataQuality } from './data-quality.js';
import { computeDistribution, resolveVersionFields } from './distribution.js';
import {
  addDays,
  formatDay,
  normalizeDays,
  normalizeFromFilter,
  normalizeSegmentDimensionId,
  normalizeToFilter,
  resolveTrendEnd,
  resolveTrendStart,
} from './query-utils.js';
import {
  MAX_SEGMENT_DRILLDOWN_ROWS,
  filterResponsesBySegment,
  isSegmentDrilldownEligible,
  resolveLastSubmittedAt,
  resolveSegmentCompareBuckets,
  resolveSegmentFilter,
} from './segment-filter.js';
import {
  getQuestionnaireSummaryStatsV2,
  getQuestionnaireTrendRowsV2,
  listQuestionnaireResponsesForAggregation,
} from './repository.js';

const MAX_ANALYTICS_AGGREGATION_ROWS = 20000;

function buildAnalyticsFilters(tenantId, questionnaireId, questionnaireVersionId, query = {}) {
  return {
    tenantId,
    questionnaireId,
    questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };
}

function toDate(value) {
  const parsed = new Date(String(value || '').trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildSummaryFromResponses(responseRows = []) {
  const rows = Array.isArray(responseRows) ? responseRows : [];
  const todayKey = formatDay(new Date());
  let responsesToday = 0;
  rows.forEach((row) => {
    const submittedAt = toDate(row?.createdAt);
    if (!submittedAt) return;
    if (formatDay(submittedAt) === todayKey) {
      responsesToday += 1;
    }
  });
  return {
    total_responses: rows.length,
    responses_today: responsesToday,
    last_submitted_at: resolveLastSubmittedAt(rows),
  };
}

function resolveSummaryLastSubmittedAt(summaryRow = null, fallbackRows = []) {
  const summaryValue = summaryRow?.last_submitted_at || summaryRow?.lastSubmittedAt || null;
  if (summaryValue) return summaryValue;
  return resolveLastSubmittedAt(fallbackRows);
}

function buildSummaryPayload(summaryRow, distribution, dataQuality) {
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
    dataQuality,
  };
}

function buildDistributionPayload(distribution, totalResponses, dataQuality) {
  return {
    totalResponses,
    questions: distribution.byQuestion,
    questionAverages: distribution.questionAverages,
    scaleAverages: distribution.scaleAverages,
    criteriaSummary: distribution.criteriaSummary,
    segmentSummary: distribution.segmentSummary,
    totalQuestionsWithCriterion: distribution.totalQuestionsWithCriterion,
    dataQuality,
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

async function resolveAnalyticsContext(env, tenantId, questionnaireSlug, questionnaireVersionId = null) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, questionnaireVersionId);
  if (!context.ok) return context;
  const fields = resolveVersionFields(context.selectedVersion || {});
  return {
    ok: true,
    context,
    fields,
  };
}

async function loadResponsesWithOptionalSegmentFilter(
  env,
  {
    filters,
    fields,
    segmentFilter = null,
    limitOverride = null,
  } = {}
) {
  const isSegmentActive = Boolean(segmentFilter?.segmentFilterActive);
  const hasLimitOverride = Number.isFinite(Number(limitOverride));
  const maxRows = hasLimitOverride || isSegmentActive ? MAX_SEGMENT_DRILLDOWN_ROWS : MAX_ANALYTICS_AGGREGATION_ROWS;
  const limit = Number.isFinite(Number(limitOverride))
    ? Math.max(1, Number(limitOverride))
    : isSegmentActive
      ? MAX_SEGMENT_DRILLDOWN_ROWS + 1
      : MAX_ANALYTICS_AGGREGATION_ROWS + 1;
  const candidates = await listQuestionnaireResponsesForAggregation(env, filters, limit);

  if (candidates.length > maxRows) {
    const message =
      maxRows === MAX_SEGMENT_DRILLDOWN_ROWS
        ? `Jumlah data terlalu besar untuk drilldown segment. Persempit filter (maksimal ${MAX_SEGMENT_DRILLDOWN_ROWS} respons).`
        : `Jumlah data terlalu besar untuk analitik. Persempit rentang filter (maksimal ${MAX_ANALYTICS_AGGREGATION_ROWS} respons).`;
    return {
      ok: false,
      status: 422,
      message,
    };
  }

  if (!isSegmentActive) {
    return {
      ok: true,
      responses: candidates,
      totalCandidates: candidates.length,
    };
  }

  const { matched, totalCandidates } = filterResponsesBySegment({
    fields,
    responseRows: candidates,
    segmentDimensionId: segmentFilter.segmentDimensionId,
    segmentBucket: segmentFilter.segmentBucket,
  });
  return {
    ok: true,
    responses: matched,
    totalCandidates,
  };
}

async function loadAnalyticsDataset(env, tenantId, questionnaireSlug, query = {}) {
  const contextResult = await resolveAnalyticsContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!contextResult.ok) return contextResult;

  const segmentFilter = resolveSegmentFilter(query);
  if (!segmentFilter.ok) return segmentFilter;
  if (segmentFilter.segmentFilterActive && !isSegmentDrilldownEligible(segmentFilter.segmentDimensionId)) {
    return {
      ok: false,
      status: 422,
      message: 'Dimensi segmentasi ini tidak mendukung drilldown responses.',
    };
  }

  const filters = buildAnalyticsFilters(
    tenantId,
    contextResult.context.questionnaire.id,
    contextResult.context.questionnaireVersionId,
    query
  );
  const responsesResult = await loadResponsesWithOptionalSegmentFilter(env, {
    filters,
    fields: contextResult.fields,
    segmentFilter,
  });
  if (!responsesResult.ok) return responsesResult;

  const distribution = computeDistribution(contextResult.fields, responsesResult.responses);
  return {
    ok: true,
    context: contextResult.context,
    fields: contextResult.fields,
    filters,
    segmentFilter,
    responses: responsesResult.responses,
    totalCandidates: responsesResult.totalCandidates,
    distribution,
  };
}

function buildTrendPointsFromResponses(responseRows = [], effectiveFrom, toIso) {
  const byDay = new Map();
  (Array.isArray(responseRows) ? responseRows : []).forEach((row) => {
    const submittedAt = toDate(row?.createdAt);
    if (!submittedAt) return;
    const day = formatDay(submittedAt);
    byDay.set(day, Number(byDay.get(day) || 0) + 1);
  });

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
  return points;
}

export async function getTenantQuestionnaireAnalyticsSummary(env, tenantId, questionnaireSlug, query = {}) {
  const dataset = await loadAnalyticsDataset(env, tenantId, questionnaireSlug, query);
  if (!dataset.ok) return dataset;

  const summaryRow = dataset.segmentFilter.segmentFilterActive
    ? buildSummaryFromResponses(dataset.responses)
    : await getQuestionnaireSummaryStatsV2(env, dataset.filters);
  const lastSubmittedAt = resolveSummaryLastSubmittedAt(summaryRow, dataset.responses);
  const dataQuality = buildDataQuality({
    sampleSize: dataset.responses.length,
    fromIso: dataset.filters.from,
    toIso: dataset.filters.to,
    lastSubmittedAt,
    segmentFiltered: dataset.segmentFilter.segmentFilterActive,
  });

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: dataset.context.questionnaire,
      questionnaireVersionId: dataset.context.questionnaireVersionId,
      ...buildSummaryPayload(
        {
          ...summaryRow,
          last_submitted_at: lastSubmittedAt,
        },
        dataset.distribution,
        dataQuality
      ),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsDistribution(env, tenantId, questionnaireSlug, query = {}) {
  const dataset = await loadAnalyticsDataset(env, tenantId, questionnaireSlug, query);
  if (!dataset.ok) return dataset;

  const dataQuality = buildDataQuality({
    sampleSize: dataset.responses.length,
    fromIso: dataset.filters.from,
    toIso: dataset.filters.to,
    lastSubmittedAt: resolveLastSubmittedAt(dataset.responses),
    segmentFiltered: dataset.segmentFilter.segmentFilterActive,
  });

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: dataset.context.questionnaire,
      questionnaireVersionId: dataset.context.questionnaireVersionId,
      ...buildDistributionPayload(dataset.distribution, dataset.responses.length, dataQuality),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsSegmentCompare(env, tenantId, questionnaireSlug, query = {}) {
  const segmentDimensionId = normalizeSegmentDimensionId(query.segmentDimensionId);
  if (!segmentDimensionId) {
    return {
      ok: false,
      status: 400,
      message: 'segmentDimensionId wajib diisi dan harus valid.',
    };
  }
  if (!isSegmentDrilldownEligible(segmentDimensionId)) {
    return {
      ok: false,
      status: 422,
      message: 'Dimensi segmentasi ini tidak mendukung compare berbasis responses.',
    };
  }

  const contextResult = await resolveAnalyticsContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!contextResult.ok) return contextResult;

  const filters = buildAnalyticsFilters(
    tenantId,
    contextResult.context.questionnaire.id,
    contextResult.context.questionnaireVersionId,
    query
  );
  const responsesResult = await loadResponsesWithOptionalSegmentFilter(env, {
    filters,
    fields: contextResult.fields,
    limitOverride: MAX_SEGMENT_DRILLDOWN_ROWS + 1,
  });
  if (!responsesResult.ok) return responsesResult;

  const baseDistribution = computeDistribution(contextResult.fields, responsesResult.responses);
  const dimensions = Array.isArray(baseDistribution.segmentSummary?.dimensions) ? baseDistribution.segmentSummary.dimensions : [];
  const dimension = dimensions.find((entry) => String(entry?.id || '').trim() === segmentDimensionId);
  if (!dimension) {
    return {
      ok: false,
      status: 404,
      message: 'Dimensi segmentasi tidak ditemukan untuk filter saat ini.',
    };
  }

  const compareBucketsResult = resolveSegmentCompareBuckets(query.segmentBuckets);
  if (!compareBucketsResult.ok) return compareBucketsResult;
  const availableBucketLabels = new Set((Array.isArray(dimension.buckets) ? dimension.buckets : []).map((bucket) => String(bucket?.label || '')));
  const requestedBuckets = compareBucketsResult.buckets.filter((label) => availableBucketLabels.has(label));
  const selectedBuckets = requestedBuckets.length
    ? requestedBuckets
    : (Array.isArray(dimension.buckets) ? dimension.buckets : [])
        .slice(0, 3)
        .map((bucket) => String(bucket?.label || ''))
        .filter(Boolean);

  if (!selectedBuckets.length) {
    return {
      ok: false,
      status: 400,
      message: 'Tidak ada bucket valid untuk dibandingkan.',
    };
  }

  const comparedBuckets = selectedBuckets.map((bucketLabel) => {
    const scoped = filterResponsesBySegment({
      fields: contextResult.fields,
      responseRows: responsesResult.responses,
      segmentDimensionId,
      segmentBucket: bucketLabel,
    }).matched;
    const scopedDistribution = computeDistribution(contextResult.fields, scoped);
    const scopedSummary = buildSummaryFromResponses(scoped);
    const scopedDataQuality = buildDataQuality({
      sampleSize: scoped.length,
      fromIso: filters.from,
      toIso: filters.to,
      lastSubmittedAt: scopedSummary.last_submitted_at,
      segmentFiltered: true,
    });

    return {
      label: bucketLabel,
      totalResponses: Number(scopedSummary.total_responses || 0),
      responsesToday: Number(scopedSummary.responses_today || 0),
      lastSubmittedAt: scopedSummary.last_submitted_at || null,
      avgScaleOverall: Number(scopedDistribution.avgScaleOverall || 0),
      dataQuality: scopedDataQuality,
    };
  });

  const dataQuality = buildDataQuality({
    sampleSize: responsesResult.responses.length,
    fromIso: filters.from,
    toIso: filters.to,
    lastSubmittedAt: resolveLastSubmittedAt(responsesResult.responses),
    segmentFiltered: false,
  });

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: contextResult.context.questionnaire,
      questionnaireVersionId: contextResult.context.questionnaireVersionId,
      segmentDimensionId: dimension.id,
      segmentLabel: dimension.label,
      metric: dimension.metric,
      drilldownEligible: Boolean(dimension.drilldownEligible),
      dataQuality,
      buckets: comparedBuckets,
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
  const summaryRow = dataset.segmentFilter.segmentFilterActive
    ? buildSummaryFromResponses(dataset.responses)
    : await getQuestionnaireSummaryStatsV2(env, dataset.filters);
  const lastSubmittedAt = resolveSummaryLastSubmittedAt(summaryRow, dataset.responses);
  const dataQuality = buildDataQuality({
    sampleSize: dataset.responses.length,
    fromIso: dataset.filters.from,
    toIso: dataset.filters.to,
    lastSubmittedAt,
    segmentFiltered: dataset.segmentFilter.segmentFilterActive,
  });
  const sourceLimit = options?.sourceLimit ?? 120;

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: dataset.context.questionnaire,
      questionnaireVersionId: dataset.context.questionnaireVersionId,
      summary: buildSummaryPayload(
        {
          ...summaryRow,
          last_submitted_at: lastSubmittedAt,
        },
        dataset.distribution,
        dataQuality
      ),
      distribution: buildDistributionPayload(dataset.distribution, dataset.responses.length, dataQuality),
      responses: toAiSourceRows(dataset.responses, sourceLimit),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsTrend(env, tenantId, questionnaireSlug, query = {}) {
  const contextResult = await resolveAnalyticsContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!contextResult.ok) return contextResult;

  const segmentFilter = resolveSegmentFilter(query);
  if (!segmentFilter.ok) return segmentFilter;
  if (segmentFilter.segmentFilterActive && !isSegmentDrilldownEligible(segmentFilter.segmentDimensionId)) {
    return {
      ok: false,
      status: 422,
      message: 'Dimensi segmentasi ini tidak mendukung drilldown responses.',
    };
  }

  const days = normalizeDays(query.days);
  const fromIso = normalizeFromFilter(query.from);
  const toIso = normalizeToFilter(query.to);
  const effectiveFrom = resolveTrendStart(fromIso, days);

  const filters = {
    tenantId,
    questionnaireId: contextResult.context.questionnaire.id,
    questionnaireVersionId: contextResult.context.questionnaireVersionId,
    from: effectiveFrom,
    to: toIso,
  };

  let points = [];
  if (!segmentFilter.segmentFilterActive) {
    const rows = await getQuestionnaireTrendRowsV2(env, filters);
    const byDay = new Map(rows.map((row) => [String(row.day), Number(row.total || 0)]));
    const fromDate = new Date(effectiveFrom);
    const toDate = resolveTrendEnd(toIso);
    for (let date = new Date(fromDate); date <= toDate; date = addDays(date, 1)) {
      const day = formatDay(date);
      points.push({
        day,
        total: byDay.get(day) || 0,
      });
    }
  } else {
    const responsesResult = await loadResponsesWithOptionalSegmentFilter(env, {
      filters,
      fields: contextResult.fields,
      segmentFilter,
    });
    if (!responsesResult.ok) return responsesResult;
    points = buildTrendPointsFromResponses(responsesResult.responses, effectiveFrom, toIso);
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: contextResult.context.questionnaire,
      questionnaireVersionId: contextResult.context.questionnaireVersionId,
      days,
      from: effectiveFrom,
      to: toIso,
      points,
    },
  };
}

export async function getTenantQuestionnaireAiSource(env, tenantId, questionnaireSlug, query = {}) {
  const contextResult = await resolveAnalyticsContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!contextResult.ok) return contextResult;

  const filters = {
    tenantId,
    questionnaireId: contextResult.context.questionnaire.id,
    questionnaireVersionId: contextResult.context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const responses = await listQuestionnaireResponsesForAggregation(env, filters, 120);
  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: contextResult.context.questionnaire,
      questionnaireVersionId: contextResult.context.questionnaireVersionId,
      responses: toAiSourceRows(responses, 120),
    },
  };
}

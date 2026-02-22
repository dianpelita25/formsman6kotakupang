import {
  getTenantQuestionnaireAnalyticsDistribution,
  getTenantQuestionnaireAnalyticsSummary,
  getTenantQuestionnaireAnalyticsTrend,
} from './analytics-service.js';

export const PUBLIC_DASHBOARD_MIN_SAMPLE_SIZE = 30;
export const PUBLIC_DASHBOARD_MIN_BUCKET_SIZE = 10;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeQuestionnaireMeta(questionnaire = {}) {
  return {
    slug: String(questionnaire?.slug || '').trim(),
    name: String(questionnaire?.name || '').trim(),
  };
}

function buildPrivacyMeta(sampleSize) {
  const size = Math.max(0, toNumber(sampleSize, 0));
  return {
    minSampleSize: PUBLIC_DASHBOARD_MIN_SAMPLE_SIZE,
    minBucketSize: PUBLIC_DASHBOARD_MIN_BUCKET_SIZE,
    sampleSize: size,
    eligible: size >= PUBLIC_DASHBOARD_MIN_SAMPLE_SIZE,
  };
}

function buildInsufficientPayload(questionnaire, sampleSize) {
  return {
    status: 'insufficient_sample',
    questionnaire: sanitizeQuestionnaireMeta(questionnaire),
    privacy: buildPrivacyMeta(sampleSize),
  };
}

function sanitizeCriteriaSummary(criteriaSummary = []) {
  return (Array.isArray(criteriaSummary) ? criteriaSummary : []).map((entry) => ({
    criterion: String(entry?.criterion || '').trim(),
    totalQuestions: toNumber(entry?.totalQuestions, 0),
    totalScaleQuestions: toNumber(entry?.totalScaleQuestions, 0),
    totalScaleAnswered: toNumber(entry?.totalScaleAnswered, 0),
    avgScale: Number(toNumber(entry?.avgScale, 0).toFixed(2)),
  }));
}

function sanitizeScaleAverages(scaleAverages = []) {
  return (Array.isArray(scaleAverages) ? scaleAverages : []).map((entry) => ({
    name: String(entry?.name || '').trim(),
    label: String(entry?.label || '').trim(),
    questionCode: String(entry?.questionCode || '').trim(),
    criterion: String(entry?.criterion || '').trim(),
    average: Number(toNumber(entry?.average, 0).toFixed(2)),
    totalAnswered: toNumber(entry?.totalAnswered, 0),
  }));
}

function sanitizeCounts(counts = []) {
  return (Array.isArray(counts) ? counts : []).map((entry) => ({
    label: String(entry?.label || '').trim(),
    total: toNumber(entry?.total, 0),
  }));
}

function sanitizeQuestion(question = {}) {
  const common = {
    name: String(question?.name || '').trim(),
    label: String(question?.label || '').trim(),
    questionCode: String(question?.questionCode || '').trim(),
    criterion: String(question?.criterion || '').trim(),
    type: String(question?.type || '').trim(),
    totalAnswered: toNumber(question?.totalAnswered, 0),
  };

  if (common.type === 'text') {
    return common;
  }

  if (common.type === 'scale') {
    return {
      ...common,
      fromLabel: String(question?.fromLabel || '').trim(),
      toLabel: String(question?.toLabel || '').trim(),
      average: Number(toNumber(question?.average, 0).toFixed(2)),
      counts: sanitizeCounts(question?.counts),
    };
  }

  return {
    ...common,
    totalSelected: toNumber(question?.totalSelected, 0),
    counts: sanitizeCounts(question?.counts),
  };
}

function sanitizeSegmentDimension(dimension = {}) {
  const sanitizedBuckets = (Array.isArray(dimension?.buckets) ? dimension.buckets : [])
    .map((bucket) => ({
      label: String(bucket?.label || '').trim(),
      total: toNumber(bucket?.total, 0),
      avgScale: bucket?.avgScale != null ? Number(toNumber(bucket?.avgScale, 0).toFixed(2)) : undefined,
      totalScaleAnswered: bucket?.totalScaleAnswered != null ? toNumber(bucket?.totalScaleAnswered, 0) : undefined,
    }))
    .filter((bucket) => bucket.total >= PUBLIC_DASHBOARD_MIN_BUCKET_SIZE);

  if (!sanitizedBuckets.length) return null;

  return {
    id: String(dimension?.id || '').trim(),
    kind: String(dimension?.kind || '').trim(),
    label: String(dimension?.label || '').trim(),
    metric: String(dimension?.metric || '').trim() || 'count',
    buckets: sanitizedBuckets,
  };
}

function sanitizeSegmentSummary(segmentSummary = {}, questions = []) {
  const questionTypeMap = new Map(
    (Array.isArray(questions) ? questions : []).map((question) => [String(question?.name || '').trim(), String(question?.type || '').trim()])
  );

  const dimensions = (Array.isArray(segmentSummary?.dimensions) ? segmentSummary.dimensions : [])
    .filter((dimension) => {
      const id = String(dimension?.id || '').trim();
      if (!id || id.startsWith('respondent:')) return false;
      if (!id.startsWith('question:')) return true;
      const fieldName = id.slice('question:'.length);
      return questionTypeMap.get(fieldName) !== 'text';
    })
    .map((dimension) => sanitizeSegmentDimension(dimension))
    .filter(Boolean);

  return {
    totalDimensions: dimensions.length,
    dimensions,
  };
}

function sanitizeSummaryPayload(data = {}) {
  return {
    totalResponses: toNumber(data?.totalResponses, 0),
    responsesToday: toNumber(data?.responsesToday, 0),
    lastSubmittedAt: data?.lastSubmittedAt || null,
    avgScaleOverall: Number(toNumber(data?.avgScaleOverall, 0).toFixed(2)),
    totalScaleQuestions: toNumber(data?.totalScaleQuestions, 0),
    totalChoiceAnswers: toNumber(data?.totalChoiceAnswers, 0),
    totalCheckboxAnswers: toNumber(data?.totalCheckboxAnswers, 0),
    totalTextAnswers: toNumber(data?.totalTextAnswers, 0),
    totalQuestionsWithCriterion: toNumber(data?.totalQuestionsWithCriterion, 0),
    criteriaSummary: sanitizeCriteriaSummary(data?.criteriaSummary),
    scaleAverages: sanitizeScaleAverages(data?.scaleAverages),
  };
}

function sanitizeDistributionPayload(data = {}) {
  const questions = (Array.isArray(data?.questions) ? data.questions : []).map((question) => sanitizeQuestion(question));
  return {
    totalResponses: toNumber(data?.totalResponses, 0),
    totalQuestionsWithCriterion: toNumber(data?.totalQuestionsWithCriterion, 0),
    questions,
    questionAverages: data?.questionAverages || {},
    scaleAverages: sanitizeScaleAverages(data?.scaleAverages),
    criteriaSummary: sanitizeCriteriaSummary(data?.criteriaSummary),
    segmentSummary: sanitizeSegmentSummary(data?.segmentSummary, questions),
    dataQuality: {
      sampleSize: toNumber(data?.dataQuality?.sampleSize, 0),
      confidence: String(data?.dataQuality?.confidence || '').trim(),
      warnings: Array.isArray(data?.dataQuality?.warnings) ? data.dataQuality.warnings : [],
    },
  };
}

function sanitizeTrendPayload(data = {}) {
  return {
    days: toNumber(data?.days, 0),
    from: String(data?.from || '').trim(),
    to: String(data?.to || '').trim(),
    points: (Array.isArray(data?.points) ? data.points : []).map((point) => ({
      day: String(point?.day || '').trim(),
      total: toNumber(point?.total, 0),
    })),
  };
}

async function resolvePublicSampleContext(env, tenantId, questionnaireSlug, query = {}) {
  const summaryResult = await getTenantQuestionnaireAnalyticsSummary(env, tenantId, questionnaireSlug, query);
  if (!summaryResult.ok) return summaryResult;

  const sampleSize = toNumber(summaryResult?.data?.totalResponses, 0);
  const privacy = buildPrivacyMeta(sampleSize);
  return {
    ok: true,
    status: 200,
    summaryResult,
    sampleSize,
    privacy,
  };
}

export async function getTenantQuestionnairePublicDashboardSummary(env, tenantId, questionnaireSlug, query = {}) {
  const sampleContext = await resolvePublicSampleContext(env, tenantId, questionnaireSlug, query);
  if (!sampleContext.ok) return sampleContext;

  const questionnaire = sampleContext.summaryResult.data?.questionnaire || {};
  if (!sampleContext.privacy.eligible) {
    return {
      ok: true,
      status: 200,
      data: {
        ...buildInsufficientPayload(questionnaire, sampleContext.sampleSize),
        summary: {
          totalResponses: sampleContext.sampleSize,
          responsesToday: toNumber(sampleContext.summaryResult.data?.responsesToday, 0),
          lastSubmittedAt: sampleContext.summaryResult.data?.lastSubmittedAt || null,
        },
      },
    };
  }

  return {
    ok: true,
    status: 200,
    data: {
      status: 'ok',
      questionnaire: sanitizeQuestionnaireMeta(questionnaire),
      privacy: sampleContext.privacy,
      summary: sanitizeSummaryPayload(sampleContext.summaryResult.data),
    },
  };
}

export async function getTenantQuestionnairePublicDashboardDistribution(env, tenantId, questionnaireSlug, query = {}) {
  const sampleContext = await resolvePublicSampleContext(env, tenantId, questionnaireSlug, query);
  if (!sampleContext.ok) return sampleContext;

  const questionnaire = sampleContext.summaryResult.data?.questionnaire || {};
  if (!sampleContext.privacy.eligible) {
    return {
      ok: true,
      status: 200,
      data: {
        ...buildInsufficientPayload(questionnaire, sampleContext.sampleSize),
        distribution: null,
      },
    };
  }

  const distributionResult = await getTenantQuestionnaireAnalyticsDistribution(env, tenantId, questionnaireSlug, query);
  if (!distributionResult.ok) return distributionResult;

  return {
    ok: true,
    status: 200,
    data: {
      status: 'ok',
      questionnaire: sanitizeQuestionnaireMeta(questionnaire),
      privacy: sampleContext.privacy,
      distribution: sanitizeDistributionPayload(distributionResult.data),
    },
  };
}

export async function getTenantQuestionnairePublicDashboardTrend(env, tenantId, questionnaireSlug, query = {}) {
  const sampleContext = await resolvePublicSampleContext(env, tenantId, questionnaireSlug, query);
  if (!sampleContext.ok) return sampleContext;

  const questionnaire = sampleContext.summaryResult.data?.questionnaire || {};
  if (!sampleContext.privacy.eligible) {
    return {
      ok: true,
      status: 200,
      data: {
        ...buildInsufficientPayload(questionnaire, sampleContext.sampleSize),
        trend: null,
      },
    };
  }

  const trendResult = await getTenantQuestionnaireAnalyticsTrend(env, tenantId, questionnaireSlug, query);
  if (!trendResult.ok) return trendResult;

  return {
    ok: true,
    status: 200,
    data: {
      status: 'ok',
      questionnaire: sanitizeQuestionnaireMeta(questionnaire),
      privacy: sampleContext.privacy,
      trend: sanitizeTrendPayload(trendResult.data),
    },
  };
}

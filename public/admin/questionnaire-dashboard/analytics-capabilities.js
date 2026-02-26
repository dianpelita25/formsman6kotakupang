const ADVANCED_VIZ_MODE_ORDER = Object.freeze(['criteria', 'likert', 'segment', 'benchmark', 'weekly', 'period']);

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQuestions(questions = []) {
  return Array.isArray(questions) ? questions : [];
}

function resolveTrendActiveDays(trendPoints = []) {
  return (Array.isArray(trendPoints) ? trendPoints : []).reduce((total, point) => {
    return total + (toFiniteNumber(point?.total, 0) > 0 ? 1 : 0);
  }, 0);
}

function resolveTotalQuestionsWithCriterion(normalizedQuestions, totalQuestionsWithCriterion) {
  const explicit = toFiniteNumber(totalQuestionsWithCriterion, NaN);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return Math.min(normalizedQuestions.length, Math.floor(explicit));
  }

  return normalizedQuestions.reduce((total, question) => {
    const criterion = String(question?.criterion || '').trim();
    return total + (criterion ? 1 : 0);
  }, 0);
}

function resolveSegmentAvailability(segmentSummary = null) {
  const dimensions = Array.isArray(segmentSummary?.dimensions) ? segmentSummary.dimensions : [];
  return dimensions.length > 0;
}

function resolveBenchmarkAvailability(benchmarkSummary = null) {
  const totalSchools = toFiniteNumber(benchmarkSummary?.totalSchools, 0);
  const schoolsWithResponses = toFiniteNumber(benchmarkSummary?.schoolsWithResponses, 0);
  return totalSchools >= 2 || schoolsWithResponses >= 2;
}

export function buildDashboardAnalyticsCapabilities({
  questions = [],
  totalQuestionsWithCriterion = 0,
  trendPoints = [],
  segmentSummary = null,
  benchmarkSummary = null,
} = {}) {
  const normalizedQuestions = normalizeQuestions(questions);
  const totalQuestions = normalizedQuestions.length;
  const criteriaCount = resolveTotalQuestionsWithCriterion(normalizedQuestions, totalQuestionsWithCriterion);
  const hasCriteria = criteriaCount > 0;
  const criteriaMode = !hasCriteria ? 'none' : criteriaCount >= totalQuestions ? 'full' : 'mixed';
  const criteriaCoverageRatio = totalQuestions > 0 ? criteriaCount / totalQuestions : 0;
  const criteriaCoveragePercent = Math.round(criteriaCoverageRatio * 100);

  const trendActiveDays = resolveTrendActiveDays(trendPoints);
  const trendRelevant = trendActiveDays >= 2;

  const hasSegment = resolveSegmentAvailability(segmentSummary);
  const hasBenchmark = resolveBenchmarkAvailability(benchmarkSummary);
  const advancedVizModeAvailability = {
    criteria: hasCriteria,
    likert: true,
    segment: hasSegment,
    benchmark: hasBenchmark,
    weekly: trendRelevant,
    period: trendRelevant,
  };
  const availableAdvancedVizModes = ADVANCED_VIZ_MODE_ORDER.filter((mode) => advancedVizModeAvailability[mode] !== false);

  return {
    totalQuestions,
    criteriaCount,
    hasCriteria,
    criteriaMode,
    criteriaCoverageRatio,
    criteriaCoveragePercent,
    trendActiveDays,
    trendRelevant,
    hasSegment,
    hasBenchmark,
    visualCardAvailability: {
      scaleAverage: true,
      radioDistribution: true,
      trend: trendRelevant,
      criteriaSummary: hasCriteria,
      advancedViz: true,
    },
    advancedVizModeAvailability,
    availableAdvancedVizModes,
  };
}

export function resolvePreferredAdvancedVizMode(currentMode, capabilities = null) {
  const availability = capabilities?.advancedVizModeAvailability || {};
  const preferred = String(currentMode || '').trim() || 'criteria';
  if (availability[preferred] !== false) {
    return preferred;
  }

  if (availability.criteria !== false) return 'criteria';
  if (availability.likert !== false) return 'likert';
  if (availability.segment !== false) return 'segment';
  if (availability.benchmark !== false) return 'benchmark';
  if (availability.weekly !== false) return 'weekly';
  if (availability.period !== false) return 'period';
  return 'likert';
}

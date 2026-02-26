const CONFIDENCE_HIGH_MIN = 150;
const CONFIDENCE_MEDIUM_MIN = 50;

const ALLOWED_CONFIDENCE = new Set(['low', 'medium', 'high', 'unknown']);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTrimmedString(value) {
  return String(value || '').trim();
}

function normalizeMeta(meta) {
  if (!meta) return null;
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta;
  if (typeof meta !== 'string') return null;
  try {
    const parsed = JSON.parse(meta);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveConfidenceFromSample(sampleSize) {
  const normalizedSample = toNumber(sampleSize, 0);
  if (normalizedSample <= 0) return 'unknown';
  if (normalizedSample >= CONFIDENCE_HIGH_MIN) return 'high';
  if (normalizedSample >= CONFIDENCE_MEDIUM_MIN) return 'medium';
  return 'low';
}

function resolveConfidence(explicitConfidence, sampleSize) {
  const explicit = toTrimmedString(explicitConfidence).toLowerCase();
  if (ALLOWED_CONFIDENCE.has(explicit)) {
    return explicit;
  }
  return resolveConfidenceFromSample(sampleSize);
}

function normalizeWarnings(rawWarnings) {
  if (!Array.isArray(rawWarnings)) return [];
  return rawWarnings.map((item) => toTrimmedString(item)).filter(Boolean);
}

function normalizeCriteriaSummary(distribution) {
  const raw = Array.isArray(distribution?.criteriaSummary) ? distribution.criteriaSummary : [];
  return raw
    .map((item) => ({
      criterion: toTrimmedString(item?.criterion) || 'Tanpa Kriteria',
      avgScale: toNumber(item?.avgScale, 0),
      totalQuestions: toNumber(item?.totalQuestions, 0),
    }))
    .filter((item) => item.totalQuestions > 0)
    .sort((a, b) => b.avgScale - a.avgScale);
}

function resolveCriteriaExtremes(criteriaSummary) {
  if (!criteriaSummary.length) {
    return {
      top: null,
      bottom: null,
      totalCriteria: 0,
    };
  }

  return {
    top: criteriaSummary[0] || null,
    bottom: criteriaSummary[criteriaSummary.length - 1] || null,
    totalCriteria: criteriaSummary.length,
  };
}

function resolveSegmentStats(distribution) {
  const dimensions = Array.isArray(distribution?.segmentSummary?.dimensions)
    ? distribution.segmentSummary.dimensions
    : [];
  const totalBuckets = dimensions.reduce((sum, dimension) => {
    const buckets = Array.isArray(dimension?.buckets) ? dimension.buckets : [];
    return sum + buckets.length;
  }, 0);
  return {
    totalDimensions: dimensions.length,
    totalBuckets,
  };
}

function buildFactLines({
  sampleSize,
  confidence,
  warnings,
  avgScaleOverall,
  topCriterion,
  bottomCriterion,
  segmentStats,
} = {}) {
  const facts = [];
  facts.push(`N respons = ${sampleSize}`);
  facts.push(`Confidence data = ${confidence}`);
  if (warnings.length) {
    facts.push(`Warnings data = ${warnings.join(', ')}`);
  }

  if (sampleSize > 0) {
    facts.push(`Rata-rata skala keseluruhan = ${avgScaleOverall.toFixed(2)}`);
  }

  if (topCriterion) {
    facts.push(
      `Kriteria tertinggi = ${topCriterion.criterion} (${topCriterion.avgScale.toFixed(2)}; ${topCriterion.totalQuestions} soal)`
    );
  }
  if (bottomCriterion && (!topCriterion || bottomCriterion.criterion !== topCriterion.criterion)) {
    facts.push(
      `Kriteria terendah = ${bottomCriterion.criterion} (${bottomCriterion.avgScale.toFixed(2)}; ${bottomCriterion.totalQuestions} soal)`
    );
  }

  if (segmentStats.totalDimensions > 0) {
    facts.push(`Segment aktif = ${segmentStats.totalDimensions} dimensi (${segmentStats.totalBuckets} bucket)`);
  }

  return facts;
}

function resolveAvailability({ sampleSize, avgScaleOverall, lastSubmittedAt, criteriaTotal, segmentDimensions }) {
  if (sampleSize > 0) return true;
  if (avgScaleOverall > 0) return true;
  if (toTrimmedString(lastSubmittedAt)) return true;
  if (criteriaTotal > 0) return true;
  if (segmentDimensions > 0) return true;
  return false;
}

export function buildAiGroundingPayload({
  meta = null,
  summary = null,
  distribution = null,
  questionnaireVersionId = null,
  filters = null,
} = {}) {
  const normalizedMeta = normalizeMeta(meta);
  const resolvedSummary = summary || normalizedMeta?.summary || {};
  const resolvedDistribution = distribution || normalizedMeta?.distribution || {};

  const sampleSize = toNumber(resolvedSummary?.totalResponses ?? normalizedMeta?.totalResponses, 0);
  const avgScaleOverall = toNumber(resolvedSummary?.avgScaleOverall, 0);
  const lastSubmittedAt = toTrimmedString(resolvedSummary?.lastSubmittedAt) || null;

  const explicitDataQuality = resolvedSummary?.dataQuality || resolvedDistribution?.dataQuality || {};
  const warnings = normalizeWarnings(explicitDataQuality?.warnings);
  const confidence = resolveConfidence(explicitDataQuality?.confidence, sampleSize);

  const criteriaSummary = normalizeCriteriaSummary(resolvedDistribution);
  const criteriaExtremes = resolveCriteriaExtremes(criteriaSummary);
  const segmentStats = resolveSegmentStats(resolvedDistribution);

  const normalizedFilters = {
    from: toTrimmedString(filters?.from || normalizedMeta?.filters?.from) || null,
    to: toTrimmedString(filters?.to || normalizedMeta?.filters?.to) || null,
  };
  const resolvedQuestionnaireVersionId =
    toTrimmedString(questionnaireVersionId || normalizedMeta?.questionnaireVersionId) || null;

  const available = resolveAvailability({
    sampleSize,
    avgScaleOverall,
    lastSubmittedAt,
    criteriaTotal: criteriaExtremes.totalCriteria,
    segmentDimensions: segmentStats.totalDimensions,
  });

  return {
    available,
    sampleSize,
    confidence,
    warnings,
    avgScaleOverall,
    lastSubmittedAt,
    questionnaireVersionId: resolvedQuestionnaireVersionId,
    filters: normalizedFilters,
    criteria: {
      total: criteriaExtremes.totalCriteria,
      top: criteriaExtremes.top,
      bottom: criteriaExtremes.bottom,
    },
    segment: segmentStats,
    facts: buildFactLines({
      sampleSize,
      confidence,
      warnings,
      avgScaleOverall,
      topCriterion: criteriaExtremes.top,
      bottomCriterion: criteriaExtremes.bottom,
      segmentStats,
    }),
  };
}

export function buildEmptyAiGroundingPayload({ questionnaireVersionId = null, filters = null } = {}) {
  return {
    available: false,
    sampleSize: 0,
    confidence: 'unknown',
    warnings: ['analysis_unavailable'],
    avgScaleOverall: 0,
    lastSubmittedAt: null,
    questionnaireVersionId: toTrimmedString(questionnaireVersionId) || null,
    filters: {
      from: toTrimmedString(filters?.from) || null,
      to: toTrimmedString(filters?.to) || null,
    },
    criteria: {
      total: 0,
      top: null,
      bottom: null,
    },
    segment: {
      totalDimensions: 0,
      totalBuckets: 0,
    },
    facts: [],
  };
}

function hasGroundedEvidenceBlock(text = '') {
  const normalized = toTrimmedString(text);
  if (!normalized) return false;
  const hasSection = /bukti data/i.test(normalized);
  const hasMarkers = /\[b1\]/i.test(normalized) && /\[b2\]/i.test(normalized) && /\[b3\]/i.test(normalized);
  const hasNumericSignal = /\d/.test(normalized);
  return hasSection && hasMarkers && hasNumericSignal;
}

function toUniqueFacts(values = []) {
  const seen = new Set();
  return values
    .map((item) => toTrimmedString(item))
    .filter((item) => {
      if (!item) return false;
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function buildSoftGuardFacts(payload = null) {
  const safePayload = payload && typeof payload === 'object' ? payload : buildEmptyAiGroundingPayload();
  const baseFacts = toUniqueFacts(Array.isArray(safePayload.facts) ? safePayload.facts : []);
  const fallbackFacts = toUniqueFacts([
    `N respons = ${toNumber(safePayload.sampleSize, 0)}`,
    `Confidence data = ${toTrimmedString(safePayload.confidence).toLowerCase() || 'unknown'}`,
    safePayload.avgScaleOverall > 0 ? `Rata-rata skala keseluruhan = ${toNumber(safePayload.avgScaleOverall, 0).toFixed(2)}` : '',
    safePayload.criteria?.top
      ? `Kriteria tertinggi = ${toTrimmedString(safePayload.criteria.top.criterion) || 'Tanpa Kriteria'} (${toNumber(
          safePayload.criteria.top.avgScale,
          0
        ).toFixed(2)})`
      : '',
    toNumber(safePayload.segment?.totalDimensions, 0) > 0
      ? `Segment aktif = ${toNumber(safePayload.segment.totalDimensions, 0)} dimensi (${toNumber(
          safePayload.segment.totalBuckets,
          0
        )} bucket)`
      : '',
    Array.isArray(safePayload.warnings) && safePayload.warnings.length
      ? `Warnings data = ${safePayload.warnings.map((item) => toTrimmedString(item)).filter(Boolean).join(', ')}`
      : '',
  ]);

  const mergedFacts = toUniqueFacts([...baseFacts, ...fallbackFacts]);
  if (mergedFacts.length >= 3) return mergedFacts.slice(0, 6);

  const minimumFacts = toUniqueFacts([
    ...mergedFacts,
    `N respons = ${toNumber(safePayload.sampleSize, 0)}`,
    `Confidence data = ${toTrimmedString(safePayload.confidence).toLowerCase() || 'unknown'}`,
    safePayload.lastSubmittedAt ? `Submit terakhir = ${toTrimmedString(safePayload.lastSubmittedAt)}` : 'Submit terakhir = -',
  ]);
  return minimumFacts.slice(0, 6);
}

function buildSoftGuardBlock(payload = null) {
  const safePayload = payload && typeof payload === 'object' ? payload : buildEmptyAiGroundingPayload();
  const facts = buildSoftGuardFacts(safePayload);
  if (!facts.length) return '';

  const lines = ['Bukti Data:'];
  facts.slice(0, Math.max(3, Math.min(6, facts.length))).forEach((fact, index) => {
    lines.push(`[B${index + 1}] ${fact}`);
  });

  const confidence = toTrimmedString(safePayload.confidence).toLowerCase();
  if (confidence === 'low' || confidence === 'unknown') {
    lines.push(`Catatan keterbatasan: confidence ${confidence || 'unknown'}, interpretasi perlu kehati-hatian.`);
  }

  return lines.join('\n');
}

export function applyAiGroundingSoftGuard(analysisText = '', grounding = null) {
  const normalizedAnalysis = toTrimmedString(analysisText);
  if (!normalizedAnalysis) return '';
  if (hasGroundedEvidenceBlock(normalizedAnalysis)) return normalizedAnalysis;

  const safeGrounding = grounding && typeof grounding === 'object' ? grounding : buildEmptyAiGroundingPayload();
  const evidenceBlock = buildSoftGuardBlock(safeGrounding);
  if (!evidenceBlock) return normalizedAnalysis;
  return `${normalizedAnalysis}\n\n${evidenceBlock}`.trim();
}

export function buildGroundingPromptTail(grounding = null) {
  const payload = grounding && typeof grounding === 'object' ? grounding : buildEmptyAiGroundingPayload();
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const facts = Array.isArray(payload.facts) ? payload.facts.filter(Boolean).slice(0, 6) : [];

  return [
    '',
    'Instruksi Wajib Grounding:',
    '- Semua klaim utama wajib menyebut angka sumber dari data yang diberikan.',
    '- Wajib ada bagian "Bukti Data" minimal 3 butir dengan format: [B1], [B2], [B3].',
    '- Jika confidence rendah atau data tidak cukup, tulis keterbatasan secara eksplisit.',
    '',
    'Data Grounding Ringkas:',
    `- sample_size: ${toNumber(payload.sampleSize, 0)}`,
    `- confidence: ${toTrimmedString(payload.confidence).toLowerCase() || 'unknown'}`,
    `- warnings: ${warnings.length ? warnings.join(', ') : 'tanpa_peringatan'}`,
    ...facts.map((fact, index) => `- fact_${index + 1}: ${fact}`),
  ].join('\n');
}

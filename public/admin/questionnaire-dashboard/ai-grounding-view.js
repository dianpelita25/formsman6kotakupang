const CONFIDENCE_LABELS = Object.freeze({
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Rendah',
  unknown: 'Belum diketahui',
});

const WARNING_LABELS = Object.freeze({
  low_sample_size: 'sampel kecil',
  segment_filtered: 'filter segment aktif',
  date_range_narrow: 'rentang tanggal sempit',
  stale_last_submission: 'data lama',
  analysis_unavailable: 'analisis belum tersedia',
});

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value) {
  return String(value || '').trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConfidence(value, sampleSize = 0) {
  const raw = toText(value).toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low' || raw === 'unknown') return raw;
  const safeSample = toNumber(sampleSize, 0);
  if (safeSample <= 0) return 'unknown';
  if (safeSample >= 150) return 'high';
  if (safeSample >= 50) return 'medium';
  return 'low';
}

function normalizeWarnings(warnings) {
  return toArray(warnings)
    .map((item) => toText(item))
    .filter(Boolean);
}

function formatWarningLabels(warnings) {
  if (!warnings.length) return 'tanpa peringatan';
  return warnings.map((warning) => WARNING_LABELS[warning] || warning).join(', ');
}

function shortenVersionId(value) {
  const normalized = toText(value);
  if (!normalized) return '-';
  if (normalized.length <= 10) return normalized;
  return `${normalized.slice(0, 8)}...`;
}

function normalizeCriterion(rawCriterion = null) {
  if (!rawCriterion || typeof rawCriterion !== 'object') return null;
  const criterion = toText(rawCriterion.criterion) || 'Tanpa Kriteria';
  return {
    criterion,
    avgScale: toNumber(rawCriterion.avgScale, 0),
    totalQuestions: toNumber(rawCriterion.totalQuestions, 0),
  };
}

function resolveFallbackGrounding(state = {}) {
  const summary = state.summary || {};
  const quality = summary.dataQuality || state.dataQuality || {};
  const criteriaSummary = toArray(state.criteriaSummary)
    .map((item) => ({
      criterion: toText(item?.criterion) || 'Tanpa Kriteria',
      avgScale: toNumber(item?.avgScale, 0),
      totalQuestions: toNumber(item?.totalQuestions, 0),
    }))
    .filter((item) => item.totalQuestions > 0)
    .sort((a, b) => b.avgScale - a.avgScale);
  const segmentDimensions = toArray(state.segmentSummary?.dimensions);
  const segmentBuckets = segmentDimensions.reduce((sum, dimension) => {
    return sum + toArray(dimension?.buckets).length;
  }, 0);

  return {
    available: toNumber(summary.totalResponses, 0) > 0,
    sampleSize: toNumber(summary.totalResponses, 0),
    confidence: normalizeConfidence(quality.confidence, summary.totalResponses),
    warnings: normalizeWarnings(quality.warnings),
    avgScaleOverall: toNumber(summary.avgScaleOverall, 0),
    lastSubmittedAt: toText(summary.lastSubmittedAt) || null,
    questionnaireVersionId: toText(state.questionnaireVersionId) || null,
    criteria: {
      top: criteriaSummary[0] || null,
      bottom: criteriaSummary[criteriaSummary.length - 1] || null,
    },
    segment: {
      totalDimensions: segmentDimensions.length,
      totalBuckets: segmentBuckets,
    },
  };
}

function resolveGrounding(sourceGrounding = null, state = {}, useFallback = true) {
  const source = sourceGrounding && typeof sourceGrounding === 'object' ? sourceGrounding : null;
  if (source && (source.available || toNumber(source.sampleSize, 0) > 0)) {
    return {
      available: Boolean(source.available),
      sampleSize: toNumber(source.sampleSize, 0),
      confidence: normalizeConfidence(source.confidence, source.sampleSize),
      warnings: normalizeWarnings(source.warnings),
      avgScaleOverall: toNumber(source.avgScaleOverall, 0),
      lastSubmittedAt: toText(source.lastSubmittedAt) || null,
      questionnaireVersionId: toText(source.questionnaireVersionId) || null,
      criteria: {
        top: normalizeCriterion(source.criteria?.top),
        bottom: normalizeCriterion(source.criteria?.bottom),
      },
      segment: {
        totalDimensions: toNumber(source.segment?.totalDimensions, 0),
        totalBuckets: toNumber(source.segment?.totalBuckets, 0),
      },
      facts: toArray(source.facts).map((item) => toText(item)).filter(Boolean),
    };
  }
  if (!useFallback) return null;
  return resolveFallbackGrounding(state);
}

function buildFacts(grounding, formatNumber, formatDateTime) {
  const facts = [];
  const top = grounding.criteria?.top;
  const bottom = grounding.criteria?.bottom;

  if (grounding.avgScaleOverall > 0) {
    facts.push(`Skor rata-rata keseluruhan: ${formatNumber(grounding.avgScaleOverall, 2)}.`);
  }
  if (top) {
    facts.push(
      `Kriteria tertinggi: ${top.criterion} (${formatNumber(top.avgScale, 2)} dari ${formatNumber(top.totalQuestions)} soal).`
    );
  }
  if (bottom && (!top || bottom.criterion !== top.criterion)) {
    facts.push(
      `Kriteria terendah: ${bottom.criterion} (${formatNumber(bottom.avgScale, 2)} dari ${formatNumber(bottom.totalQuestions)} soal).`
    );
  }
  if (grounding.segment.totalDimensions > 0) {
    facts.push(
      `Segment aktif: ${formatNumber(grounding.segment.totalDimensions)} dimensi dengan ${formatNumber(grounding.segment.totalBuckets)} bucket.`
    );
  }
  if (grounding.lastSubmittedAt) {
    facts.push(`Data terakhir masuk: ${formatDateTime(grounding.lastSubmittedAt)}.`);
  }
  if (!facts.length) {
    facts.push('Belum ada fakta tambahan yang bisa ditarik dari data saat ini.');
  }
  return facts.slice(0, 4);
}

export function createAiGroundingRenderer({
  state,
  aiGroundingEl,
  aiGroundingSummaryEl,
  aiGroundingFactsEl,
  formatNumber,
  formatDateTime,
} = {}) {
  function clearAiGrounding() {
    if (aiGroundingEl) aiGroundingEl.hidden = true;
    if (aiGroundingSummaryEl) aiGroundingSummaryEl.textContent = '';
    if (aiGroundingFactsEl) aiGroundingFactsEl.innerHTML = '';
  }

  function renderAiGrounding(sourceGrounding = null, { useFallback = true } = {}) {
    if (!aiGroundingEl || !aiGroundingSummaryEl || !aiGroundingFactsEl) return;
    const grounding = resolveGrounding(sourceGrounding, state, useFallback);
    if (!grounding || !grounding.available) {
      clearAiGrounding();
      return;
    }

    const warningsText = formatWarningLabels(grounding.warnings);
    const confidenceLabel = CONFIDENCE_LABELS[grounding.confidence] || CONFIDENCE_LABELS.unknown;
    aiGroundingSummaryEl.textContent =
      `Bukti data AI: N=${formatNumber(grounding.sampleSize)} | Confidence: ${confidenceLabel} | ` +
      `Versi: ${shortenVersionId(grounding.questionnaireVersionId)} | Peringatan: ${warningsText}.`;

    aiGroundingFactsEl.innerHTML = '';
    const facts = buildFacts(grounding, formatNumber, formatDateTime);
    facts.forEach((fact) => {
      const li = document.createElement('li');
      li.textContent = fact;
      aiGroundingFactsEl.append(li);
    });

    aiGroundingEl.hidden = false;
  }

  return {
    clearAiGrounding,
    renderAiGrounding,
  };
}

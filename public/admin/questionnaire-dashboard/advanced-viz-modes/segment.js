import { getDashboardThemePalette } from '../theme-palette.js';

const CONFIDENCE_LABELS = Object.freeze({
  high: 'tinggi',
  medium: 'sedang',
  low: 'rendah',
  unknown: 'belum diketahui',
});

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value) {
  return String(value || '').trim();
}

function resolveConfidence(rawConfidence, sampleSize) {
  const normalized = toText(rawConfidence).toLowerCase();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low' || normalized === 'unknown') {
    return normalized;
  }
  const safeSample = toNumber(sampleSize, 0);
  if (safeSample <= 0) return 'unknown';
  if (safeSample >= 150) return 'high';
  if (safeSample >= 50) return 'medium';
  return 'low';
}

function resolveBucketQuality(bucket) {
  const dataQuality = bucket?.dataQuality && typeof bucket.dataQuality === 'object' ? bucket.dataQuality : {};
  const sampleSize = toNumber(dataQuality.sampleSize, toNumber(bucket?.total, 0));
  const confidence = resolveConfidence(dataQuality.confidence, sampleSize);
  const warnings = Array.isArray(dataQuality.warnings) ? dataQuality.warnings.filter((item) => toText(item)) : [];
  return {
    sampleSize,
    confidence,
    warnings,
  };
}

function formatBucketQualityNote(bucket, formatNumber) {
  const quality = resolveBucketQuality(bucket);
  const confidenceLabel = CONFIDENCE_LABELS[quality.confidence] || CONFIDENCE_LABELS.unknown;
  const warningsText = quality.warnings.length ? `${quality.warnings.length} peringatan` : 'tanpa peringatan';
  return `N=${formatNumber(quality.sampleSize)} | confidence ${confidenceLabel} | ${warningsText}`;
}

function summarizeCompareQuality(compareBuckets = []) {
  const buckets = Array.isArray(compareBuckets) ? compareBuckets : [];
  if (!buckets.length) return '';
  const counters = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };
  let warningBuckets = 0;

  buckets.forEach((bucket) => {
    const quality = resolveBucketQuality(bucket);
    counters[quality.confidence] = Number(counters[quality.confidence] || 0) + 1;
    if (quality.warnings.length) {
      warningBuckets += 1;
    }
  });

  const dominantConfidence = ['high', 'medium', 'low', 'unknown'].reduce((best, candidate) => {
    return counters[candidate] > counters[best] ? candidate : best;
  }, 'unknown');
  const dominantCount = counters[dominantConfidence];
  const warningText = warningBuckets > 0 ? ` ${warningBuckets}/${buckets.length} bucket punya peringatan.` : '';
  return `Confidence compare dominan: ${CONFIDENCE_LABELS[dominantConfidence]} (${dominantCount}/${buckets.length}).${warningText}`;
}

export function renderSegmentMode({
  state,
  canvas,
  dimension,
  truncateText,
  formatNumber,
  advancedVizHelpEl,
  renderAdvancedVizInsights,
  onBucketClick,
} = {}) {
  if (!dimension) return false;
  const palette = getDashboardThemePalette();

  const metric = String(dimension.metric || '').trim() === 'avg_scale' ? 'avg_scale' : 'count';
  const compareResult = state.segmentCompareResult && state.segmentCompareResult.dimensionId === dimension.id ? state.segmentCompareResult : null;
  const baseBuckets = Array.isArray(dimension.buckets) ? dimension.buckets : [];
  const buckets = compareResult?.buckets?.length
    ? compareResult.buckets.map((bucket) => ({
        label: String(bucket.label || '').trim(),
        total: Number(bucket.totalResponses || 0),
        avgScale: Number(bucket.avgScaleOverall || 0),
        dataQuality: bucket?.dataQuality && typeof bucket.dataQuality === 'object' ? bucket.dataQuality : null,
      }))
    : baseBuckets;
  if (!buckets.length) return false;

  const labels = buckets.map((bucket) => truncateText(String(bucket.label || '-'), 36));
  const values = buckets.map((bucket) => (metric === 'avg_scale' ? Number(bucket.avgScale || 0) : Number(bucket.total || 0)));
  state.charts.advancedViz = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: metric === 'avg_scale' ? 'Rata-rata Skor' : 'Jumlah Respons',
          data: values,
          borderRadius: 8,
          backgroundColor: palette.primaryBackground,
          borderColor: palette.primaryBorder,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x:
          metric === 'avg_scale'
            ? { beginAtZero: true, max: 5, ticks: { color: palette.tickColor }, grid: { color: palette.gridColor } }
            : { beginAtZero: true, ticks: { precision: 0, color: palette.tickColor }, grid: { color: palette.gridColor } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const first = Array.isArray(items) && items.length ? items[0] : null;
              if (!first) return '-';
              return String(buckets[first.dataIndex]?.label || '-');
            },
          },
        },
      },
      onClick: (_, elements) => {
        const first = Array.isArray(elements) && elements.length ? elements[0] : null;
        if (!first) return;
        const bucket = buckets[first.index];
        if (!bucket || typeof onBucketClick !== 'function') return;
        onBucketClick({
          dimensionId: dimension.id,
          bucketLabel: String(bucket.label || '').trim(),
        });
      },
    },
  });

  const topIndex = values.reduce((best, value, index) => (value > values[best] ? index : best), 0);
  const bottomIndex = values.reduce((worst, value, index) => (value < values[worst] ? index : worst), 0);
  const top = buckets[topIndex] || null;
  const bottom = buckets[bottomIndex] || null;
  const compareQuality = summarizeCompareQuality(compareResult?.buckets || []);
  if (advancedVizHelpEl) {
    const compareNote = compareResult?.buckets?.length
      ? ` Menampilkan compare ${compareResult.buckets.length} bucket terpilih.`
      : '';
    const qualityNote = compareQuality ? ` ${compareQuality}` : '';
    advancedVizHelpEl.textContent = `Segmentasi aktif: ${dimension.label}. Klik batang untuk drilldown responses.${compareNote}${qualityNote}`;
  }

  if (metric === 'avg_scale') {
    const scoreGap = Math.max(0, Number((Number(top?.avgScale || 0) - Number(bottom?.avgScale || 0)).toFixed(2)));
    renderAdvancedVizInsights([
      {
        title: 'Segmen Skor Tertinggi',
        value: `${top?.label || '-'} (${formatNumber(top?.avgScale || 0, 2)})`,
        note: `${formatBucketQualityNote(top, formatNumber)} | sinyal area kuat pada dimensi ${dimension.label}.`,
        tone: 'good',
      },
      {
        title: 'Segmen Skor Terendah',
        value: `${bottom?.label || '-'} (${formatNumber(bottom?.avgScale || 0, 2)})`,
        note: `${formatBucketQualityNote(bottom, formatNumber)} | prioritas perbaikan bisa dimulai dari segmen ini.`,
        tone: 'warn',
      },
      {
        title: 'Gap Antar Bucket',
        value: formatNumber(scoreGap, 2),
        note:
          compareResult?.buckets?.length >= 2
            ? `Selisih skor tertinggi-terendah dari compare terpilih. ${compareQuality || ''}`.trim()
            : 'Selisih skor tertinggi-terendah pada seluruh bucket dimensi aktif.',
      },
    ]);
    return true;
  }

  const totalCount = values.reduce((sum, value) => sum + Number(value || 0), 0);
  const topShare = totalCount > 0 ? (Number(top?.total || 0) / totalCount) * 100 : 0;
  const countGap = Math.max(0, Number((Number(top?.total || 0) - Number(bottom?.total || 0)).toFixed(0)));
  renderAdvancedVizInsights([
    {
      title: 'Segmen Terbesar',
      value: `${top?.label || '-'} (${formatNumber(top?.total || 0)})`,
      note: `${formatBucketQualityNote(top, formatNumber)} | kontribusi ${formatNumber(topShare, 1)}% pada dimensi ${dimension.label}.`,
      tone: 'good',
    },
    {
      title: 'Segmen Terkecil',
      value: `${bottom?.label || '-'} (${formatNumber(bottom?.total || 0)})`,
      note: `${formatBucketQualityNote(bottom, formatNumber)} | bisa dipakai untuk evaluasi cakupan audiens.`,
    },
    {
      title: 'Gap Jumlah Respons',
      value: formatNumber(countGap),
      note:
        compareResult?.buckets?.length >= 2
          ? `Selisih jumlah respons terbesar-terkecil dari compare terpilih. ${compareQuality || ''}`.trim()
          : `Total respons tersegmentasi: ${formatNumber(totalCount)}.`,
    },
  ]);
  return true;
}

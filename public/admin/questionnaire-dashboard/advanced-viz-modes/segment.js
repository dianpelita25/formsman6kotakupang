import { getDashboardThemePalette } from '../theme-palette.js';

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
  if (advancedVizHelpEl) {
    const compareNote = compareResult?.buckets?.length
      ? ` Menampilkan compare ${compareResult.buckets.length} bucket terpilih.`
      : '';
    advancedVizHelpEl.textContent = `Segmentasi aktif: ${dimension.label}. Klik batang untuk drilldown responses.${compareNote}`;
  }

  if (metric === 'avg_scale') {
    renderAdvancedVizInsights([
      {
        title: 'Segmen Skor Tertinggi',
        value: `${top?.label || '-'} (${formatNumber(top?.avgScale || 0, 2)})`,
        note: `Sinyal area kuat pada dimensi ${dimension.label}.`,
        tone: 'good',
      },
      {
        title: 'Segmen Skor Terendah',
        value: `${bottom?.label || '-'} (${formatNumber(bottom?.avgScale || 0, 2)})`,
        note: 'Prioritas perbaikan bisa dimulai dari segmen ini.',
        tone: 'warn',
      },
      {
        title: 'Jumlah Bucket',
        value: formatNumber(buckets.length),
        note: 'Jumlah kelompok yang terdeteksi pada dimensi aktif.',
      },
    ]);
    return true;
  }

  const totalCount = values.reduce((sum, value) => sum + Number(value || 0), 0);
  const topShare = totalCount > 0 ? (Number(top?.total || 0) / totalCount) * 100 : 0;
  renderAdvancedVizInsights([
    {
      title: 'Segmen Terbesar',
      value: `${top?.label || '-'} (${formatNumber(top?.total || 0)})`,
      note: `Kontribusi ${formatNumber(topShare, 1)}% pada dimensi ${dimension.label}.`,
      tone: 'good',
    },
    {
      title: 'Segmen Terkecil',
      value: `${bottom?.label || '-'} (${formatNumber(bottom?.total || 0)})`,
      note: 'Bisa dipakai untuk evaluasi cakupan audiens.',
    },
    {
      title: 'Total Respons Tersegmentasi',
      value: formatNumber(totalCount),
      note: 'Akumulasi respons yang masuk ke bucket dimensi ini.',
    },
  ]);
  return true;
}

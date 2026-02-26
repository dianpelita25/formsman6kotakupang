import { getDashboardThemePalette } from '../theme-palette.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasScore(school) {
  return school?.avgScaleOverall != null && Number.isFinite(Number(school.avgScaleOverall));
}

function summarizeWarnings(school) {
  const warnings = Array.isArray(school?.dataQuality?.warnings) ? school.dataQuality.warnings : [];
  return warnings.length ? `${warnings.length} peringatan kualitas` : 'tanpa peringatan';
}

export function renderBenchmarkMode({
  state,
  canvas,
  formatNumber,
  truncateText,
  advancedVizHelpEl,
  renderAdvancedVizInsights,
} = {}) {
  const payload = state.schoolBenchmarkResult && typeof state.schoolBenchmarkResult === 'object' ? state.schoolBenchmarkResult : null;
  const schools = Array.isArray(payload?.schools) ? payload.schools : [];
  const summary = payload?.summary && typeof payload.summary === 'object' ? payload.summary : null;
  if (!summary || toNumber(summary.totalSchools, 0) < 2 || schools.length < 2) {
    return false;
  }

  const palette = getDashboardThemePalette();
  const rankedByScore = schools.filter((school) => hasScore(school));
  const useScoreMetric = rankedByScore.length >= 2;
  const metricLabel = useScoreMetric ? 'Skor rata-rata skala' : 'Jumlah respons';
  const ranked = [...schools].sort((left, right) => {
    const leftValue = useScoreMetric ? toNumber(left?.avgScaleOverall, -1) : toNumber(left?.totalResponses, 0);
    const rightValue = useScoreMetric ? toNumber(right?.avgScaleOverall, -1) : toNumber(right?.totalResponses, 0);
    if (rightValue !== leftValue) return rightValue - leftValue;
    return String(left?.tenantName || '').localeCompare(String(right?.tenantName || ''), 'id');
  });

  const topRows = ranked.slice(0, 8);
  const labels = topRows.map((school) => truncateText(String(school?.tenantName || school?.tenantSlug || '-'), 34));
  const values = topRows.map((school) =>
    useScoreMetric ? toNumber(school?.avgScaleOverall, 0) : toNumber(school?.totalResponses, 0)
  );

  state.charts.advancedViz = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: metricLabel,
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
        x: useScoreMetric
          ? { beginAtZero: true, max: 5, ticks: { color: palette.tickColor }, grid: { color: palette.gridColor } }
          : { beginAtZero: true, ticks: { precision: 0, color: palette.tickColor }, grid: { color: palette.gridColor } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const first = Array.isArray(items) && items.length ? items[0] : null;
              if (!first) return '-';
              return String(topRows[first.dataIndex]?.tenantName || '-');
            },
          },
        },
      },
    },
  });

  if (advancedVizHelpEl) {
    const metricNote = useScoreMetric
      ? 'Urutan berdasarkan skor rata-rata skala.'
      : 'Skor belum cukup untuk dibandingkan, fallback ke jumlah respons.';
    advancedVizHelpEl.textContent =
      `Benchmark antar sekolah (kuesioner sama): ${formatNumber(summary.schoolsWithResponses || 0)}/${formatNumber(summary.totalSchools || 0)} sekolah memiliki respons. ${metricNote}`;
  }

  const topSchool = ranked[0] || null;
  const bottomSchool = ranked[ranked.length - 1] || null;
  const gapValue = useScoreMetric
    ? Math.max(0, toNumber(topSchool?.avgScaleOverall, 0) - toNumber(bottomSchool?.avgScaleOverall, 0))
    : Math.max(0, toNumber(topSchool?.totalResponses, 0) - toNumber(bottomSchool?.totalResponses, 0));

  renderAdvancedVizInsights([
    {
      title: 'Sekolah Teratas',
      value: topSchool ? `${topSchool.tenantName} (${useScoreMetric ? formatNumber(topSchool.avgScaleOverall, 2) : formatNumber(topSchool.totalResponses)})` : '-',
      note: topSchool ? `N=${formatNumber(topSchool.totalResponses || 0)} | ${summarizeWarnings(topSchool)}` : 'Belum ada data.',
      tone: 'good',
    },
    {
      title: 'Sekolah Terbawah',
      value: bottomSchool ? `${bottomSchool.tenantName} (${useScoreMetric ? formatNumber(bottomSchool.avgScaleOverall, 2) : formatNumber(bottomSchool.totalResponses)})` : '-',
      note: bottomSchool ? `N=${formatNumber(bottomSchool.totalResponses || 0)} | ${summarizeWarnings(bottomSchool)}` : 'Belum ada data.',
      tone: 'warn',
    },
    {
      title: 'Gap Antar Sekolah',
      value: useScoreMetric ? formatNumber(gapValue, 2) : formatNumber(gapValue),
      note: `Total respons lintas sekolah: ${formatNumber(summary.totalResponses || 0)}.`,
    },
  ]);

  return true;
}

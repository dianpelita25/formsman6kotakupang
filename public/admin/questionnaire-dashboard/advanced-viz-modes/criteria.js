import { getDashboardThemePalette } from '../theme-palette.js';

export function renderCriteriaMode({
  state,
  canvas,
  rows,
  truncateText,
  formatNumber,
  advancedVizHelpEl,
  renderAdvancedVizInsights,
} = {}) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const palette = getDashboardThemePalette();

  const labels = rows.map((item) => truncateText(item.label, 26));
  state.charts.advancedViz = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Rata-rata Skala',
          yAxisID: 'y',
          data: rows.map((item) => item.avgScale),
          borderRadius: 8,
          backgroundColor: palette.primaryBackground,
          borderColor: palette.primaryBorder,
          borderWidth: 1,
        },
        {
          type: 'line',
          label: 'Jumlah Soal',
          yAxisID: 'y1',
          data: rows.map((item) => item.totalQuestions),
          borderColor: palette.secondaryBorder,
          backgroundColor: palette.secondaryBackground,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const first = Array.isArray(items) && items.length ? items[0] : null;
              return first ? rows[first.dataIndex]?.label || '-' : '-';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          ticks: { color: palette.tickColor },
          grid: { color: palette.gridColor },
          title: { display: true, text: 'Skor rata-rata' },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          ticks: { color: palette.tickColor },
          grid: { drawOnChartArea: false, color: palette.gridColor },
          title: { display: true, text: 'Jumlah soal' },
        },
      },
    },
  });

  const highest = rows[0];
  const lowest = rows[rows.length - 1];
  const avgGlobal = rows.reduce((sum, item) => sum + item.avgScale, 0) / rows.length;
  if (advancedVizHelpEl) {
    advancedVizHelpEl.textContent = `${rows.length} kelompok kriteria divisualkan untuk membandingkan kualitas (skor) dan cakupan (jumlah soal).`;
  }
  renderAdvancedVizInsights([
    {
      title: 'Kriteria Tertinggi',
      value: `${highest.label} (${formatNumber(highest.avgScale, 2)})`,
      note: `Soal: ${formatNumber(highest.totalQuestions)} | Respons skala: ${formatNumber(highest.totalScaleAnswered)}`,
      tone: 'good',
    },
    {
      title: 'Kriteria Terendah',
      value: `${lowest.label} (${formatNumber(lowest.avgScale, 2)})`,
      note: `Prioritas evaluasi berikutnya bisa dimulai dari kelompok ini.`,
      tone: 'warn',
    },
    {
      title: 'Rata-rata Global Kriteria',
      value: formatNumber(avgGlobal, 2),
      note: `Dihitung dari ${formatNumber(rows.length)} kelompok kriteria pada filter aktif.`,
    },
  ]);
  return true;
}

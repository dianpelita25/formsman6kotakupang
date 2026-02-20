import { getDashboardThemePalette } from '../theme-palette.js';

export function renderWeeklyMode({
  state,
  canvas,
  weekly,
  formatNumber,
  advancedVizHelpEl,
  renderAdvancedVizInsights,
} = {}) {
  if (!weekly || Number(weekly.totalResponses || 0) <= 0) return false;
  const palette = getDashboardThemePalette();

  state.charts.advancedViz = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: weekly.labels,
      datasets: [
        {
          label: 'Rata-rata respons per hari',
          data: weekly.averages,
          borderColor: palette.trendLine,
          backgroundColor: palette.trendFill,
          pointBackgroundColor: palette.pointBackground,
          pointBorderColor: palette.pointBorder,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          ticks: {
            backdropColor: 'transparent',
            color: palette.tickColor,
          },
          grid: { color: palette.gridColor },
          angleLines: { color: palette.gridColor },
          pointLabels: { color: palette.tickColor },
        },
      },
    },
  });

  const peakValue = Math.max(...weekly.averages);
  const peakIndex = weekly.averages.findIndex((value) => value === peakValue);
  const activeDays = weekly.totals.filter((value) => value > 0).length;
  const totalDays = weekly.samples.reduce((sum, value) => sum + value, 0);
  if (advancedVizHelpEl) {
    advancedVizHelpEl.textContent = `Radar menunjukkan rata-rata respons per hari (berdasarkan rentang tren ${formatNumber(totalDays)} hari).`;
  }
  renderAdvancedVizInsights([
    {
      title: 'Hari Paling Aktif',
      value: `${weekly.labels[Math.max(0, peakIndex)]} (${formatNumber(peakValue, 2)})`,
      note: 'Nilai adalah rata-rata respons pada hari tersebut.',
      tone: 'good',
    },
    {
      title: 'Hari Aktif',
      value: `${formatNumber(activeDays)} / 7`,
      note: 'Jumlah hari yang memiliki respons lebih dari 0.',
    },
    {
      title: 'Total Respons Tren',
      value: formatNumber(weekly.totalResponses),
      note: 'Akumulasi respons pada rentang tren yang sedang ditampilkan.',
    },
  ]);
  return true;
}

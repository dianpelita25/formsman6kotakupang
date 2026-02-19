export function renderPeriodMode({
  state,
  canvas,
  comparison,
  formatNumber,
  advancedVizHelpEl,
  renderAdvancedVizInsights,
} = {}) {
  if (!comparison) return false;

  const previousLabel = `Periode Sebelumnya (${comparison.previousCount} hari)`;
  const currentLabel = `Periode Saat Ini (${comparison.currentCount} hari)`;
  state.charts.advancedViz = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [previousLabel, currentLabel],
      datasets: [
        {
          label: 'Total Respons',
          data: [comparison.previousTotal, comparison.currentTotal],
          borderRadius: 10,
          backgroundColor: ['rgba(126, 155, 255, 0.58)', 'rgba(47, 198, 229, 0.68)'],
          borderColor: ['rgba(126, 155, 255, 1)', 'rgba(47, 198, 229, 1)'],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });

  const directionLabel = comparison.deltaPct > 0 ? 'Naik' : comparison.deltaPct < 0 ? 'Turun' : 'Stabil (0%)';
  if (advancedVizHelpEl) {
    advancedVizHelpEl.textContent =
      'Perbandingan otomatis antara setengah awal dan setengah akhir dari rentang tren aktif.';
  }
  renderAdvancedVizInsights([
    {
      title: 'Perubahan Total Respons',
      value: `${directionLabel} ${formatNumber(Math.abs(comparison.deltaPct), 2)}%`,
      note: `${formatNumber(comparison.previousTotal)} -> ${formatNumber(comparison.currentTotal)} respons`,
      tone: comparison.deltaPct >= 0 ? 'good' : 'warn',
    },
    {
      title: 'Rata-rata Harian Sebelumnya',
      value: formatNumber(comparison.previousAvgDaily, 2),
      note: `Dari ${formatNumber(comparison.previousCount)} hari awal pada rentang tren.`,
    },
    {
      title: 'Rata-rata Harian Saat Ini',
      value: formatNumber(comparison.currentAvgDaily, 2),
      note: `Dari ${formatNumber(comparison.currentCount)} hari akhir pada rentang tren.`,
      tone: comparison.currentAvgDaily >= comparison.previousAvgDaily ? 'good' : 'warn',
    },
  ]);
  return true;
}

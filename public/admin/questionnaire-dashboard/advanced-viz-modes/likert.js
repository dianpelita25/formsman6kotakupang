export function renderLikertMode({
  state,
  canvas,
  likert,
  formatNumber,
  advancedVizHelpEl,
  renderAdvancedVizInsights,
} = {}) {
  if (!likert || Number(likert.totalAnswers || 0) <= 0) return false;

  const labels = ['Skor 1', 'Skor 2', 'Skor 3', 'Skor 4', 'Skor 5'];
  state.charts.advancedViz = new Chart(canvas, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [
        {
          label: 'Total jawaban',
          data: likert.totals,
          backgroundColor: ['#1f6feb', '#2276f5', '#2d9bff', '#2bd4f6', '#2ce3a8'],
          borderColor: 'rgba(8, 18, 36, 0.6)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
        },
      },
    },
  });

  const dominantIndex = likert.totals.reduce((best, value, index) => (value > likert.totals[best] ? index : best), 0);
  const dominantTotal = likert.totals[dominantIndex] || 0;
  const dominantPercent = likert.totalAnswers > 0 ? (dominantTotal / likert.totalAnswers) * 100 : 0;
  if (advancedVizHelpEl) {
    advancedVizHelpEl.textContent = `Sebaran seluruh jawaban skala 1-5. Total terbaca: ${formatNumber(likert.totalAnswers)} jawaban.`;
  }
  renderAdvancedVizInsights([
    {
      title: 'Skor Dominan',
      value: `${labels[dominantIndex]} (${formatNumber(dominantTotal)})`,
      note: `Kontribusi ${formatNumber(dominantPercent, 1)}% dari total jawaban skala.`,
      tone: dominantIndex >= 3 ? 'good' : 'warn',
    },
    {
      title: 'Skor Tinggi (4-5)',
      value: formatNumber((likert.totals[3] || 0) + (likert.totals[4] || 0)),
      note: `Akumulasi respon positif untuk membaca kepuasan umum.`,
      tone: 'good',
    },
    {
      title: 'Skor Rendah (1-2)',
      value: formatNumber((likert.totals[0] || 0) + (likert.totals[1] || 0)),
      note: `Gunakan untuk menentukan area perbaikan prioritas.`,
      tone: 'warn',
    },
  ]);
  return true;
}

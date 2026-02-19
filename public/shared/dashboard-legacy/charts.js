export function createChartsModule(config = {}) {
  const {
    apiBase,
    requestJson,
    normalizeError,
    setStatus,
    formatScore,
    dom,
  } = config;

  const {
    kpiTotal,
    kpiQ12,
    kpiInterest,
    kpiAi,
    q10Breakdown,
    adoptionScore,
    adoptionLabel,
    adoptionGauge,
    adoptionRadar,
    adoptionQ7,
    adoptionQ8,
    adoptionQ9,
    adoptionQ11,
    adoptionBarQ7,
    adoptionBarQ8,
    adoptionBarQ9,
    adoptionBarQ11,
  } = dom;

  let adoptionRadarChart;

  function renderQ10Breakdown(items, totalResponses) {
    if (!q10Breakdown) return;

    q10Breakdown.innerHTML = '';
    const total = Number(totalResponses) || 0;

    items.forEach((item) => {
      const percent = total ? (item.total / total) * 100 : 0;
      const row = document.createElement('li');
      row.innerHTML = `<span>${item.label}</span><span>${item.total} (${percent.toFixed(1)}%)</span>`;
      q10Breakdown.append(row);
    });
  }

  function buildAdoptionRadar(values) {
    if (!adoptionRadar) return;

    const labels = ['Q7', 'Q8', 'Q9', 'Q11'];
    const data = [values.q7, values.q8, values.q9, values.q11];

    if (adoptionRadarChart) {
      adoptionRadarChart.destroy();
    }

    adoptionRadarChart = new Chart(adoptionRadar, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Kesiapan Adopsi',
            data,
            borderColor: 'rgba(48, 228, 255, 0.9)',
            backgroundColor: 'rgba(48, 228, 255, 0.15)',
            pointBackgroundColor: '#30e4ff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: { color: '#94aad0', backdropColor: 'transparent' },
            grid: { color: 'rgba(130,170,255,0.15)' },
            angleLines: { color: 'rgba(130,170,255,0.15)' },
            pointLabels: { color: '#cfe2ff' },
          },
        },
      },
    });
  }

  function renderAdoptionIndex(averages) {
    if (!adoptionScore || !adoptionLabel) return;

    const q7 = Number(averages?.q7 ?? 0);
    const q8 = Number(averages?.q8 ?? 0);
    const q9 = Number(averages?.q9 ?? 0);
    const q11 = Number(averages?.q11 ?? 0);
    const index = (q7 + q8 + q9 + q11) / 4;

    adoptionScore.textContent = formatScore(index);
    if (adoptionQ7) adoptionQ7.textContent = formatScore(q7);
    if (adoptionQ8) adoptionQ8.textContent = formatScore(q8);
    if (adoptionQ9) adoptionQ9.textContent = formatScore(q9);
    if (adoptionQ11) adoptionQ11.textContent = formatScore(q11);

    adoptionLabel.classList.remove('is-low', 'is-mid');
    if (adoptionGauge) {
      const pct = Math.max(0, Math.min(100, (index / 5) * 100));
      adoptionGauge.style.setProperty('--progress', `${pct}%`);
    }

    const setBar = (el, value) => {
      if (!el) return;
      const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100));
      el.style.width = `${pct}%`;
    };

    setBar(adoptionBarQ7, q7);
    setBar(adoptionBarQ8, q8);
    setBar(adoptionBarQ9, q9);
    setBar(adoptionBarQ11, q11);

    if (index >= 4) {
      adoptionLabel.textContent = 'Siap';
      if (adoptionGauge) adoptionGauge.style.setProperty('--gauge-color', '#34e3b9');
    } else if (index >= 2) {
      adoptionLabel.textContent = 'Cukup';
      adoptionLabel.classList.add('is-mid');
      if (adoptionGauge) adoptionGauge.style.setProperty('--gauge-color', '#facc15');
    } else {
      adoptionLabel.textContent = 'Belum';
      adoptionLabel.classList.add('is-low');
      if (adoptionGauge) adoptionGauge.style.setProperty('--gauge-color', '#f87171');
    }

    buildAdoptionRadar({ q7, q8, q9, q11 });
  }

  function buildAvgChart(values) {
    const labels = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q11', 'Q12'];
    const dataset = labels.map((label) => values[label.toLowerCase()] ?? 0);

    new Chart(document.getElementById('avgChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Rata-rata Skor',
            data: dataset,
            backgroundColor: 'rgba(48, 228, 255, 0.45)',
            borderColor: 'rgba(48, 228, 255, 0.95)',
            borderWidth: 1.5,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 5, ticks: { color: '#b9d4ff' }, grid: { color: 'rgba(130,170,255,0.15)' } },
          x: { ticks: { color: '#b9d4ff' }, grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  function buildQ10Chart(items) {
    new Chart(document.getElementById('q10Chart'), {
      type: 'doughnut',
      data: {
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.total),
            backgroundColor: ['#22d3ee', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#cfe2ff', boxWidth: 12 },
          },
        },
      },
    });
  }

  async function loadDashboard() {
    setStatus('Memuat analytics...');

    try {
      const [summaryJson, distributionJson] = await Promise.all([
        requestJson(`${apiBase}/analytics/summary`),
        requestJson(`${apiBase}/analytics/distribution`),
      ]);

      const summary = summaryJson.data;
      const distribution = distributionJson.data;

      if (kpiTotal) kpiTotal.textContent = summary.totalResponses;
      if (kpiQ12) kpiQ12.textContent = formatScore(summary.avgQ12);
      if (kpiInterest) kpiInterest.textContent = `${summary.interestedPct.toFixed(2)}%`;
      if (kpiAi) kpiAi.textContent = formatScore(summary.avgAiAdoption);

      buildAvgChart(distribution.questionAverages);
      buildQ10Chart(distribution.q10Distribution);
      renderQ10Breakdown(distribution.q10Distribution, summary.totalResponses);
      renderAdoptionIndex(distribution.questionAverages);

      if (!summary.totalResponses) {
        setStatus('Belum ada data submission. Silakan kirim 1 feedback dari form untuk melihat visual.', false);
        return;
      }

      setStatus('Analytics berhasil dimuat.');
    } catch (error) {
      const normalized = normalizeError(error, 'Gagal memuat dashboard analytics.');
      setStatus(normalized.message, true, error);
    }
  }

  return {
    loadDashboard,
  };
}

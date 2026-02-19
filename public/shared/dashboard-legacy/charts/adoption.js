export function createAdoptionRenderer({ dom, formatScore }) {
  const {
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

  return {
    renderAdoptionIndex,
  };
}

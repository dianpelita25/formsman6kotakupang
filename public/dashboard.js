const statusEl = document.getElementById('status');

const kpiTotal = document.getElementById('kpi-total');
const kpiQ12 = document.getElementById('kpi-q12');
const kpiInterest = document.getElementById('kpi-interest');
const kpiAi = document.getElementById('kpi-ai');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `status${isError ? ' error' : ''}`;
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

function buildTrendChart(points) {
  new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: points.map((item) => item.day),
      datasets: [
        {
          label: 'Submission / Hari',
          data: points.map((item) => item.total),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, ticks: { color: '#b9d4ff' }, grid: { color: 'rgba(130,170,255,0.15)' } },
        x: { ticks: { color: '#b9d4ff', maxRotation: 0, autoSkip: true }, grid: { display: false } },
      },
      plugins: {
        legend: { labels: { color: '#cfe2ff' } },
      },
    },
  });
}

async function loadDashboard() {
  setStatus('Memuat analytics...');

  try {
    const [summaryRes, distributionRes, trendRes] = await Promise.all([
      fetch('./api/analytics/summary'),
      fetch('./api/analytics/distribution'),
      fetch('./api/analytics/trend?days=30'),
    ]);

    const parseOrNull = async (response) => {
      try {
        return await response.json();
      } catch {
        return null;
      }
    };

    const summaryJson = await parseOrNull(summaryRes);
    const distributionJson = await parseOrNull(distributionRes);
    const trendJson = await parseOrNull(trendRes);

    if (!summaryRes.ok || !distributionRes.ok || !trendRes.ok) {
      const errorMessage =
        summaryJson?.message ||
        distributionJson?.message ||
        trendJson?.message ||
        'Sebagian data analytics gagal dimuat.';
      throw new Error(errorMessage);
    }

    const summary = summaryJson.data;
    const distribution = distributionJson.data;
    const trend = trendJson.data;

    kpiTotal.textContent = summary.totalResponses;
    kpiQ12.textContent = summary.avgQ12.toFixed(2);
    kpiInterest.textContent = `${summary.interestedPct.toFixed(2)}%`;
    kpiAi.textContent = summary.avgAiAdoption.toFixed(2);

    buildAvgChart(distribution.questionAverages);
    buildQ10Chart(distribution.q10Distribution);
    buildTrendChart(trend.points);

    if (!summary.totalResponses) {
      setStatus('Belum ada data submission. Silakan kirim 1 feedback dari form untuk melihat visual.', false);
      return;
    }

    setStatus('Analytics berhasil dimuat.');
  } catch (error) {
    setStatus(error.message || 'Gagal memuat dashboard analytics.', true);
  }
}

loadDashboard();

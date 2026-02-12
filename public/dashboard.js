const statusEl = document.getElementById('status');

const kpiTotal = document.getElementById('kpi-total');
const kpiQ12 = document.getElementById('kpi-q12');
const kpiInterest = document.getElementById('kpi-interest');
const kpiAi = document.getElementById('kpi-ai');
const kpiQ7 = document.getElementById('kpi-q7');
const kpiQ8 = document.getElementById('kpi-q8');
const kpiQ9 = document.getElementById('kpi-q9');

const q10Breakdown = document.getElementById('q10-breakdown');
const aiRunBtn = document.getElementById('ai-run');
const aiDaysSelect = document.getElementById('ai-days');
const aiOutput = document.getElementById('ai-output');
const aiStatus = document.getElementById('ai-status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `status${isError ? ' error' : ''}`;
}

function setAiStatus(message, isError = false) {
  if (!aiStatus) return;
  aiStatus.textContent = message;
  aiStatus.className = `status${isError ? ' error' : ''}`;
}

function formatScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

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
    kpiQ12.textContent = formatScore(summary.avgQ12);
    kpiInterest.textContent = `${summary.interestedPct.toFixed(2)}%`;
    kpiAi.textContent = formatScore(summary.avgAiAdoption);
    if (kpiQ7) kpiQ7.textContent = formatScore(distribution.questionAverages.q7);
    if (kpiQ8) kpiQ8.textContent = formatScore(distribution.questionAverages.q8);
    if (kpiQ9) kpiQ9.textContent = formatScore(distribution.questionAverages.q9);

    buildAvgChart(distribution.questionAverages);
    buildQ10Chart(distribution.q10Distribution);
    buildTrendChart(trend.points);
    renderQ10Breakdown(distribution.q10Distribution, summary.totalResponses);

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

async function runAiAnalysis() {
  if (!aiRunBtn) return;

  const days = Number(aiDaysSelect?.value ?? 30) || 30;
  aiRunBtn.disabled = true;
  setAiStatus('Menjalankan analisa AI...');
  if (aiOutput) aiOutput.textContent = 'Sedang memproses data...';

  try {
    const response = await fetch('./api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ days }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || 'Gagal menjalankan analisa AI.');
    }

    if (aiOutput) {
      aiOutput.textContent = payload.analysis || 'Tidak ada hasil analisa.';
    }
    setAiStatus('Analisa selesai.');
  } catch (error) {
    if (aiOutput) aiOutput.textContent = 'Analisa gagal diproses.';
    setAiStatus(error.message || 'Analisa gagal.', true);
  } finally {
    aiRunBtn.disabled = false;
  }
}

if (aiRunBtn) {
  aiRunBtn.addEventListener('click', runAiAnalysis);
}

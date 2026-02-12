const statusEl = document.getElementById('status');

const kpiTotal = document.getElementById('kpi-total');
const kpiQ12 = document.getElementById('kpi-q12');
const kpiInterest = document.getElementById('kpi-interest');
const kpiAi = document.getElementById('kpi-ai');

const q10Breakdown = document.getElementById('q10-breakdown');
const aiRunBtn = document.getElementById('ai-run');
const aiOutput = document.getElementById('ai-output');
const aiStatus = document.getElementById('ai-status');

const adoptionScore = document.getElementById('adoption-score');
const adoptionLabel = document.getElementById('adoption-label');
const adoptionQ7 = document.getElementById('adoption-q7');
const adoptionQ8 = document.getElementById('adoption-q8');
const adoptionQ9 = document.getElementById('adoption-q9');
const adoptionQ11 = document.getElementById('adoption-q11');

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
  if (index >= 4) {
    adoptionLabel.textContent = 'Siap';
  } else if (index >= 2) {
    adoptionLabel.textContent = 'Cukup';
    adoptionLabel.classList.add('is-mid');
  } else {
    adoptionLabel.textContent = 'Belum';
    adoptionLabel.classList.add('is-low');
  }
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
    const [summaryRes, distributionRes] = await Promise.all([
      fetch('./api/analytics/summary'),
      fetch('./api/analytics/distribution'),
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
    if (!summaryRes.ok || !distributionRes.ok) {
      const errorMessage =
        summaryJson?.message ||
        distributionJson?.message ||
        'Sebagian data analytics gagal dimuat.';
      throw new Error(errorMessage);
    }

    const summary = summaryJson.data;
    const distribution = distributionJson.data;

    kpiTotal.textContent = summary.totalResponses;
    kpiQ12.textContent = formatScore(summary.avgQ12);
    kpiInterest.textContent = `${summary.interestedPct.toFixed(2)}%`;
    kpiAi.textContent = formatScore(summary.avgAiAdoption);

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
    setStatus(error.message || 'Gagal memuat dashboard analytics.', true);
  }
}

loadDashboard();

async function runAiAnalysis() {
  if (!aiRunBtn) return;

  aiRunBtn.disabled = true;
  setAiStatus('Menjalankan analisa AI...');
  if (aiOutput) aiOutput.textContent = 'Sedang memproses data...';

  try {
    const response = await fetch('./api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

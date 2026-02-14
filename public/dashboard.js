const statusEl = document.getElementById('status');

const kpiTotal = document.getElementById('kpi-total');
const kpiQ12 = document.getElementById('kpi-q12');
const kpiInterest = document.getElementById('kpi-interest');
const kpiAi = document.getElementById('kpi-ai');

const q10Breakdown = document.getElementById('q10-breakdown');
const aiRunBtn = document.getElementById('ai-run');
const aiOutput = document.getElementById('ai-output');
const aiStatus = document.getElementById('ai-status');
const aiDownloadPdfBtn = document.getElementById('ai-download-pdf');

const adoptionScore = document.getElementById('adoption-score');
const adoptionLabel = document.getElementById('adoption-label');
const adoptionGauge = document.getElementById('adoption-gauge');
const adoptionRadar = document.getElementById('adoptionRadar');
const adoptionQ7 = document.getElementById('adoption-q7');
const adoptionQ8 = document.getElementById('adoption-q8');
const adoptionQ9 = document.getElementById('adoption-q9');
const adoptionQ11 = document.getElementById('adoption-q11');
const adoptionBarQ7 = document.getElementById('adoption-bar-q7');
const adoptionBarQ8 = document.getElementById('adoption-bar-q8');
const adoptionBarQ9 = document.getElementById('adoption-bar-q9');
const adoptionBarQ11 = document.getElementById('adoption-bar-q11');

let adoptionRadarChart;
let latestAnalysisState = {
  analysis: '',
  meta: null,
  createdAt: null,
};

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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hasAnalysisText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function refreshAiPdfButtonState() {
  if (!aiDownloadPdfBtn) return;
  aiDownloadPdfBtn.disabled = !hasAnalysisText(latestAnalysisState.analysis);
}

function applyLatestAnalysisState(nextState) {
  latestAnalysisState = {
    analysis: nextState?.analysis || '',
    meta: nextState?.meta || null,
    createdAt: nextState?.createdAt || null,
  };

  if (aiOutput) {
    aiOutput.textContent = hasAnalysisText(latestAnalysisState.analysis)
      ? latestAnalysisState.analysis
      : 'Belum ada analisa.';
  }

  refreshAiPdfButtonState();
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

loadDashboard();

async function runAiAnalysis() {
  if (!aiRunBtn) return;

  const previousState = { ...latestAnalysisState };
  aiRunBtn.disabled = true;
  if (aiDownloadPdfBtn) aiDownloadPdfBtn.disabled = true;
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

    applyLatestAnalysisState(payload);
    const analyzedAt = formatDateTime(payload?.createdAt);
    setAiStatus(`Analisa selesai. Tersimpan pada ${analyzedAt}.`);
    localStorage.setItem('ai-latest-analysis', payload.analysis || '');
  } catch (error) {
    applyLatestAnalysisState(previousState);
    setAiStatus(error.message || 'Analisa gagal.', true);
  } finally {
    aiRunBtn.disabled = false;
    refreshAiPdfButtonState();
  }
}

if (aiRunBtn) {
  aiRunBtn.addEventListener('click', runAiAnalysis);
}

async function loadLatestAi() {
  if (!aiOutput) return;

  try {
    const response = await fetch('./api/ai/latest');
    if (response.status === 401) {
      applyLatestAnalysisState({ analysis: '', meta: null, createdAt: null });
      setAiStatus('Analisa terakhir tidak bisa dimuat (Unauthorized).', true);
      return;
    }

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      applyLatestAnalysisState(payload);
      if (payload?.analysis) {
        localStorage.setItem('ai-latest-analysis', payload.analysis);
        setAiStatus(`Menampilkan analisa terakhir (${formatDateTime(payload?.createdAt)}).`);
      } else {
        setAiStatus('Belum ada analisa tersimpan.');
      }
      return;
    }
  } catch {
    // ignore and fallback to local storage
  }

  const cached = localStorage.getItem('ai-latest-analysis');
  if (cached) {
    applyLatestAnalysisState({ analysis: cached, meta: null, createdAt: null });
    setAiStatus('Menampilkan analisa cache lokal (offline).');
    return;
  }

  applyLatestAnalysisState({ analysis: '', meta: null, createdAt: null });
}

loadLatestAi();

function buildAiMetadataLines(meta) {
  const summary = meta?.summary || {};
  const totalResponses = Number(summary?.totalResponses ?? meta?.totalResponses ?? 0);
  const avgQ12 = formatScore(summary?.avgQ12);
  const avgAiAdoption = formatScore(summary?.avgAiAdoption);
  const interestedPct = Number(summary?.interestedPct ?? 0);

  return [
    `Total Responden: ${totalResponses}`,
    `Rata-rata Kepuasan (Q12): ${avgQ12}`,
    `Skor Adopsi AI: ${avgAiAdoption}`,
    `Minat Pelatihan Lanjutan: ${interestedPct.toFixed(2)}%`,
  ];
}

async function downloadAiPdf() {
  if (!aiDownloadPdfBtn) return;

  const analysisText = latestAnalysisState.analysis?.trim();
  if (!analysisText) {
    setAiStatus('Belum ada analisa untuk diunduh.', true);
    refreshAiPdfButtonState();
    return;
  }

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    setAiStatus('Library PDF belum siap.', true);
    return;
  }

  aiDownloadPdfBtn.disabled = true;

  try {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const margin = 14;
    const lineHeight = 7;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (neededHeight = lineHeight) => {
      if (y + neededHeight <= pageHeight - margin) return;
      pdf.addPage();
      y = margin;
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('Laporan Analisa AI', margin, y);
    y += lineHeight + 1;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const analyzedAt = formatDateTime(latestAnalysisState.createdAt);
    pdf.text(`Waktu Analisa: ${analyzedAt}`, margin, y);
    y += lineHeight + 1;

    const metaLines = buildAiMetadataLines(latestAnalysisState.meta);
    metaLines.forEach((line) => {
      ensureSpace(lineHeight);
      pdf.text(line, margin, y);
      y += lineHeight;
    });

    y += 2;
    ensureSpace(lineHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Hasil Analisa', margin, y);
    y += lineHeight;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const wrapped = pdf.splitTextToSize(analysisText, contentWidth);
    wrapped.forEach((line) => {
      ensureSpace(lineHeight);
      pdf.text(line, margin, y);
      y += lineHeight;
    });

    const filename = `analisa-ai-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
    setAiStatus('PDF analisa berhasil diunduh.');
  } catch (error) {
    setAiStatus(error?.message || 'Gagal membuat PDF analisa.', true);
  } finally {
    refreshAiPdfButtonState();
  }
}

if (aiDownloadPdfBtn) {
  aiDownloadPdfBtn.addEventListener('click', downloadAiPdf);
}

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
const aiSubtitle = document.getElementById('ai-subtitle');
const aiGroupInternalBtn = document.getElementById('ai-group-internal');
const aiGroupExternalBtn = document.getElementById('ai-group-external');
const aiGroupLiveBtn = document.getElementById('ai-group-live');
const aiExternalLabel = document.getElementById('ai-external-label');
const aiExternalAudienceSelect = document.getElementById('ai-external-audience');

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
let activeAnalysisGroup = 'internal';
let activeExternalAudience = 'pemerintah';
let latestAnalysisState = {
  mode: 'internal',
  analysis: '',
  meta: null,
  createdAt: null,
};

const AI_MODES = Object.freeze({
  internal: 'internal',
  external_pemerintah: 'external_pemerintah',
  external_mitra: 'external_mitra',
  live_guru: 'live_guru',
});

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

function getActiveAnalysisMode() {
  if (activeAnalysisGroup === 'external') {
    return activeExternalAudience === 'mitra'
      ? AI_MODES.external_mitra
      : AI_MODES.external_pemerintah;
  }
  if (activeAnalysisGroup === 'live') return AI_MODES.live_guru;
  return AI_MODES.internal;
}

function getModeLabel(mode = getActiveAnalysisMode()) {
  if (mode === AI_MODES.external_pemerintah) return 'External - Pemerintah';
  if (mode === AI_MODES.external_mitra) return 'External - Mitra';
  if (mode === AI_MODES.live_guru) return 'Live Guru';
  return 'Internal';
}

function getModeSubtitle(mode = getActiveAnalysisMode()) {
  if (mode === AI_MODES.external_pemerintah) {
    return 'Laporan formal untuk Dinas/Pemda berbasis data terbaru.';
  }
  if (mode === AI_MODES.external_mitra) {
    return 'Memo business impact untuk mitra/sponsor/investor.';
  }
  if (mode === AI_MODES.live_guru) {
    return 'Ringkasan live untuk diproyeksikan di akhir kegiatan.';
  }
  return 'Ringkasan otomatis berbasis data untuk kebutuhan internal tim.';
}

function getModeCacheKey(mode = getActiveAnalysisMode()) {
  return `ai-latest-analysis-${mode}`;
}

function refreshModeControls() {
  const mode = getActiveAnalysisMode();
  aiGroupInternalBtn?.classList.toggle('active', activeAnalysisGroup === 'internal');
  aiGroupExternalBtn?.classList.toggle('active', activeAnalysisGroup === 'external');
  aiGroupLiveBtn?.classList.toggle('active', activeAnalysisGroup === 'live');

  if (aiExternalLabel) {
    aiExternalLabel.classList.toggle('is-hidden', activeAnalysisGroup !== 'external');
  }

  if (aiSubtitle) {
    aiSubtitle.textContent = getModeSubtitle(mode);
  }
}

function refreshAiPdfButtonState() {
  if (!aiDownloadPdfBtn) return;
  aiDownloadPdfBtn.disabled = !hasAnalysisText(latestAnalysisState.analysis);
}

function applyLatestAnalysisState(nextState) {
  const activeMode = getActiveAnalysisMode();
  latestAnalysisState = {
    mode: nextState?.mode || activeMode,
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
  const activeMode = getActiveAnalysisMode();
  const modeLabel = getModeLabel(activeMode);
  aiRunBtn.disabled = true;
  if (aiDownloadPdfBtn) aiDownloadPdfBtn.disabled = true;
  setAiStatus(`Menjalankan analisa AI (${modeLabel})...`);
  if (aiOutput) aiOutput.textContent = 'Sedang memproses data...';

  try {
    const response = await fetch('./api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: activeMode }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || 'Gagal menjalankan analisa AI.');
    }

    applyLatestAnalysisState(payload);
    const analyzedAt = formatDateTime(payload?.createdAt);
    setAiStatus(`Analisa ${getModeLabel(payload?.mode || activeMode)} selesai. Tersimpan pada ${analyzedAt}.`);
    localStorage.setItem(getModeCacheKey(payload?.mode || activeMode), payload.analysis || '');
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

function switchAnalysisGroup(nextGroup) {
  activeAnalysisGroup = nextGroup;
  refreshModeControls();
  loadLatestAi();
}

if (aiGroupInternalBtn) {
  aiGroupInternalBtn.addEventListener('click', () => switchAnalysisGroup('internal'));
}

if (aiGroupExternalBtn) {
  aiGroupExternalBtn.addEventListener('click', () => switchAnalysisGroup('external'));
}

if (aiGroupLiveBtn) {
  aiGroupLiveBtn.addEventListener('click', () => switchAnalysisGroup('live'));
}

if (aiExternalAudienceSelect) {
  aiExternalAudienceSelect.addEventListener('change', (event) => {
    activeExternalAudience = event.target.value === 'mitra' ? 'mitra' : 'pemerintah';
    refreshModeControls();
    loadLatestAi();
  });
}

async function loadLatestAi() {
  if (!aiOutput) return;
  const activeMode = getActiveAnalysisMode();
  const modeLabel = getModeLabel(activeMode);

  try {
    const response = await fetch(`./api/ai/latest?mode=${encodeURIComponent(activeMode)}`);
    if (response.status === 401) {
      applyLatestAnalysisState({ mode: activeMode, analysis: '', meta: null, createdAt: null });
      setAiStatus(`Analisa ${modeLabel} tidak bisa dimuat (Unauthorized).`, true);
      return;
    }

    if (response.status === 400) {
      const payload = await response.json().catch(() => ({}));
      applyLatestAnalysisState({ mode: activeMode, analysis: '', meta: null, createdAt: null });
      setAiStatus(payload?.message || 'Mode analisa tidak valid.', true);
      return;
    }

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      applyLatestAnalysisState(payload);
      if (payload?.analysis) {
        localStorage.setItem(getModeCacheKey(payload?.mode || activeMode), payload.analysis);
        setAiStatus(
          `Menampilkan analisa ${getModeLabel(payload?.mode || activeMode)} terakhir (${formatDateTime(payload?.createdAt)}).`
        );
      } else {
        setAiStatus(`Belum ada analisa ${modeLabel} tersimpan.`);
      }
      return;
    }
  } catch {
    // ignore and fallback to local storage
  }

  let cached = localStorage.getItem(getModeCacheKey(activeMode));
  if (!cached && activeMode === AI_MODES.internal) {
    cached = localStorage.getItem('ai-latest-analysis');
  }
  if (cached) {
    applyLatestAnalysisState({ mode: activeMode, analysis: cached, meta: null, createdAt: null });
    setAiStatus(`Menampilkan cache lokal untuk mode ${modeLabel}.`);
    return;
  }

  applyLatestAnalysisState({ mode: activeMode, analysis: '', meta: null, createdAt: null });
}

if (aiExternalAudienceSelect) {
  aiExternalAudienceSelect.value = activeExternalAudience;
}
refreshModeControls();
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

function sanitizeMarkdownInline(value) {
  return String(value ?? '')
    .replaceAll('**', '')
    .replaceAll('__', '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function parseTableRow(row) {
  let cleaned = String(row ?? '').trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((cell) => sanitizeMarkdownInline(cell));
}

function isMarkdownTableSeparator(row) {
  const compact = String(row ?? '').replace(/\s/g, '');
  return /^[|:-]+$/.test(compact) && compact.includes('-');
}

function isBulletListLine(line) {
  return /^(?:[-*]|\u2022)\s+/.test(String(line ?? '').trim());
}

function extractMarkdownTables(lines, startIndex) {
  const headerLine = lines[startIndex]?.trim() || '';
  const separatorLine = lines[startIndex + 1]?.trim() || '';
  if (!headerLine.includes('|') || !isMarkdownTableSeparator(separatorLine)) return null;

  const header = parseTableRow(headerLine);
  const rows = [];
  let i = startIndex + 2;

  while (i < lines.length) {
    const tableLine = lines[i].trim();
    if (!tableLine || !tableLine.includes('|')) break;
    if (isMarkdownTableSeparator(tableLine)) {
      i += 1;
      continue;
    }
    rows.push(parseTableRow(tableLine));
    i += 1;
  }

  return {
    block: { type: 'table', header, rows },
    nextIndex: i - 1,
  };
}

function isNumericLike(value) {
  const compact = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?%?$/.test(compact);
}

function detectHeadingBlock(line, nextLine) {
  const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
  if (markdownHeading) {
    const hashCount = markdownHeading[1].length;
    const level = hashCount === 1 ? 1 : hashCount === 2 ? 2 : 3;
    return { level, text: sanitizeMarkdownInline(markdownHeading[2]) };
  }

  if (/^slide\s+\d+/i.test(line)) {
    return { level: 1, text: sanitizeMarkdownInline(line) };
  }

  if (/^\d+\.\d+\s+/.test(line)) {
    return { level: 3, text: sanitizeMarkdownInline(line) };
  }

  if (/^[A-Z]\.\s+/.test(line)) {
    return { level: 2, text: sanitizeMarkdownInline(line) };
  }

  if (/^\d+[.)]\s+/.test(line) && !/^\d+[.)]\s+/.test(nextLine)) {
    return { level: 1, text: sanitizeMarkdownInline(line) };
  }

  if (line.endsWith(':') && line.length <= 120) {
    return { level: 3, text: sanitizeMarkdownInline(line.replace(/:$/, '')) };
  }

  return null;
}

function parseAnalysisToBlocks(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const blocks = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraph = sanitizeMarkdownInline(paragraphBuffer.join(' '));
    if (paragraph) blocks.push({ type: 'paragraph', text: paragraph });
    paragraphBuffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] || '').trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const nextLine = (lines[i + 1] || '').trim();
    const tableExtraction = extractMarkdownTables(lines, i);
    if (tableExtraction) {
      flushParagraph();
      blocks.push(tableExtraction.block);
      i = tableExtraction.nextIndex;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushParagraph();
      continue;
    }

    const headingBlock = detectHeadingBlock(line, nextLine);
    if (headingBlock) {
      flushParagraph();
      blocks.push({ type: 'heading', level: headingBlock.level, text: headingBlock.text });
      continue;
    }

    if (isBulletListLine(line)) {
      flushParagraph();
      const items = [];
      let j = i;
      while (j < lines.length) {
        const listLine = (lines[j] || '').trim();
        if (!isBulletListLine(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^(?:[-*]|\u2022)\s+/, '')));
        j += 1;
      }
      blocks.push({ type: 'bullet-list', items });
      i = j - 1;
      continue;
    }

    if (/^\d+[.\)]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      let j = i;
      while (j < lines.length) {
        const listLine = (lines[j] || '').trim();
        if (!/^\d+[.\)]\s+/.test(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^\d+[.\)]\s+/, '')));
        j += 1;
      }
      blocks.push({ type: 'numbered-list', items });
      i = j - 1;
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}

function buildPdfContext() {
  const activeMode = latestAnalysisState.mode || getActiveAnalysisMode();
  const modeLabel = getModeLabel(activeMode);
  const analysisText = (latestAnalysisState.analysis || '').trim();

  return {
    mode: activeMode,
    modeLabel,
    title: `Laporan Analisa AI - ${modeLabel}`,
    subtitle: 'Program AI Teaching Assistant | Dashboard Internal',
    analyzedAt: formatDateTime(latestAnalysisState.createdAt),
    metadataLines: buildAiMetadataLines(latestAnalysisState.meta),
    analysisText,
    blocks: parseAnalysisToBlocks(analysisText),
    filename: `analisa-${activeMode}-${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}

const PDF_LAYOUT = Object.freeze({
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 20,
  footerTopOffset: 10,
  footerTextOffset: 5.2,
  listIndent: 7,
  listMarkerGap: 2,
  font: Object.freeze({
    title: 17,
    section: 12.5,
    headingLevel2: 11.5,
    headingLevel3: 11,
    body: 10.5,
    footer: 8.5,
    table: 9.2,
  }),
  lineHeight: Object.freeze({
    body: 5.6,
    metadata: 5.4,
    heading: 6,
    list: 5.4,
  }),
  gap: Object.freeze({
    afterParagraph: 2,
    afterList: 2,
    afterTable: 5,
    afterTableImmediate: 1,
    beforeSectionTitle: 6,
    afterSectionTitle: 2,
    beforeSubheading: 3,
    afterSubheading: 1.5,
    tableToHeadingExtra: 1,
  }),
  table: Object.freeze({
    cellPadding: 1.9,
  }),
});

function renderFooterAllPages(doc) {
  const { marginLeft, marginRight, footerTopOffset, footerTextOffset, font } = PDF_LAYOUT;
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerTopY = pageHeight - footerTopOffset;
  const footerTextY = pageHeight - footerTextOffset;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 227, 238);
    doc.line(marginLeft, footerTopY, pageWidth - marginRight, footerTopY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.footer);
    doc.setTextColor(100, 116, 139);
    doc.text('PT. AITI GLOBAL NEXUS', marginLeft, footerTextY);
    doc.text(`Halaman ${page}/${pageCount}`, pageWidth - marginRight, footerTextY, {
      align: 'right',
    });
  }
}

function renderPdfDocument(doc, context) {
  const { marginLeft, marginRight, marginTop, marginBottom, font, lineHeight, gap, listIndent, listMarkerGap } =
    PDF_LAYOUT;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;

  const ensureSpace = (required = lineHeight.body) => {
    if (y + required <= pageHeight - marginBottom) return;
    doc.addPage();
    y = marginTop;
  };

  const drawWrappedText = (text, options = {}) => {
    const {
      font = 'helvetica',
      style = 'normal',
      size = PDF_LAYOUT.font.body,
      color = [15, 23, 42],
      lineHeight = PDF_LAYOUT.lineHeight.body,
      x = marginLeft,
      maxWidth = contentWidth,
    } = options;

    const safeText = sanitizeMarkdownInline(text);
    if (!safeText) return;
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(safeText, maxWidth);
    wrapped.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    });
  };

  const drawSectionTitle = (text, sectionNumber) => {
    ensureSpace(gap.beforeSectionTitle + lineHeight.heading + gap.afterSectionTitle);
    y += gap.beforeSectionTitle;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(font.section);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sectionNumber}. ${text}`, marginLeft, y);
    y += lineHeight.heading + gap.afterSectionTitle;
  };

  const drawHangingList = (items, ordered = false) => {
    if (!items.length) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.body);
    doc.setTextColor(15, 23, 42);

    const baseMarkerX = marginLeft;
    const maxLabelWidth = ordered
      ? Math.max(...items.map((_, index) => doc.getTextWidth(`${index + 1}.`)))
      : doc.getTextWidth('-');
    const markerTextX = baseMarkerX;
    const contentX = marginLeft + Math.max(listIndent, maxLabelWidth + listMarkerGap);
    const availableWidth = pageWidth - marginRight - contentX;

    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const safeItem = sanitizeMarkdownInline(item);
      if (!safeItem) return;
      const wrapped = doc.splitTextToSize(safeItem, availableWidth);
      wrapped.forEach((line, lineIndex) => {
        ensureSpace(lineHeight.list);
        if (lineIndex === 0) {
          doc.text(marker, markerTextX, y);
        }
        doc.text(line, contentX, y);
        y += lineHeight.list;
      });
    });
  };

  const getHeadingStyle = (level) => {
    if (level === 1) {
      return { size: font.section, lineHeight: lineHeight.heading };
    }
    if (level === 2) {
      return { size: font.headingLevel2, lineHeight: lineHeight.heading };
    }
    return { size: font.headingLevel3, lineHeight: lineHeight.heading };
  };

  const applyBlockGap = (previousBlock, nextType) => {
    if (!previousBlock) return;

    if (previousBlock.type === 'table') {
      y += gap.afterTable;
      if (nextType === 'heading') y += gap.tableToHeadingExtra;
      return;
    }

    if (previousBlock.type === 'paragraph') {
      y += gap.afterParagraph;
      if (nextType === 'heading') y += gap.beforeSubheading;
      return;
    }

    if (previousBlock.type === 'bullet-list' || previousBlock.type === 'numbered-list') {
      y += gap.afterList;
      if (nextType === 'heading') y += gap.beforeSubheading;
      return;
    }

    if (previousBlock.type === 'heading') {
      if (nextType === 'heading') {
        y += gap.beforeSubheading;
        return;
      }
      y += previousBlock.level === 1 ? gap.afterSectionTitle : gap.afterSubheading;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font.title);
  doc.setTextColor(15, 23, 42);
  doc.text(context.title, marginLeft, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(font.body);
  doc.setTextColor(71, 85, 105);
  doc.text(context.subtitle, marginLeft, y);
  y += 6;

  doc.setDrawColor(210, 220, 234);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  drawSectionTitle('Informasi Dokumen', 1);
  drawWrappedText(`Mode Analisa: ${context.modeLabel}`, {
    style: 'bold',
    size: font.body,
    lineHeight: lineHeight.metadata,
  });
  drawWrappedText(`Tanggal Analisa: ${context.analyzedAt}`, {
    size: font.body,
    lineHeight: lineHeight.metadata,
  });
  context.metadataLines.forEach((line) => {
    drawWrappedText(`- ${line}`, {
      size: font.body,
      lineHeight: lineHeight.metadata,
    });
  });

  drawSectionTitle('Hasil Analisa', 2);

  if (!context.blocks.length) {
    drawWrappedText('Data analisa belum tersedia.', { size: font.body, lineHeight: lineHeight.body });
    return;
  }

  let previousBlock = null;
  context.blocks.forEach((block) => {
    applyBlockGap(previousBlock, block.type);

    if (block.type === 'heading') {
      const headingLevel = Number(block.level) || 3;
      const headingStyle = getHeadingStyle(headingLevel);
      drawWrappedText(block.text, {
        style: 'bold',
        size: headingStyle.size,
        color: [30, 41, 59],
        lineHeight: headingStyle.lineHeight,
      });
      previousBlock = { type: 'heading', level: headingLevel };
      return;
    }

    if (block.type === 'paragraph') {
      drawWrappedText(block.text, {
        size: font.body,
        lineHeight: lineHeight.body,
      });
      previousBlock = { type: 'paragraph' };
      return;
    }

    if (block.type === 'bullet-list') {
      drawHangingList(block.items, false);
      previousBlock = { type: 'bullet-list' };
      return;
    }

    if (block.type === 'numbered-list') {
      drawHangingList(block.items, true);
      previousBlock = { type: 'numbered-list' };
      return;
    }

    if (block.type === 'table') {
      const header = (block.header || []).map((cell) => sanitizeMarkdownInline(cell));
      const rows = (block.rows || [])
        .map((row) => row.map((cell) => sanitizeMarkdownInline(cell)))
        .filter((row) => row.some((cell) => cell));

      if (!header.length || !rows.length || typeof doc.autoTable !== 'function') {
        if (rows.length) {
          rows.forEach((row) => {
            drawWrappedText(row.join(' | '), {
              size: font.body,
              lineHeight: lineHeight.body,
            });
          });
        }
        previousBlock = { type: 'table' };
        return;
      }

      const columnCount = header.length;
      const normalizedRows = rows.map((row) => {
        const cloned = [...row];
        while (cloned.length < columnCount) cloned.push('');
        return cloned.slice(0, columnCount);
      });

      const columnStyles = {};
      for (let col = 0; col < columnCount; col += 1) {
        const allNumeric = normalizedRows.every((row) => {
          const value = row[col];
          return !value || isNumericLike(value);
        });
        if (allNumeric) {
          columnStyles[col] = { halign: 'right' };
        }
      }

      ensureSpace(18);
      doc.autoTable({
        startY: y,
        margin: { left: marginLeft, right: marginRight },
        head: [header],
        body: normalizedRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: font.table,
          cellPadding: PDF_LAYOUT.table.cellPadding,
          lineColor: [214, 224, 238],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [237, 242, 248],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [250, 252, 255],
        },
        columnStyles,
      });

      y = doc.lastAutoTable.finalY + gap.afterTableImmediate;
      previousBlock = { type: 'table' };
    }
  });
}

async function downloadAiPdf() {
  if (!aiDownloadPdfBtn) return;

  const context = buildPdfContext();
  if (!context.analysisText) {
    setAiStatus('Belum ada analisa untuk diunduh.', true);
    refreshAiPdfButtonState();
    return;
  }

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF || typeof jsPDF !== 'function') {
    setAiStatus('Library PDF belum siap.', true);
    return;
  }

  aiDownloadPdfBtn.disabled = true;

  try {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    renderPdfDocument(pdf, context);
    renderFooterAllPages(pdf);
    pdf.save(context.filename);
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

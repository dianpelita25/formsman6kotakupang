import { resolvePreferredAdvancedVizMode } from './analytics-capabilities.js';

const ANALYSIS_VIEW_ORDER = Object.freeze(['overview', 'question', 'criteria', 'trend', 'benchmark']);

const ANALYSIS_VIEW_CARD_VISIBILITY = Object.freeze({
  overview: Object.freeze({
    scaleAverage: true,
    radioDistribution: true,
    trend: true,
    criteriaSummary: true,
    advancedViz: true,
  }),
  question: Object.freeze({
    scaleAverage: true,
    radioDistribution: true,
    trend: false,
    criteriaSummary: false,
    advancedViz: true,
  }),
  criteria: Object.freeze({
    scaleAverage: false,
    radioDistribution: false,
    trend: false,
    criteriaSummary: true,
    advancedViz: true,
  }),
  trend: Object.freeze({
    scaleAverage: false,
    radioDistribution: false,
    trend: true,
    criteriaSummary: false,
    advancedViz: true,
  }),
  benchmark: Object.freeze({
    scaleAverage: false,
    radioDistribution: false,
    trend: false,
    criteriaSummary: false,
    advancedViz: true,
  }),
});

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveAnalysisViewAvailability(capabilities = null) {
  return {
    overview: true,
    question: true,
    criteria: Boolean(capabilities?.hasCriteria),
    trend: Boolean(capabilities?.trendRelevant),
    benchmark: Boolean(capabilities?.hasBenchmark),
  };
}

function resolveDefaultAnalysisView(capabilities = null) {
  const criteriaMode = String(capabilities?.criteriaMode || '').trim();
  if (criteriaMode === 'none') return 'question';
  if (criteriaMode === 'full') return 'criteria';
  if (criteriaMode === 'mixed') return 'overview';
  return 'overview';
}

function resolveAnalysisViewNote(capabilities = null) {
  const criteriaMode = String(capabilities?.criteriaMode || '').trim();
  const criteriaCount = toNumber(capabilities?.criteriaCount, 0);
  const totalQuestions = toNumber(capabilities?.totalQuestions, 0);
  const coverage = toNumber(capabilities?.criteriaCoveragePercent, 0);
  const trendRelevant = Boolean(capabilities?.trendRelevant);
  const benchmarkRelevant = Boolean(capabilities?.hasBenchmark);
  const trendClause = trendRelevant ? 'Tab tren aktif.' : 'Tab tren disembunyikan (data harian belum cukup).';
  const benchmarkClause = benchmarkRelevant
    ? 'Tab benchmark sekolah aktif.'
    : 'Tab benchmark sekolah disembunyikan (butuh minimal 2 sekolah).';

  if (criteriaMode === 'none') {
    return `Mode default: Per Pertanyaan (belum ada kriteria). ${trendClause} ${benchmarkClause}`;
  }
  if (criteriaMode === 'full') {
    return `Mode default: Per Kriteria (${criteriaCount}/${totalQuestions} soal berkriteria). ${trendClause} ${benchmarkClause}`;
  }
  if (criteriaMode === 'mixed') {
    return `Mode campuran: kriteria terisi ${criteriaCount}/${totalQuestions} soal (${coverage}%). ${trendClause} ${benchmarkClause}`;
  }
  return `${trendClause} ${benchmarkClause}`;
}

function resolveContextualAdvancedVizMode(analysisView, currentMode, capabilities = null) {
  const availability = capabilities?.advancedVizModeAvailability || {};
  const current = String(currentMode || '').trim();
  if (analysisView === 'question') {
    if (availability.likert !== false) return 'likert';
    if (availability.segment !== false) return 'segment';
    return resolvePreferredAdvancedVizMode(current, capabilities);
  }
  if (analysisView === 'criteria') {
    if (availability.criteria !== false) return 'criteria';
    return resolvePreferredAdvancedVizMode(current, capabilities);
  }
  if (analysisView === 'trend') {
    if (availability.period !== false) return 'period';
    if (availability.weekly !== false) return 'weekly';
    return resolvePreferredAdvancedVizMode(current, capabilities);
  }
  if (analysisView === 'benchmark') {
    if (availability.benchmark !== false) return 'benchmark';
    return resolvePreferredAdvancedVizMode(current, capabilities);
  }
  return resolvePreferredAdvancedVizMode(current, capabilities);
}

export function applyAnalysisViewFromCapabilities(state, capabilities = null) {
  const availability = resolveAnalysisViewAvailability(capabilities);
  const current = String(state.analysisView || '').trim();
  const defaultView = resolveDefaultAnalysisView(capabilities);
  const analysisView = availability[current] !== false ? current || defaultView : defaultView;

  state.analysisViewAvailability = availability;
  state.analysisView = analysisView;
  state.analysisViewCardVisibility = {
    ...ANALYSIS_VIEW_CARD_VISIBILITY.overview,
    ...(ANALYSIS_VIEW_CARD_VISIBILITY[analysisView] || ANALYSIS_VIEW_CARD_VISIBILITY.overview),
  };
  state.analysisViewNote = resolveAnalysisViewNote(capabilities);
  state.advancedVizMode = resolveContextualAdvancedVizMode(analysisView, state.advancedVizMode, capabilities);

  return {
    analysisView,
    availability,
    note: state.analysisViewNote,
  };
}

export function selectAnalysisView(state, nextView, capabilities = null) {
  const view = String(nextView || '').trim();
  if (!view || !ANALYSIS_VIEW_ORDER.includes(view)) return false;
  const availability = state.analysisViewAvailability || resolveAnalysisViewAvailability(capabilities);
  if (availability[view] === false) return false;

  state.analysisView = view;
  state.analysisViewCardVisibility = {
    ...ANALYSIS_VIEW_CARD_VISIBILITY.overview,
    ...(ANALYSIS_VIEW_CARD_VISIBILITY[view] || ANALYSIS_VIEW_CARD_VISIBILITY.overview),
  };
  state.advancedVizMode = resolveContextualAdvancedVizMode(view, state.advancedVizMode, capabilities);
  return true;
}

export function syncAnalysisViewUi(state) {
  const buttons = Array.from(document.querySelectorAll('.dashboard-analysis-tab'));
  const availability = state.analysisViewAvailability || {};
  const activeView = String(state.analysisView || '').trim();
  buttons.forEach((button) => {
    const view = String(button.dataset.analysisView || '').trim();
    const available = availability[view] !== false;
    const active = available && view === activeView;
    button.hidden = !available;
    button.disabled = !available;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.setAttribute('aria-disabled', available ? 'false' : 'true');
  });

  const noteEl = document.getElementById('dashboard-analysis-note');
  if (noteEl) {
    noteEl.textContent = String(state.analysisViewNote || '').trim();
  }
}

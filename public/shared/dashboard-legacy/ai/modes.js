export const AI_MODES = Object.freeze({
  internal: 'internal',
  external_pemerintah: 'external_pemerintah',
  external_mitra: 'external_mitra',
  live_guru: 'live_guru',
});

export function getActiveAnalysisMode(state) {
  if (state.activeAnalysisGroup === 'external') {
    return state.activeExternalAudience === 'mitra' ? AI_MODES.external_mitra : AI_MODES.external_pemerintah;
  }
  if (state.activeAnalysisGroup === 'live') return AI_MODES.live_guru;
  return AI_MODES.internal;
}

export function getModeLabel(mode) {
  if (mode === AI_MODES.external_pemerintah) return 'Eksternal - Pemerintah';
  if (mode === AI_MODES.external_mitra) return 'Eksternal - Mitra';
  if (mode === AI_MODES.live_guru) return 'Live Guru';
  return 'Internal';
}

export function getModeSubtitle(mode) {
  if (mode === AI_MODES.external_pemerintah) {
    return 'Laporan formal untuk Dinas/Pemda berbasis data terbaru.';
  }
  if (mode === AI_MODES.external_mitra) {
    return 'Memo dampak usaha untuk mitra/sponsor/investor.';
  }
  if (mode === AI_MODES.live_guru) {
    return 'Ringkasan live untuk diproyeksikan di akhir kegiatan.';
  }
  return 'Ringkasan otomatis berbasis data untuk kebutuhan internal tim.';
}

export function getModeCacheKey(mode) {
  return `ai-latest-analysis-${mode}`;
}

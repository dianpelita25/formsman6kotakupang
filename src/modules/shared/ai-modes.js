export const AI_ANALYSIS_MODES = Object.freeze({
  INTERNAL: 'internal',
  EXTERNAL_PEMERINTAH: 'external_pemerintah',
  EXTERNAL_MITRA: 'external_mitra',
  LIVE_GURU: 'live_guru',
});

const VALID_MODES = new Set(Object.values(AI_ANALYSIS_MODES));

export function normalizeAiMode(value) {
  const normalized = String(value || AI_ANALYSIS_MODES.INTERNAL).trim().toLowerCase();
  return VALID_MODES.has(normalized) ? normalized : null;
}

export const normalizeAiAnalysisMode = normalizeAiMode;

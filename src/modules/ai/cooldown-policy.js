const DEFAULT_AI_ANALYZE_COOLDOWN_SECONDS = 3600;

function parseMeta(metaValue) {
  if (!metaValue) return {};
  if (typeof metaValue === 'object') return metaValue;
  try {
    const parsed = JSON.parse(String(metaValue || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toIso(value) {
  const raw = String(value || '').trim();
  return raw || '';
}

export function getAiAnalyzeCooldownSeconds(env = {}) {
  const raw = Number(env?.AI_ANALYZE_COOLDOWN_SECONDS || DEFAULT_AI_ANALYZE_COOLDOWN_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_AI_ANALYZE_COOLDOWN_SECONDS;
  return Math.max(60, Math.min(24 * 60 * 60, Math.floor(raw)));
}

export function buildAiInputSignature({
  mode = '',
  questionnaireVersionId = null,
  from = null,
  to = null,
  totalResponses = 0,
  lastSubmittedAt = null,
} = {}) {
  const parts = [
    `mode=${String(mode || '').trim()}`,
    `version=${String(questionnaireVersionId || '').trim() || 'none'}`,
    `from=${toIso(from) || 'none'}`,
    `to=${toIso(to) || 'none'}`,
    `total=${Number(totalResponses || 0)}`,
    `last=${toIso(lastSubmittedAt) || 'none'}`,
  ];
  return parts.join('|');
}

export function resolveReusableAnalysis(latestRow, inputSignature = '', cooldownSeconds = DEFAULT_AI_ANALYZE_COOLDOWN_SECONDS) {
  if (!latestRow || !inputSignature) {
    return {
      reused: false,
      cooldownSeconds: 0,
    };
  }

  const latestMeta = parseMeta(latestRow.meta);
  const previousSignature = String(latestMeta.inputSignature || '').trim();
  if (!previousSignature || previousSignature !== String(inputSignature).trim()) {
    return {
      reused: false,
      cooldownSeconds: 0,
    };
  }

  const createdAt = new Date(String(latestRow.created_at || latestRow.createdAt || '').trim());
  if (Number.isNaN(createdAt.getTime())) {
    return {
      reused: false,
      cooldownSeconds: 0,
    };
  }

  const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
  const remaining = Math.max(0, cooldownSeconds - elapsedSeconds);
  if (remaining <= 0) {
    return {
      reused: false,
      cooldownSeconds: 0,
    };
  }

  return {
    reused: true,
    cooldownSeconds: remaining,
  };
}

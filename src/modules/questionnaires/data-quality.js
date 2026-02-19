const CONFIDENCE_HIGH_MIN = 150;
const CONFIDENCE_MEDIUM_MIN = 50;
const LOW_SAMPLE_WARNING_THRESHOLD = 30;
const STALE_LAST_SUBMISSION_DAYS = 30;
const DATE_RANGE_NARROW_DAYS = 7;

function toDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveConfidence(sampleSize) {
  const total = Number(sampleSize || 0);
  if (total >= CONFIDENCE_HIGH_MIN) return 'high';
  if (total >= CONFIDENCE_MEDIUM_MIN) return 'medium';
  return 'low';
}

function resolveDateRangeNarrowWarning(fromIso, toIso) {
  const fromDate = toDate(fromIso);
  const toDateValue = toDate(toIso);
  if (!fromDate || !toDateValue) return false;
  const rangeMs = toDateValue.getTime() - fromDate.getTime();
  if (!Number.isFinite(rangeMs) || rangeMs <= 0) return false;
  const rangeDays = rangeMs / (24 * 60 * 60 * 1000);
  return rangeDays <= DATE_RANGE_NARROW_DAYS;
}

function resolveStaleSubmissionWarning(lastSubmittedAt, now = new Date()) {
  const submittedAt = toDate(lastSubmittedAt);
  if (!submittedAt) return true;
  const ageMs = now.getTime() - submittedAt.getTime();
  if (!Number.isFinite(ageMs)) return true;
  return ageMs > STALE_LAST_SUBMISSION_DAYS * 24 * 60 * 60 * 1000;
}

export function buildDataQuality({
  sampleSize = 0,
  fromIso = null,
  toIso = null,
  lastSubmittedAt = null,
  segmentFiltered = false,
  now = new Date(),
} = {}) {
  const size = Number(sampleSize || 0);
  const warnings = [];

  if (size < LOW_SAMPLE_WARNING_THRESHOLD) {
    warnings.push('low_sample_size');
  }
  if (segmentFiltered) {
    warnings.push('segment_filtered');
  }
  if (resolveDateRangeNarrowWarning(fromIso, toIso)) {
    warnings.push('date_range_narrow');
  }
  if (resolveStaleSubmissionWarning(lastSubmittedAt, now)) {
    warnings.push('stale_last_submission');
  }

  return {
    sampleSize: size,
    confidence: resolveConfidence(size),
    warnings,
  };
}

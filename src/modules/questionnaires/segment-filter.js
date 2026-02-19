import { resolveScaleFieldNames } from './distribution/field-parser.js';
import { collectSegmentAnswerValues, normalizeSegmentBucketValue } from './distribution/segment/string-utils.js';
import { normalizeSegmentBucket, normalizeSegmentDimensionId } from './query-utils.js';

export const MAX_SEGMENT_DRILLDOWN_ROWS = 10000;

const SCORE_BAND_LABELS = Object.freeze({
  low: 'Rendah (<=2.5)',
  mid: 'Sedang (>2.5 - <4)',
  high: 'Tinggi (>=4)',
});

function normalizeBucketValue(rawValue) {
  const bucket = normalizeSegmentBucket(rawValue);
  if (!bucket) return '';
  return normalizeSegmentBucketValue(bucket);
}

function normalizeBucketList(rawValues = []) {
  const unique = new Set();
  const normalized = [];
  (Array.isArray(rawValues) ? rawValues : []).forEach((rawValue) => {
    const bucket = normalizeBucketValue(rawValue);
    if (!bucket || unique.has(bucket)) return;
    unique.add(bucket);
    normalized.push(bucket);
  });
  return normalized;
}

function toDate(value) {
  const parsed = new Date(String(value || '').trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveScoreBandLabel(row = null, scaleFieldNames = []) {
  const names = Array.isArray(scaleFieldNames) ? scaleFieldNames : [];
  if (!names.length) return '';

  let answered = 0;
  let sum = 0;
  names.forEach((fieldName) => {
    const parsed = Number(row?.answers?.[fieldName]);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return;
    answered += 1;
    sum += parsed;
  });
  if (answered <= 0) return '';

  const average = sum / answered;
  if (average >= 4) return SCORE_BAND_LABELS.high;
  if (average > 2.5) return SCORE_BAND_LABELS.mid;
  return SCORE_BAND_LABELS.low;
}

function resolveQuestionBucketValues(row = null, fieldsByName = new Map(), dimensionId = '') {
  const name = String(dimensionId || '').slice('question:'.length);
  if (!name) return [];
  const field = fieldsByName.get(name);
  if (!field) return [];
  return collectSegmentAnswerValues(field, row?.answers?.[name]);
}

function resolveRespondentBucketValue(row = null, dimensionId = '') {
  const key = String(dimensionId || '').slice('respondent:'.length);
  if (!key) return '';
  return normalizeBucketValue(row?.respondent?.[key]);
}

function resolveResponseBucketValues(row = null, fieldsByName = new Map(), scaleFieldNames = [], dimensionId = '') {
  const normalizedId = String(dimensionId || '').trim();
  if (!normalizedId) return [];

  if (normalizedId.startsWith('question:')) {
    return resolveQuestionBucketValues(row, fieldsByName, normalizedId);
  }
  if (normalizedId.startsWith('respondent:')) {
    const bucket = resolveRespondentBucketValue(row, normalizedId);
    return bucket ? [bucket] : [];
  }
  if (normalizedId === 'score_band') {
    const bucket = resolveScoreBandLabel(row, scaleFieldNames);
    return bucket ? [bucket] : [];
  }
  return [];
}

export function resolveSegmentFilter(query = {}) {
  const hasDimension = query?.segmentDimensionId != null && String(query.segmentDimensionId).trim() !== '';
  const hasBucket = query?.segmentBucket != null && String(query.segmentBucket).trim() !== '';

  if (hasDimension !== hasBucket) {
    return {
      ok: false,
      status: 400,
      message: 'Filter segment tidak valid. segmentDimensionId dan segmentBucket harus diisi bersamaan.',
    };
  }

  if (!hasDimension) {
    return {
      ok: true,
      segmentFilterActive: false,
      segmentDimensionId: null,
      segmentBucket: null,
    };
  }

  const segmentDimensionId = normalizeSegmentDimensionId(query.segmentDimensionId);
  const segmentBucket = normalizeBucketValue(query.segmentBucket);
  if (!segmentDimensionId || !segmentBucket) {
    return {
      ok: false,
      status: 400,
      message: 'Filter segment tidak valid. Periksa dimensi dan bucket.',
    };
  }

  return {
    ok: true,
    segmentFilterActive: true,
    segmentDimensionId,
    segmentBucket,
  };
}

export function resolveSegmentCompareBuckets(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return { ok: true, buckets: [] };

  const decodedBuckets = raw.split(',').map((bucket) => {
    const encoded = String(bucket || '').trim();
    if (!encoded) return '';
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
  const buckets = normalizeBucketList(decodedBuckets);
  if (!buckets.length) {
    return {
      ok: false,
      status: 400,
      message: 'segmentBuckets tidak valid.',
    };
  }
  if (buckets.length > 3) {
    return {
      ok: false,
      status: 400,
      message: 'segmentBuckets maksimal 3 bucket.',
    };
  }
  return { ok: true, buckets };
}

export function isSegmentDrilldownEligible(segmentDimensionId = '') {
  const normalizedId = String(segmentDimensionId || '').trim();
  if (!normalizedId) return false;
  if (normalizedId === 'criteria') return false;
  return normalizedId.startsWith('question:') || normalizedId.startsWith('respondent:') || normalizedId === 'score_band';
}

export function filterResponsesBySegment({
  fields = [],
  responseRows = [],
  segmentDimensionId = null,
  segmentBucket = null,
} = {}) {
  const normalizedId = normalizeSegmentDimensionId(segmentDimensionId);
  const normalizedBucket = normalizeBucketValue(segmentBucket);
  if (!normalizedId || !normalizedBucket) {
    return {
      matched: Array.isArray(responseRows) ? responseRows : [],
      totalCandidates: Array.isArray(responseRows) ? responseRows.length : 0,
    };
  }

  const rows = Array.isArray(responseRows) ? responseRows : [];
  const fieldsByName = new Map((Array.isArray(fields) ? fields : []).map((field) => [field?.name, field]));
  const scaleFieldNames = resolveScaleFieldNames(fields);
  const matched = rows.filter((row) =>
    resolveResponseBucketValues(row, fieldsByName, scaleFieldNames, normalizedId).some((bucket) => bucket === normalizedBucket)
  );

  return {
    matched,
    totalCandidates: rows.length,
  };
}

export function resolveLastSubmittedAt(responseRows = []) {
  const rows = Array.isArray(responseRows) ? responseRows : [];
  let latestDate = null;
  rows.forEach((row) => {
    const createdAt = toDate(row?.createdAt);
    if (!createdAt) return;
    if (!latestDate || createdAt > latestDate) latestDate = createdAt;
  });
  return latestDate ? latestDate.toISOString() : null;
}

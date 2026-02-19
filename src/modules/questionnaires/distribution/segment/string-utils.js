import { parseChoiceValues } from '../field-parser.js';

export function titleCaseSegmentKey(key = '') {
  const text = String(key || '').trim();
  if (!text) return 'Dimensi';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word ? `${word.slice(0, 1).toUpperCase()}${word.slice(1)}` : ''))
    .join(' ');
}

export function normalizeSegmentBucketValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return '';
  if (Array.isArray(rawValue)) {
    const compact = rawValue
      .map((item) => String(item ?? '').trim())
      .filter((item) => item)
      .join(', ');
    return compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
  }
  const text = String(rawValue).trim();
  if (!text) return '';
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export function collectSegmentAnswerValues(field = null, rawValue = null) {
  const type = String(field?.type || '').trim();
  if (type === 'checkbox') {
    return Array.from(
      new Set(
        parseChoiceValues(rawValue)
          .map((value) => normalizeSegmentBucketValue(value))
          .filter(Boolean)
      )
    );
  }
  const normalized = normalizeSegmentBucketValue(rawValue);
  return normalized ? [normalized] : [];
}

import { resolveScaleFieldNames } from '../field-parser.js';

export function buildScoreBandSegmentDimension(fields = [], responseRows = []) {
  const scaleNames = resolveScaleFieldNames(fields);
  if (!scaleNames.length) return null;

  const bandMap = new Map([
    ['low', { label: 'Rendah (<=2.5)', total: 0 }],
    ['mid', { label: 'Sedang (>2.5 - <4)', total: 0 }],
    ['high', { label: 'Tinggi (>=4)', total: 0 }],
  ]);

  (Array.isArray(responseRows) ? responseRows : []).forEach((row) => {
    let answered = 0;
    let sum = 0;
    scaleNames.forEach((name) => {
      const parsed = Number(row?.answers?.[name]);
      if (!Number.isFinite(parsed)) return;
      if (parsed < 1 || parsed > 5) return;
      answered += 1;
      sum += parsed;
    });
    if (answered <= 0) return;

    const avg = sum / answered;
    const bucketId = avg >= 4 ? 'high' : avg > 2.5 ? 'mid' : 'low';
    const bucket = bandMap.get(bucketId);
    if (!bucket) return;
    bucket.total += 1;
  });

  const buckets = Array.from(bandMap.values());
  const total = buckets.reduce((sum, item) => sum + Number(item.total || 0), 0);
  if (total <= 0) return null;

  return {
    id: 'score_band',
    kind: 'derived',
    label: 'Band Skor Respons',
    metric: 'count',
    drilldownEligible: true,
    buckets: buckets.map((item) => ({
      label: item.label,
      total: Number(item.total || 0),
    })),
  };
}

export function buildRowScaleAverages(responseRows = [], scaleNames = []) {
  const rows = Array.isArray(responseRows) ? responseRows : [];
  const names = Array.isArray(scaleNames) ? scaleNames.filter(Boolean) : [];
  if (!rows.length || !names.length) return new Array(rows.length).fill(null);

  return rows.map((row) => {
    let answered = 0;
    let sum = 0;
    names.forEach((name) => {
      const parsed = Number(row?.answers?.[name]);
      if (!Number.isFinite(parsed)) return;
      if (parsed < 1 || parsed > 5) return;
      answered += 1;
      sum += parsed;
    });
    if (answered <= 0) return null;
    return sum / answered;
  });
}

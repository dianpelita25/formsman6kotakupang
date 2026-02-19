function parseExtraAnswers(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function maskName(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 2) return `${text[0]}*`;
  const first = text.slice(0, 1);
  const last = text.slice(-1);
  return `${first}${'*'.repeat(Math.max(2, text.length - 2))}${last}`;
}

export function normalizeRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    formVersionId: row.form_version_id,
    createdAt: row.created_at,
    namaGuru: row.nama_guru,
    lamaMengajar: row.lama_mengajar,
    mataPelajaran: row.mata_pelajaran,
    q1: toNumber(row.q1),
    q2: toNumber(row.q2),
    q3: toNumber(row.q3),
    q4: toNumber(row.q4),
    q5: toNumber(row.q5),
    q6: toNumber(row.q6),
    q7: toNumber(row.q7),
    q8: toNumber(row.q8),
    q9: toNumber(row.q9),
    q10: row.q10,
    q11: toNumber(row.q11),
    q12: toNumber(row.q12),
    extraAnswers: parseExtraAnswers(row.extra_answers),
  }));
}

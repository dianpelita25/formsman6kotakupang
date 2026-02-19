import { escapeCsvValue } from '../shared/csv/escape-csv-value.js';

const RESPONDENT_KEYS = ['namaGuru', 'lamaMengajar', 'mataPelajaran', 'nama', 'email', 'kelas', 'instansi'];

export function extractRespondent(payload) {
  const respondent = {};
  for (const key of RESPONDENT_KEYS) {
    if (payload[key] != null && String(payload[key]).trim() !== '') {
      respondent[key] = payload[key];
    }
  }
  return respondent;
}

export { escapeCsvValue };

export function formatAnswerForCsv(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(' | ');
  }
  return value ?? '';
}

export function toResponseListItem(row) {
  return {
    id: row.id,
    questionnaireVersionId: row.questionnaireVersionId,
    submittedAt: row.createdAt,
    respondent: row.respondent || {},
    answers: row.answers || {},
    payload: row.payload || {},
  };
}

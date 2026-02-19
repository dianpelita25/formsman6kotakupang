import { CORE_QUESTION_KEYS } from '../forms/core.js';
import { getPublishedFormSchema } from '../forms/service.js';
import { submitDefaultTenantQuestionnaireResponse } from '../questionnaires/service.js';
import { escapeCsvValue } from '../shared/csv/escape-csv-value.js';
import { maskName, normalizeRows, toNumber } from './service-utils.js';
import {
  getAllResponsesForCsv,
  getQ10Distribution,
  getQuestionAverages,
  getResponsesForAi,
  getSummaryStats,
  getTrend,
  insertResponse,
  listResponses,
} from './repository.js';
import { validateSubmissionPayload } from './validation.js';

export async function submitResponse(env, schoolId, payload) {
  const published = await getPublishedFormSchema(env, schoolId);
  if (!published) {
    return {
      ok: false,
      status: 404,
      message: 'Form aktif belum tersedia untuk sekolah ini.',
    };
  }

  const parsed = validateSubmissionPayload(published.fields, payload);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      message: parsed.message,
      errors: parsed.errors,
    };
  }

  const normalized = parsed.data;
  const core = {
    namaGuru: normalized.namaGuru,
    lamaMengajar: normalized.lamaMengajar,
    mataPelajaran: normalized.mataPelajaran,
  };
  for (const key of CORE_QUESTION_KEYS) {
    core[key] = normalized[key];
  }

  const extraAnswers = {};
  for (const field of published.extraFields) {
    extraAnswers[field.name] = normalized[field.name];
  }

  const inserted = await insertResponse(env, {
    schoolId,
    formVersionId: published.formVersionId,
    core,
    extraAnswers,
    payload: normalized,
  });

  if (!inserted) {
    return {
      ok: false,
      status: 500,
      message: 'Gagal menyimpan data.',
    };
  }

  const dualWriteResult = await submitDefaultTenantQuestionnaireResponse(env, schoolId, normalized);
  if (!dualWriteResult.ok) {
    console.error(
      `[DUAL_WRITE_WARNING] responses_v2 gagal sinkron untuk schoolId=${schoolId}: ${dualWriteResult.message || 'unknown error'}`
    );
  }

  return {
    ok: true,
    status: 201,
    data: {
      id: inserted.id,
      createdAt: inserted.created_at,
    },
  };
}

export async function getResponses(env, schoolId, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const search = String(query.search || '').trim();
  const reveal = String(query.reveal || '') === '1';
  const { total, items } = await listResponses(env, { schoolId, page, pageSize, search });
  const normalized = normalizeRows(items).map((row) => ({
    ...row,
    namaGuru: reveal ? row.namaGuru : maskName(row.namaGuru),
    namaGuruRaw: reveal ? row.namaGuru : undefined,
  }));
  return {
    page,
    pageSize,
    total,
    items: normalized,
  };
}

export async function getResponsesCsv(env, schoolId) {
  const rows = await getAllResponsesForCsv(env, schoolId);
  const normalized = normalizeRows(rows);
  const extraKeySet = new Set();
  for (const row of normalized) {
    Object.keys(row.extraAnswers || {}).forEach((key) => extraKeySet.add(key));
  }
  const extraKeys = Array.from(extraKeySet).sort();
  const headers = [
    'id',
    'created_at',
    'nama_guru',
    'lama_mengajar',
    'mata_pelajaran',
    ...CORE_QUESTION_KEYS,
    ...extraKeys,
  ];

  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of normalized) {
    const values = [
      row.id,
      row.createdAt,
      row.namaGuru,
      row.lamaMengajar,
      row.mataPelajaran,
      ...CORE_QUESTION_KEYS.map((key) => row[key]),
      ...extraKeys.map((key) => row.extraAnswers?.[key] ?? ''),
    ];
    lines.push(values.map(escapeCsvValue).join(','));
  }
  return lines.join('\n');
}

export async function getSummary(env, schoolId) {
  const row = await getSummaryStats(env, schoolId);
  return {
    totalResponses: toNumber(row?.total_responses),
    avgQ12: toNumber(row?.avg_q12),
    avgAiAdoption: toNumber(row?.avg_ai_adoption),
    interestedPct: toNumber(row?.interested_pct),
  };
}

export async function getDistribution(env, schoolId) {
  const averages = await getQuestionAverages(env, schoolId);
  const q10Rows = await getQ10Distribution(env, schoolId);
  const q10Options = ['Sangat Berminat', 'Berminat', 'Cukup Berminat', 'Kurang Berminat', 'Tidak Berminat'];
  const q10Map = new Map(q10Rows.map((row) => [row.q10, toNumber(row.total)]));

  return {
    questionAverages: {
      q1: toNumber(averages?.q1),
      q2: toNumber(averages?.q2),
      q3: toNumber(averages?.q3),
      q4: toNumber(averages?.q4),
      q5: toNumber(averages?.q5),
      q6: toNumber(averages?.q6),
      q7: toNumber(averages?.q7),
      q8: toNumber(averages?.q8),
      q9: toNumber(averages?.q9),
      q11: toNumber(averages?.q11),
      q12: toNumber(averages?.q12),
    },
    q10Distribution: q10Options.map((label) => ({
      label,
      total: q10Map.get(label) || 0,
    })),
  };
}

export async function getTrendAnalytics(env, schoolId, rawDays) {
  const days = Number.isFinite(Number(rawDays)) ? Math.max(7, Math.min(365, Number(rawDays))) : 30;
  const rows = await getTrend(env, schoolId, days);
  return {
    days,
    points: rows.map((row) => ({
      day: row.day,
      total: toNumber(row.total),
    })),
  };
}

export async function getAiSourceResponses(env, schoolId, days) {
  return getResponsesForAi(env, schoolId, days);
}

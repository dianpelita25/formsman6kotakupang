import { formFields } from '../form/schema.js';
import { validateSubmission } from './validation.js';
import {
  ensureSubmissionTable,
  getAllResponsesForCsv,
  getQ10Distribution,
  getQuestionAverages,
  getSubmissionTrend,
  getSummaryStats,
  insertSubmission,
} from './repository.js';

let tableEnsured = false;

async function ensureTableOnce() {
  if (tableEnsured) return;
  await ensureSubmissionTable();
  tableEnsured = true;
}

export async function submitForm(payload) {
  const parsed = validateSubmission(payload);

  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      message: 'Data form tidak valid.',
      errors: parsed.errors,
    };
  }

  await ensureTableOnce();
  const row = await insertSubmission(parsed.data);

  return {
    ok: true,
    status: 201,
    data: {
      id: row.id,
      createdAt: row.created_at,
    },
  };
}

export async function getAnalyticsSummary() {
  await ensureTableOnce();

  const summary = await getSummaryStats();

  return {
    totalResponses: Number(summary?.total_responses ?? 0),
    avgQ12: Number(summary?.avg_q12 ?? 0),
    avgAiAdoption: Number(summary?.avg_ai_adoption ?? 0),
    interestedPct: Number(summary?.interested_pct ?? 0),
  };
}

export async function getAnalyticsDistribution() {
  await ensureTableOnce();

  const averages = await getQuestionAverages();
  const q10Rows = await getQ10Distribution();

  const q10Options = ['Sangat Berminat', 'Berminat', 'Cukup Berminat', 'Kurang Berminat', 'Tidak Berminat'];
  const q10Map = new Map(q10Rows.map((row) => [row.q10, Number(row.total)]));

  return {
    questionAverages: {
      q1: Number(averages?.q1 ?? 0),
      q2: Number(averages?.q2 ?? 0),
      q3: Number(averages?.q3 ?? 0),
      q4: Number(averages?.q4 ?? 0),
      q5: Number(averages?.q5 ?? 0),
      q6: Number(averages?.q6 ?? 0),
      q7: Number(averages?.q7 ?? 0),
      q8: Number(averages?.q8 ?? 0),
      q9: Number(averages?.q9 ?? 0),
      q11: Number(averages?.q11 ?? 0),
      q12: Number(averages?.q12 ?? 0),
    },
    q10Distribution: q10Options.map((option) => ({
      label: option,
      total: q10Map.get(option) ?? 0,
    })),
  };
}

export async function getAnalyticsTrend(days = 30) {
  await ensureTableOnce();

  const safeDays = Number.isFinite(Number(days)) ? Math.max(7, Math.min(365, Number(days))) : 30;
  const trendRows = await getSubmissionTrend({ days: safeDays });

  return {
    days: safeDays,
    points: trendRows.map((row) => ({
      day: row.day,
      total: Number(row.total),
    })),
  };
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function buildQuestionLabelMap() {
  return formFields
    .filter((field) => field.name && field.name.startsWith('q') && field.label)
    .reduce((map, field) => {
      map[field.name] = field.label;
      return map;
    }, {});
}

export async function getAnalyticsCsv() {
  await ensureTableOnce();

  const rows = await getAllResponsesForCsv();
  const questionLabels = buildQuestionLabelMap();
  const headers = [
    'id',
    'created_at',
    'nama_guru',
    'lama_mengajar',
    'mata_pelajaran',
    'q1',
    'q2',
    'q3',
    'q4',
    'q5',
    'q6',
    'q7',
    'q8',
    'q9',
    'q10',
    'q11',
    'q12',
  ];

  const headerLabels = headers.map((key) => {
    const label = questionLabels[key];
    if (!label) return key;
    const suffix = key.slice(1);
    return `Q${suffix} - ${label}`;
  });

  const lines = [headerLabels.map((value) => escapeCsvValue(value)).join(',')];

  for (const row of rows) {
    const line = headers.map((header) => escapeCsvValue(row[header])).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}

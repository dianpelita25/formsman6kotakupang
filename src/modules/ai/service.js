import {
  ensureAiAnalysisTable,
  getLatestAiAnalysis,
  insertAiAnalysis,
} from './repository.js';
import { getResponsesForAi } from '../submission/repository.js';
import { getAnalyticsDistribution, getAnalyticsSummary } from '../submission/service.js';

let aiTableEnsured = false;

async function ensureAiTableOnce() {
  if (aiTableEnsured) return;
  await ensureAiAnalysisTable();
  aiTableEnsured = true;
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} belum diset di environment.`);
  }
  return value;
}

function buildPrompt({ summary, distribution, responses }) {
  const header = [
    'Kamu adalah analis data pendidikan.',
    'Tugas: berikan analisis singkat, insight utama, pola menarik, dan rekomendasi tindak lanjut.',
    'Gunakan bahasa Indonesia yang jelas, ringkas, dan berbasis data.',
    'Gunakan semua data yang tersedia (tanpa filter waktu).',
  ].join(' ');

  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const responsesBlock = JSON.stringify(responses, null, 2);

  return [
    header,
    '',
    'Ringkasan statistik:',
    summaryBlock,
    '',
    'Distribusi & rata-rata:',
    distributionBlock,
    '',
    'Semua respons (tanpa nama):',
    responsesBlock,
  ].join('\n');
}

export async function analyzeAi() {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const model = requireEnv('GEMINI_MODEL');

  const [summary, distribution, responses] = await Promise.all([
    getAnalyticsSummary(),
    getAnalyticsDistribution(),
    getResponsesForAi(),
  ]);

  const prompt = buildPrompt({ summary, distribution, responses });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Gemini request gagal: ${resp.status} ${errorText}`);
  }

  const json = await resp.json();
  const analysis =
    json?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ??
    'Tidak ada hasil analisis.';

  const result = {
    analysis,
    meta: {
      totalResponses: Number(summary?.totalResponses ?? 0),
      summary,
      distribution,
    },
  };

  await ensureAiTableOnce();
  const saved = await insertAiAnalysis(result);

  return {
    ...result,
    createdAt: saved?.created_at ?? null,
  };
}

export async function getLatestAi() {
  await ensureAiTableOnce();
  const row = await getLatestAiAnalysis();

  if (!row) return null;

  return {
    analysis: row.analysis,
    meta: row.meta,
    createdAt: row.created_at,
  };
}

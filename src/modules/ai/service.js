import { getResponsesForAi } from '../submission/repository.js';
import { getAnalyticsDistribution, getAnalyticsSummary, getAnalyticsTrend } from '../submission/service.js';

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} belum diset di environment.`);
  }
  return value;
}

function buildPrompt({ days, summary, distribution, trend, responses }) {
  const header = [
    'Kamu adalah analis data pendidikan.',
    'Tugas: berikan analisis singkat, insight utama, pola menarik, dan rekomendasi tindak lanjut.',
    'Gunakan bahasa Indonesia yang jelas, ringkas, dan berbasis data.',
    `Periode data: ${days} hari terakhir.`,
  ].join(' ');

  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const trendBlock = JSON.stringify(trend, null, 2);
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
    'Trend harian:',
    trendBlock,
    '',
    'Semua respons (tanpa nama):',
    responsesBlock,
  ].join('\n');
}

export async function analyzeAi({ days = 30 } = {}) {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const model = requireEnv('GEMINI_MODEL');

  const [summary, distribution, trend, responses] = await Promise.all([
    getAnalyticsSummary(),
    getAnalyticsDistribution(),
    getAnalyticsTrend(days),
    getResponsesForAi({ days }),
  ]);

  const prompt = buildPrompt({ days, summary, distribution, trend, responses });

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

  return {
    analysis,
    meta: {
      days,
      totalResponses: Number(summary?.totalResponses ?? 0),
      summary,
      distribution,
      trend,
    },
  };
}

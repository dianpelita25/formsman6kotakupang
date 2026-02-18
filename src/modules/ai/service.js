import { getLatestAiAnalysis, getLatestAiAnalysisV2, insertAiAnalysis, insertAiAnalysisV2 } from './repository.js';
import { getPublishedFormSchema } from '../forms/service.js';
import { getAnalyticsDistribution, getAnalyticsSummary } from '../analytics/service.js';
import { getAiSourceResponses } from '../submissions/service.js';
import { ensurePlatformSchema, LEGACY_SCHOOL_SLUG } from '../../lib/db/bootstrap.js';
import { resolveSchoolBySlug } from '../schools/service.js';
import { normalizeAiAnalysisMode, normalizeAiMode, AI_ANALYSIS_MODES } from './modes.js';
import { resolveRenderedPrompt } from '../ai-prompts/service.js';
import {
  getTenantQuestionnaireAiSource,
  getTenantQuestionnaireAnalyticsDistribution,
  getTenantQuestionnaireAnalyticsSummary,
} from '../questionnaires/service.js';
import { findDefaultQuestionnaireByTenantId, findQuestionnaireByLegacyFormVersionId } from '../questionnaires/repository.js';

export { AI_ANALYSIS_MODES, normalizeAiMode, normalizeAiAnalysisMode };

function requireEnv(env, key) {
  const value = env?.[key];
  if (!value) {
    throw new Error(`${key} belum diset.`);
  }
  return value;
}

function buildPromptLegacy({ mode, schoolName, summary, distribution, responses }) {
  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const responsesBlock = JSON.stringify(responses, null, 2);

  if (mode === AI_ANALYSIS_MODES.EXTERNAL_PEMERINTAH) {
    return [
      `Anda analis kebijakan pendidikan. Buat laporan formal untuk pemda/dinas.`,
      `Sekolah: ${schoolName}`,
      `Gunakan bahasa Indonesia formal. Jangan mengarang angka.`,
      `Wajib tampilkan ringkasan eksekutif, temuan data, rekomendasi 30-90 hari, dan keterbatasan data.`,
      '',
      'Summary:',
      summaryBlock,
      '',
      'Distribution:',
      distributionBlock,
      '',
      'Responses:',
      responsesBlock,
    ].join('\n');
  }

  if (mode === AI_ANALYSIS_MODES.EXTERNAL_MITRA) {
    return [
      'Anda analis bisnis dampak untuk memo mitra/sponsor/investor.',
      `Sekolah: ${schoolName}`,
      'Jangan mengarang data. Fokus traction, risiko, dan rencana 90 hari.',
      '',
      'Summary:',
      summaryBlock,
      '',
      'Distribution:',
      distributionBlock,
      '',
      'Responses:',
      responsesBlock,
    ].join('\n');
  }

  if (mode === AI_ANALYSIS_MODES.LIVE_GURU) {
    return [
      'Anda analis program untuk materi presentasi live ke guru dan pimpinan sekolah.',
      `Sekolah: ${schoolName}`,
      'Outputkan 2 slide ringkasan + script 60-90 detik.',
      '',
      'Summary:',
      summaryBlock,
      '',
      'Distribution:',
      distributionBlock,
    ].join('\n');
  }

  return [
    'Anda analis internal produk AITI.',
    `Sekolah: ${schoolName}`,
    'Buat ringkasan eksekutif, KPI, temuan utama, segmentasi, dan rekomendasi aksi.',
    'Jangan mengarang angka. Gunakan data yang ada.',
    '',
    'Summary:',
    summaryBlock,
    '',
    'Distribution:',
    distributionBlock,
    '',
    'Responses:',
    responsesBlock,
  ].join('\n');
}

async function callGemini(env, prompt) {
  const apiKey = requireEnv(env, 'GEMINI_API_KEY');
  const model = requireEnv(env, 'GEMINI_MODEL');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request gagal: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return (
    payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || 'Tidak ada hasil analisa.'
  );
}

export async function analyzeSchoolAi(env, { school, mode }) {
  const normalizedMode = normalizeAiMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode analisa AI tidak valid.');
  }

  const [summary, distribution, responses, published] = await Promise.all([
    getAnalyticsSummary(env, school.id),
    getAnalyticsDistribution(env, school.id),
    normalizedMode === AI_ANALYSIS_MODES.LIVE_GURU ? Promise.resolve([]) : getAiSourceResponses(env, school.id),
    getPublishedFormSchema(env, school.id),
  ]);

  const questionnaire =
    (published?.formVersionId && (await findQuestionnaireByLegacyFormVersionId(env, published.formVersionId))) ||
    (await findDefaultQuestionnaireByTenantId(env, school.id));

  let prompt = '';
  try {
    const resolved = await resolveRenderedPrompt(env, {
      mode: normalizedMode,
      school,
      tenant: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        tenantType: 'school',
      },
      questionnaire,
      summary,
      distribution,
      responses,
    });
    prompt = resolved.rendered;
  } catch {
    prompt = buildPromptLegacy({
      mode: normalizedMode,
      schoolName: school.name,
      summary,
      distribution,
      responses,
    });
  }

  const analysis = await callGemini(env, prompt);
  const meta = {
    summary,
    distribution,
    totalResponses: Number(summary?.totalResponses || 0),
  };

  const saved = await insertAiAnalysis(env, {
    schoolId: school.id,
    formVersionId: published?.formVersionId || null,
    mode: normalizedMode,
    analysis,
    meta,
  });

  if (questionnaire?.id) {
    try {
      await insertAiAnalysisV2(env, {
        legacyAiAnalysisId: saved?.id || null,
        tenantId: school.id,
        questionnaireId: questionnaire.id,
        questionnaireVersionId: null,
        mode: normalizedMode,
        analysis,
        meta,
      });
    } catch (error) {
      console.error(
        `[DUAL_WRITE_WARNING] ai_analysis_v2 gagal sinkron untuk school=${school.id}, mode=${normalizedMode}: ${
          error?.message || error
        }`
      );
    }
  }

  return {
    mode: normalizedMode,
    analysis,
    meta,
    createdAt: saved?.created_at || null,
  };
}

export async function getLatestSchoolAi(env, { school, mode }) {
  const normalizedMode = normalizeAiMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode analisa AI tidak valid.');
  }

  const latest = await getLatestAiAnalysis(env, {
    schoolId: school.id,
    mode: normalizedMode,
  });

  if (!latest) {
    return {
      mode: normalizedMode,
      analysis: '',
      meta: null,
      createdAt: null,
    };
  }

  return {
    mode: latest.mode,
    analysis: latest.analysis,
    meta: latest.meta,
    createdAt: latest.created_at,
  };
}

export async function analyzeTenantQuestionnaireAi(
  env,
  { tenant, questionnaireSlug, mode, questionnaireVersionId = null, filters = {} }
) {
  const normalizedMode = normalizeAiMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode analisa AI tidak valid.');
  }

  const normalizedFromFilter = String(filters?.from || '').trim() || null;
  const normalizedToFilter = String(filters?.to || '').trim() || null;
  const baseQuery = {
    ...filters,
    from: normalizedFromFilter || undefined,
    to: normalizedToFilter || undefined,
    questionnaireVersionId: questionnaireVersionId || undefined,
  };

  const [summaryResult, distributionResult, sourceResult] = await Promise.all([
    getTenantQuestionnaireAnalyticsSummary(env, tenant.id, questionnaireSlug, baseQuery),
    getTenantQuestionnaireAnalyticsDistribution(env, tenant.id, questionnaireSlug, baseQuery),
    normalizedMode === AI_ANALYSIS_MODES.LIVE_GURU
      ? Promise.resolve({
          ok: true,
          data: {
            responses: [],
          },
        })
      : getTenantQuestionnaireAiSource(env, tenant.id, questionnaireSlug, baseQuery),
  ]);

  if (!summaryResult.ok) {
    throw new Error(summaryResult.message || 'Gagal memuat ringkasan analytics.');
  }
  if (!distributionResult.ok) {
    throw new Error(distributionResult.message || 'Gagal memuat distribusi analytics.');
  }
  if (!sourceResult.ok) {
    throw new Error(sourceResult.message || 'Gagal memuat data AI source.');
  }

  const questionnaire = summaryResult.data.questionnaire;
  const selectedVersionId = summaryResult.data.questionnaireVersionId || questionnaireVersionId || null;
  const summary = {
    totalResponses: summaryResult.data.totalResponses,
    responsesToday: summaryResult.data.responsesToday,
    lastSubmittedAt: summaryResult.data.lastSubmittedAt,
    avgScaleOverall: summaryResult.data.avgScaleOverall,
    totalScaleQuestions: summaryResult.data.totalScaleQuestions,
    totalRadioAnswers: summaryResult.data.totalRadioAnswers,
    totalTextAnswers: summaryResult.data.totalTextAnswers,
    questionAverages: summaryResult.data.questionAverages,
  };
  const distribution = {
    totalResponses: distributionResult.data.totalResponses,
    questions: distributionResult.data.questions,
    questionAverages: distributionResult.data.questionAverages,
  };
  const responses = sourceResult.data.responses || [];

  let prompt = '';
  try {
    const resolved = await resolveRenderedPrompt(env, {
      mode: normalizedMode,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        tenantType: tenant.tenant_type || tenant.tenantType || '',
      },
      questionnaire,
      summary,
      distribution,
      responses,
    });
    prompt = resolved.rendered;
  } catch {
    prompt = buildPromptLegacy({
      mode: normalizedMode,
      schoolName: tenant.name,
      summary,
      distribution,
      responses,
    });
  }

  const analysis = await callGemini(env, prompt);
  const meta = {
    summary,
    distribution,
    totalResponses: Number(summary?.totalResponses || 0),
    questionnaireVersionId: selectedVersionId,
    filters: {
      from: normalizedFromFilter,
      to: normalizedToFilter,
    },
  };

  const saved = await insertAiAnalysisV2(env, {
    tenantId: tenant.id,
    questionnaireId: questionnaire.id,
    questionnaireVersionId: selectedVersionId,
    mode: normalizedMode,
    analysis,
    meta,
  });

  return {
    mode: normalizedMode,
    analysis,
    meta,
    createdAt: saved?.created_at || null,
  };
}

export async function getLatestTenantQuestionnaireAi(
  env,
  { tenant, questionnaireId, mode, questionnaireVersionId = null, from = null, to = null }
) {
  const normalizedMode = normalizeAiMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode analisa AI tidak valid.');
  }

  const normalizedFromFilter = String(from || '').trim() || null;
  const normalizedToFilter = String(to || '').trim() || null;
  const latest = await getLatestAiAnalysisV2(env, {
    tenantId: tenant.id,
    questionnaireId,
    questionnaireVersionId,
    from: normalizedFromFilter,
    to: normalizedToFilter,
    mode: normalizedMode,
  });

  if (!latest) {
    return {
      mode: normalizedMode,
      analysis: '',
      meta: null,
      createdAt: null,
    };
  }

  return {
    mode: latest.mode,
    analysis: latest.analysis,
    meta: latest.meta,
    createdAt: latest.created_at,
  };
}

async function resolveLegacySchool(env) {
  await ensurePlatformSchema(env);
  const school = await resolveSchoolBySlug(env, LEGACY_SCHOOL_SLUG, { onlyActive: false });
  if (!school) {
    throw new Error('Sekolah legacy tidak ditemukan.');
  }
  return school;
}

export async function analyzeAi({ mode = AI_ANALYSIS_MODES.INTERNAL } = {}) {
  const school = await resolveLegacySchool(process.env);
  return analyzeSchoolAi(process.env, { school, mode });
}

export async function getLatestAi({ mode = AI_ANALYSIS_MODES.INTERNAL } = {}) {
  const school = await resolveLegacySchool(process.env);
  return getLatestSchoolAi(process.env, { school, mode });
}

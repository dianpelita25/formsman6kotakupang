import { getLatestAiAnalysis, insertAiAnalysis, insertAiAnalysisV2 } from './repository.js';
import { getPublishedFormSchema } from '../forms/service.js';
import { getAnalyticsDistribution, getAnalyticsSummary } from '../analytics/service.js';
import { getAiSourceResponses } from '../submissions/service.js';
import { resolveRenderedPrompt } from '../ai-prompts/service.js';
import {
  getDefaultQuestionnaireByTenantId,
  getQuestionnaireByLegacyFormVersionId,
} from '../questionnaires/service.js';
import { AI_ANALYSIS_MODES, normalizeAiMode } from '../shared/ai-modes.js';
import { callGemini } from './gemini-client.js';
import { buildPromptLegacy } from './prompt-fallback.js';

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
    (published?.formVersionId && (await getQuestionnaireByLegacyFormVersionId(env, published.formVersionId))) ||
    (await getDefaultQuestionnaireByTenantId(env, school.id));

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

import { getLatestAiAnalysisV2, insertAiAnalysisV2 } from './repository.js';
import { resolveRenderedPrompt } from '../ai-prompts/service.js';
import { getTenantQuestionnaireAnalyticsBundle } from '../questionnaires/service.js';
import { AI_ANALYSIS_MODES, normalizeAiMode } from '../shared/ai-modes.js';
import { callGemini } from './gemini-client.js';
import { buildPromptLegacy } from './prompt-fallback.js';

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

  const analyticsBundle = await getTenantQuestionnaireAnalyticsBundle(env, tenant.id, questionnaireSlug, baseQuery, {
    sourceLimit: normalizedMode === AI_ANALYSIS_MODES.LIVE_GURU ? 0 : 120,
  });
  if (!analyticsBundle.ok) {
    throw new Error(analyticsBundle.message || 'Gagal memuat data analytics questionnaire.');
  }

  const questionnaire = analyticsBundle.data.questionnaire;
  const selectedVersionId = analyticsBundle.data.questionnaireVersionId || questionnaireVersionId || null;
  const summary = analyticsBundle.data.summary || {};
  const distribution = analyticsBundle.data.distribution || {};
  const responses = analyticsBundle.data.responses || [];

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

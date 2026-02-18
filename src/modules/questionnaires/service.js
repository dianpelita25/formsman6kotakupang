import { getDefaultDraft } from '../forms/core.js';
import { validateSubmissionPayload } from '../submissions/validation.js';
import {
  createPublishedVersion,
  createQuestionnaire,
  ensureDefaultQuestionnaireForTenant,
  findQuestionnaireByTenantAndSlug,
  findDefaultQuestionnaireByTenantId,
  getDraftVersionByQuestionnaireId,
  getQuestionnaireSummaryStatsV2,
  getQuestionnaireTrendRowsV2,
  getQuestionnaireVersionById,
  getPublishedVersionByQuestionnaireId,
  insertResponseV2,
  listQuestionnaireVersionsByQuestionnaireId,
  listQuestionnaireResponsesForAggregation,
  listQuestionnaireResponsesV2,
  listActiveQuestionnairesByTenantId,
  listQuestionnairesByTenantId,
  publishDraftVersion,
  saveDraftVersion,
  updateQuestionnaire,
} from './repository.js';
import { normalizeQuestionnaireCreatePayload, normalizeQuestionnaireDraftInput } from './schema.js';

const RESPONDENT_KEYS = ['namaGuru', 'lamaMengajar', 'mataPelajaran', 'nama', 'email', 'kelas', 'instansi'];

export async function ensureTenantQuestionnaireInitialized(env, tenantId, actorId = null) {
  const questionnaire = await ensureDefaultQuestionnaireForTenant(env, tenantId, actorId);
  const published = await getPublishedVersionByQuestionnaireId(env, questionnaire.id);
  if (!published) {
    const draft = getDefaultDraft();
    await createPublishedVersion(env, {
      questionnaireId: questionnaire.id,
      meta: draft.meta,
      schema: {
        fields: draft.coreFields,
        coreFields: draft.coreFields,
        extraFields: [],
      },
      actorId,
    });
  }
  await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId);
  return questionnaire;
}

export async function listTenantQuestionnaires(env, tenantId) {
  const rows = await listQuestionnairesByTenantId(env, tenantId);
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description || '',
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    totalResponses: Number(row.total_responses || 0),
  }));
}

export async function listPublicQuestionnairesByTenant(env, tenantId) {
  const rows = await listActiveQuestionnairesByTenantId(env, tenantId);
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description || '',
    isDefault: row.is_default,
  }));
}

export async function createTenantQuestionnaire(env, tenantId, actorId, payload) {
  const normalized = normalizeQuestionnaireCreatePayload(payload);
  if (!normalized.ok) {
    return normalized;
  }

  try {
    const created = await createQuestionnaire(env, {
      tenantId,
      slug: normalized.data.slug,
      name: normalized.data.name,
      category: normalized.data.category,
      description: normalized.data.description,
      createdBy: actorId,
      isDefault: false,
    });

    const defaultDraft = getDefaultDraft();
    await createPublishedVersion(env, {
      questionnaireId: created.id,
      meta: defaultDraft.meta,
      schema: {
        fields: defaultDraft.coreFields,
        coreFields: defaultDraft.coreFields,
        extraFields: [],
      },
      actorId,
    });
    await getDraftVersionByQuestionnaireId(env, created.id, actorId);

    return {
      ok: true,
      status: 201,
      data: created,
    };
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return { ok: false, status: 409, message: 'Slug questionnaire sudah dipakai dalam organisasi ini.' };
    }
    throw error;
  }
}

export async function patchQuestionnaire(env, tenantId, questionnaireId, payload) {
  const next = {};
  if (payload?.name != null) {
    const value = String(payload.name || '').trim();
    if (!value) return { ok: false, status: 400, message: 'Nama questionnaire tidak valid.' };
    next.name = value;
  }
  if (payload?.slug != null) {
    const normalized = String(payload.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!normalized) return { ok: false, status: 400, message: 'Slug questionnaire tidak valid.' };
    next.slug = normalized;
  }
  if (payload?.category != null) {
    next.category = String(payload.category || '').trim().toLowerCase() || 'general_feedback';
  }
  if (payload?.description != null) {
    next.description = String(payload.description || '').trim();
  }
  if (payload?.isActive != null) {
    next.isActive = Boolean(payload.isActive);
  }

  if (!Object.keys(next).length) {
    return { ok: false, status: 400, message: 'Tidak ada perubahan.' };
  }

  const updated = await updateQuestionnaire(env, questionnaireId, next);
  if (!updated) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  if (updated.tenantId !== tenantId) return { ok: false, status: 403, message: 'Forbidden' };

  return { ok: true, status: 200, data: updated };
}

export async function getTenantQuestionnaireDraft(env, tenantId, questionnaireSlug, actorId) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  const draft = await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId);
  if (!draft) return { ok: false, status: 404, message: 'Draft questionnaire tidak ditemukan.' };
  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      draft,
    },
  };
}

export async function getTenantQuestionnaireVersions(env, tenantId, questionnaireSlug) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  const versions = await listQuestionnaireVersionsByQuestionnaireId(env, questionnaire.id);
  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      versions: versions.map((entry) => ({
        id: entry.id,
        version: entry.version,
        status: entry.status,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt,
      })),
    },
  };
}

export async function updateTenantQuestionnaireDraft(env, tenantId, questionnaireSlug, actorId, payload) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  const normalized = normalizeQuestionnaireDraftInput(payload);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      message: normalized.message,
      errors: normalized.errors,
    };
  }

  const draft = await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId);
  if (!draft) return { ok: false, status: 404, message: 'Draft questionnaire tidak ditemukan.' };

  const saved = await saveDraftVersion(env, {
    questionnaireId: questionnaire.id,
    draftId: draft.id,
    meta: normalized.data.meta,
    schema: {
      fields: normalized.data.fields,
      ...normalized.data.schema,
    },
    actorId,
  });

  if (!saved) {
    return { ok: false, status: 500, message: 'Gagal menyimpan draft questionnaire.' };
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      draft: saved,
    },
  };
}

export async function publishTenantQuestionnaireDraft(env, tenantId, questionnaireSlug, actorId) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };

  let published;
  try {
    published = await publishDraftVersion(env, {
      questionnaireId: questionnaire.id,
      actorId,
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('uq_questionnaire_versions_one_published') || message.includes('duplicate key value')) {
      return {
        ok: false,
        status: 409,
        message: 'Terjadi konflik publish. Muat ulang draf lalu coba publish lagi.',
      };
    }
    throw error;
  }
  if (!published) return { ok: false, status: 404, message: 'Draft questionnaire tidak ditemukan.' };

  await getDraftVersionByQuestionnaireId(env, questionnaire.id, actorId);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      published,
    },
  };
}

export async function getPublishedQuestionnaireSchemaBySlug(env, tenantId, questionnaireSlug) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire || !questionnaire.isActive) {
    return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  }

  const published = await getPublishedVersionByQuestionnaireId(env, questionnaire.id);
  if (!published) {
    return { ok: false, status: 404, message: 'Questionnaire belum dipublish.' };
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire,
      version: published.version,
      questionnaireVersionId: published.id,
      meta: published.meta,
      fields: Array.isArray(published.schema?.fields) ? published.schema.fields : [],
    },
  };
}

function extractRespondent(payload) {
  const respondent = {};
  for (const key of RESPONDENT_KEYS) {
    if (payload[key] != null && String(payload[key]).trim() !== '') {
      respondent[key] = payload[key];
    }
  }
  return respondent;
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function formatAnswerForCsv(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(' | ');
  }
  return value ?? '';
}

function parseChoiceValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const text = String(value || '').trim();
  if (!text) return [];
  return [text];
}

function parseJsonDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeFromFilter(rawFrom) {
  const date = parseJsonDate(rawFrom);
  return date ? date.toISOString() : null;
}

function normalizeToFilter(rawTo) {
  const raw = String(rawTo || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }

  const parsed = parseJsonDate(raw);
  return parsed ? parsed.toISOString() : null;
}

function normalizeSearch(rawSearch) {
  const search = String(rawSearch || '').trim();
  if (!search) return '';
  return search.slice(0, 120);
}

function normalizePage(rawPage) {
  const page = Number(rawPage);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

function normalizePageSize(rawPageSize) {
  const pageSize = Number(rawPageSize);
  if (!Number.isFinite(pageSize)) return 20;
  return Math.min(100, Math.max(1, Math.floor(pageSize)));
}

function normalizeDays(rawDays) {
  const days = Number(rawDays);
  if (!Number.isFinite(days)) return 30;
  return Math.max(7, Math.min(365, Math.floor(days)));
}

function toResponseListItem(row) {
  return {
    id: row.id,
    questionnaireVersionId: row.questionnaireVersionId,
    submittedAt: row.createdAt,
    respondent: row.respondent || {},
    answers: row.answers || {},
    payload: row.payload || {},
  };
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

function resolveTrendStart(fromIso, days) {
  const byDays = addDays(new Date(), -days + 1);
  byDays.setUTCHours(0, 0, 0, 0);
  if (!fromIso) return byDays.toISOString();
  const fromDate = new Date(fromIso);
  if (Number.isNaN(fromDate.getTime())) return byDays.toISOString();
  return fromDate > byDays ? fromDate.toISOString() : byDays.toISOString();
}

function resolveTrendEnd(toIso) {
  if (!toIso) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  const toExclusive = new Date(toIso);
  if (Number.isNaN(toExclusive.getTime())) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  // "to" filter is exclusive in SQL, so end day on chart must be previous day.
  const inclusive = new Date(toExclusive.getTime() - 1);
  inclusive.setUTCHours(0, 0, 0, 0);
  return inclusive;
}

function normalizeCriterion(rawValue) {
  const text = String(rawValue || '').trim();
  return text || null;
}

function resolveQuestionCode(field, index) {
  const name = String(field?.name || '').trim();
  const match = name.match(/^q0*([1-9]\d*)$/i);
  if (match) {
    return `Q${Number(match[1])}`;
  }
  return `Q${index + 1}`;
}

function toQuestionDescriptor(field, index) {
  return {
    ...field,
    questionCode: resolveQuestionCode(field, index),
    criterion: normalizeCriterion(field?.criterion),
  };
}

function resolveCriterionBucket(criterion) {
  return normalizeCriterion(criterion) || 'Tanpa Kriteria';
}

function buildCriteriaSummary(questions = []) {
  const criteriaMap = new Map();

  questions.forEach((question) => {
    const criterion = resolveCriterionBucket(question?.criterion);
    if (!criteriaMap.has(criterion)) {
      criteriaMap.set(criterion, {
        criterion,
        totalQuestions: 0,
        totalScaleQuestions: 0,
        totalScaleAnswered: 0,
        scaleWeightedSum: 0,
        questionCodes: [],
      });
    }

    const entry = criteriaMap.get(criterion);
    entry.totalQuestions += 1;
    if (question?.questionCode) entry.questionCodes.push(String(question.questionCode));

    if (question?.type === 'scale') {
      entry.totalScaleQuestions += 1;
      const totalAnswered = Number(question.totalAnswered || 0);
      const average = Number(question.average || 0);
      if (totalAnswered > 0 && Number.isFinite(average)) {
        entry.totalScaleAnswered += totalAnswered;
        entry.scaleWeightedSum += average * totalAnswered;
      }
    }
  });

  return Array.from(criteriaMap.values())
    .map((entry) => ({
      criterion: entry.criterion,
      totalQuestions: entry.totalQuestions,
      totalScaleQuestions: entry.totalScaleQuestions,
      totalScaleAnswered: entry.totalScaleAnswered,
      avgScale:
        entry.totalScaleAnswered > 0 ? Number((entry.scaleWeightedSum / entry.totalScaleAnswered).toFixed(2)) : 0,
      questionCodes: Array.from(new Set(entry.questionCodes)),
    }))
    .sort((a, b) => a.criterion.localeCompare(b.criterion, 'id'));
}

function titleCaseSegmentKey(key = '') {
  const text = String(key || '').trim();
  if (!text) return 'Dimensi';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word ? `${word.slice(0, 1).toUpperCase()}${word.slice(1)}` : ''))
    .join(' ');
}

function normalizeSegmentBucketValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return '';
  if (Array.isArray(rawValue)) {
    const compact = rawValue
      .map((item) => String(item ?? '').trim())
      .filter((item) => item)
      .join(', ');
    return compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
  }
  const text = String(rawValue).trim();
  if (!text) return '';
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function buildCriterionSegmentDimension(criteriaSummary = []) {
  const rows = Array.isArray(criteriaSummary) ? criteriaSummary : [];
  if (!rows.length) return null;
  const buckets = rows.map((row) => ({
    label: String(row.criterion || 'Tanpa Kriteria'),
    total: Number(row.totalScaleAnswered || 0),
    totalQuestions: Number(row.totalQuestions || 0),
    totalScaleQuestions: Number(row.totalScaleQuestions || 0),
    avgScale: Number(row.avgScale || 0),
  }));
  return {
    id: 'criteria',
    kind: 'criteria',
    label: 'Kriteria Soal',
    metric: 'avg_scale',
    buckets,
  };
}

function buildScoreBandSegmentDimension(fields = [], responseRows = []) {
  const scaleNames = (Array.isArray(fields) ? fields : [])
    .filter((field) => String(field?.type || '').trim() === 'scale')
    .map((field) => String(field.name || '').trim())
    .filter((name) => name);
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
    buckets: buckets.map((item) => ({
      label: item.label,
      total: Number(item.total || 0),
    })),
  };
}

function buildRespondentSegmentDimensions(responseRows = []) {
  const rows = Array.isArray(responseRows) ? responseRows : [];
  if (!rows.length) return [];

  const valueMaps = new Map();
  rows.forEach((row) => {
    const respondent = row?.respondent && typeof row.respondent === 'object' ? row.respondent : {};
    Object.entries(respondent).forEach(([key, rawValue]) => {
      const normalizedValue = normalizeSegmentBucketValue(rawValue);
      if (!normalizedValue) return;
      if (!valueMaps.has(key)) valueMaps.set(key, new Map());
      const map = valueMaps.get(key);
      map.set(normalizedValue, Number(map.get(normalizedValue) || 0) + 1);
    });
  });

  const dimensions = [];
  valueMaps.forEach((valueMap, key) => {
    const entries = Array.from(valueMap.entries()).map(([value, total]) => ({ label: value, total: Number(total || 0) }));
    const uniqueCount = entries.length;
    if (uniqueCount < 2 || uniqueCount > 12) return;
    const answeredCount = entries.reduce((sum, item) => sum + item.total, 0);
    if (answeredCount < 2) return;
    const buckets = entries.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'id'));

    dimensions.push({
      id: `respondent:${key}`,
      kind: 'respondent',
      label: titleCaseSegmentKey(key),
      key,
      metric: 'count',
      buckets,
    });
  });

  return dimensions.sort((a, b) => {
    const aTop = Number(a.buckets?.[0]?.total || 0);
    const bTop = Number(b.buckets?.[0]?.total || 0);
    if (aTop !== bTop) return bTop - aTop;
    return String(a.label || '').localeCompare(String(b.label || ''), 'id');
  });
}

function buildSegmentSummary(fields = [], responseRows = [], criteriaSummary = []) {
  const dimensions = [];
  const criterionDimension = buildCriterionSegmentDimension(criteriaSummary);
  if (criterionDimension) dimensions.push(criterionDimension);

  const scoreBandDimension = buildScoreBandSegmentDimension(fields, responseRows);
  if (scoreBandDimension) dimensions.push(scoreBandDimension);

  const respondentDimensions = buildRespondentSegmentDimensions(responseRows);
  dimensions.push(...respondentDimensions);

  return {
    totalDimensions: dimensions.length,
    dimensions,
  };
}

function resolveVersionFields(version) {
  const fields = Array.isArray(version?.schema?.fields) ? version.schema.fields : [];
  return fields
    .filter((field) => field && typeof field === 'object' && typeof field.name === 'string')
    .map((field, index) => toQuestionDescriptor(field, index));
}

function computeDistribution(fields, responseRows) {
  const byQuestion = [];
  const questionAverages = {};
  const scaleAverages = [];
  let totalScaleAverage = 0;
  let totalScaleQuestions = 0;
  let totalChoiceAnswers = 0;
  let totalCheckboxAnswers = 0;
  let totalTextAnswers = 0;
  let totalQuestionsWithCriterion = 0;

  for (const field of fields) {
    if (field.criterion) totalQuestionsWithCriterion += 1;
    if (field.type === 'scale') {
      const counts = new Map([
        ['1', 0],
        ['2', 0],
        ['3', 0],
        ['4', 0],
        ['5', 0],
      ]);
      let total = 0;
      let sum = 0;

      responseRows.forEach((row) => {
        const value = row.answers?.[field.name];
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        if (parsed < 1 || parsed > 5) return;
        const key = String(parsed);
        counts.set(key, Number(counts.get(key) || 0) + 1);
        total += 1;
        sum += parsed;
      });

      const average = total > 0 ? sum / total : 0;
      questionAverages[field.name] = Number(average.toFixed(2));
      totalScaleAverage += average;
      totalScaleQuestions += 1;
      scaleAverages.push({
        name: field.name,
        label: field.label,
        questionCode: field.questionCode,
        criterion: field.criterion,
        average: Number(average.toFixed(2)),
        totalAnswered: total,
      });

      byQuestion.push({
        name: field.name,
        label: field.label,
        questionCode: field.questionCode,
        criterion: field.criterion,
        type: field.type,
        fromLabel: field.fromLabel || 'Rendah',
        toLabel: field.toLabel || 'Tinggi',
        totalAnswered: total,
        average: Number(average.toFixed(2)),
        counts: Array.from(counts.entries()).map(([label, totalValue]) => ({ label, total: totalValue })),
      });
      continue;
    }

    if (field.type === 'radio' || field.type === 'checkbox') {
      const allowedOptions = Array.isArray(field.options) ? field.options : [];
      const counts = new Map(allowedOptions.map((option) => [String(option), 0]));
      let totalAnswered = 0;
      let totalSelected = 0;

      responseRows.forEach((row) => {
        const values = parseChoiceValues(row.answers?.[field.name]);
        if (!values.length) return;
        totalAnswered += 1;
        values.forEach((value) => {
          if (!counts.has(value)) {
            counts.set(value, 0);
          }
          counts.set(value, Number(counts.get(value) || 0) + 1);
          totalSelected += 1;
        });
      });

      if (field.type === 'checkbox') {
        totalCheckboxAnswers += totalSelected;
      }
      totalChoiceAnswers += totalSelected;
      byQuestion.push({
        name: field.name,
        label: field.label,
        questionCode: field.questionCode,
        criterion: field.criterion,
        type: field.type,
        totalAnswered,
        totalSelected,
        counts: Array.from(counts.entries()).map(([label, totalValue]) => ({ label, total: totalValue })),
      });
      continue;
    }

    const samples = [];
    let total = 0;
    responseRows.forEach((row) => {
      const value = String(row.answers?.[field.name] || '').trim();
      if (!value) return;
      total += 1;
      if (samples.length < 5) samples.push(value);
    });
    totalTextAnswers += total;

    byQuestion.push({
      name: field.name,
      label: field.label,
      questionCode: field.questionCode,
      criterion: field.criterion,
      type: field.type,
      totalAnswered: total,
      samples,
    });
  }

  const criteriaSummary = buildCriteriaSummary(byQuestion);
  const segmentSummary = buildSegmentSummary(fields, responseRows, criteriaSummary);
  return {
    byQuestion,
    questionAverages,
    scaleAverages,
    criteriaSummary,
    segmentSummary,
    totalQuestionsWithCriterion,
    avgScaleOverall: totalScaleQuestions > 0 ? Number((totalScaleAverage / totalScaleQuestions).toFixed(2)) : 0,
    totalRadioAnswers: totalChoiceAnswers,
    totalChoiceAnswers,
    totalCheckboxAnswers,
    totalTextAnswers,
  };
}

async function resolveQuestionnaireContext(env, tenantId, questionnaireSlug, rawVersionId = null) {
  const questionnaire = await findQuestionnaireByTenantAndSlug(env, tenantId, questionnaireSlug);
  if (!questionnaire) {
    return { ok: false, status: 404, message: 'Questionnaire tidak ditemukan.' };
  }

  const requestedVersionId = String(rawVersionId || '').trim() || null;
  if (requestedVersionId) {
    const selected = await getQuestionnaireVersionById(env, questionnaire.id, requestedVersionId);
    if (!selected) {
      return { ok: false, status: 404, message: 'Versi questionnaire tidak ditemukan.' };
    }
    return { ok: true, questionnaire, selectedVersion: selected, questionnaireVersionId: selected.id };
  }

  const published = await getPublishedVersionByQuestionnaireId(env, questionnaire.id);
  return {
    ok: true,
    questionnaire,
    selectedVersion: published || null,
    questionnaireVersionId: published?.id || null,
  };
}

export async function submitQuestionnaireResponse(env, tenantId, questionnaireSlug, payload) {
  const published = await getPublishedQuestionnaireSchemaBySlug(env, tenantId, questionnaireSlug);
  if (!published.ok) return published;

  const validation = validateSubmissionPayload(published.data.fields, payload);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      message: validation.message,
      errors: validation.errors,
    };
  }

  const inserted = await insertResponseV2(env, {
    tenantId,
    questionnaireId: published.data.questionnaire.id,
    questionnaireVersionId: published.data.questionnaireVersionId,
    respondent: extractRespondent(validation.data),
    answers: validation.data,
    payload: validation.data,
  });

  if (!inserted) {
    return { ok: false, status: 500, message: 'Gagal menyimpan response questionnaire.' };
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

export async function submitDefaultTenantQuestionnaireResponse(env, tenantId, payload) {
  const questionnaire = await findDefaultQuestionnaireByTenantId(env, tenantId);
  if (!questionnaire) {
    return { ok: false, status: 404, message: 'Questionnaire default tenant tidak ditemukan.' };
  }
  return submitQuestionnaireResponse(env, tenantId, questionnaire.slug, payload);
}

export async function getTenantQuestionnaireResponses(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
    search: normalizeSearch(query.search),
    page: normalizePage(query.page),
    pageSize: normalizePageSize(query.pageSize),
  };

  const result = await listQuestionnaireResponsesV2(env, filters);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      filters: {
        page: result.page,
        pageSize: result.pageSize,
        search: filters.search,
        from: filters.from,
        to: filters.to,
        questionnaireVersionId: context.questionnaireVersionId,
      },
      total: result.total,
      items: result.items.map(toResponseListItem),
    },
  };
}

export async function exportTenantQuestionnaireResponsesCsv(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const rows = await listQuestionnaireResponsesForAggregation(env, filters, 20000);
  const fields = resolveVersionFields(context.selectedVersion || {});

  const respondentKeys = new Set();
  const answerKeyOrder = [];
  const answerKeySet = new Set();

  fields.forEach((field) => {
    if (!field?.name) return;
    if (!answerKeySet.has(field.name)) {
      answerKeySet.add(field.name);
      answerKeyOrder.push(field.name);
    }
  });

  rows.forEach((row) => {
    Object.keys(row.respondent || {}).forEach((key) => respondentKeys.add(key));
    Object.keys(row.answers || {}).forEach((key) => {
      if (!answerKeySet.has(key)) {
        answerKeySet.add(key);
        answerKeyOrder.push(key);
      }
    });
  });

  const respondentColumns = Array.from(respondentKeys).sort();
  const headers = [
    'id',
    'submitted_at',
    'questionnaire_version_id',
    ...respondentColumns.map((key) => `respondent.${key}`),
    ...answerKeyOrder.map((key) => `answer.${key}`),
  ];

  const lines = [headers.map(escapeCsvValue).join(',')];
  rows.forEach((row) => {
    const values = [
      row.id,
      row.createdAt,
      row.questionnaireVersionId,
      ...respondentColumns.map((key) => row.respondent?.[key] ?? ''),
      ...answerKeyOrder.map((key) => formatAnswerForCsv(row.answers?.[key])),
    ];
    lines.push(values.map(escapeCsvValue).join(','));
  });

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      csv: lines.join('\n'),
    },
  };
}

export async function getTenantQuestionnaireAnalyticsSummary(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const [summaryRow, responses] = await Promise.all([
    getQuestionnaireSummaryStatsV2(env, filters),
    listQuestionnaireResponsesForAggregation(env, filters, null),
  ]);

  const fields = resolveVersionFields(context.selectedVersion || {});
  const distribution = computeDistribution(fields, responses);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      totalResponses: Number(summaryRow?.total_responses || 0),
      responsesToday: Number(summaryRow?.responses_today || 0),
      lastSubmittedAt: summaryRow?.last_submitted_at || null,
      avgScaleOverall: distribution.avgScaleOverall,
      totalScaleQuestions: Object.keys(distribution.questionAverages).length,
      totalRadioAnswers: distribution.totalRadioAnswers,
      totalChoiceAnswers: distribution.totalChoiceAnswers,
      totalCheckboxAnswers: distribution.totalCheckboxAnswers,
      totalTextAnswers: distribution.totalTextAnswers,
      questionAverages: distribution.questionAverages,
      scaleAverages: distribution.scaleAverages,
      criteriaSummary: distribution.criteriaSummary,
      segmentSummary: distribution.segmentSummary,
      totalQuestionsWithCriterion: distribution.totalQuestionsWithCriterion,
    },
  };
}

export async function getTenantQuestionnaireAnalyticsDistribution(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const responses = await listQuestionnaireResponsesForAggregation(env, filters, null);
  const fields = resolveVersionFields(context.selectedVersion || {});
  const distribution = computeDistribution(fields, responses);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      totalResponses: responses.length,
      questions: distribution.byQuestion,
      questionAverages: distribution.questionAverages,
      scaleAverages: distribution.scaleAverages,
      criteriaSummary: distribution.criteriaSummary,
      segmentSummary: distribution.segmentSummary,
      totalQuestionsWithCriterion: distribution.totalQuestionsWithCriterion,
    },
  };
}

export async function getTenantQuestionnaireAnalyticsTrend(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const days = normalizeDays(query.days);
  const fromIso = normalizeFromFilter(query.from);
  const toIso = normalizeToFilter(query.to);
  const effectiveFrom = resolveTrendStart(fromIso, days);

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: effectiveFrom,
    to: toIso,
  };

  const rows = await getQuestionnaireTrendRowsV2(env, filters);
  const byDay = new Map(rows.map((row) => [String(row.day), Number(row.total || 0)]));

  const fromDate = new Date(effectiveFrom);
  const toDate = resolveTrendEnd(toIso);
  const points = [];
  for (let date = new Date(fromDate); date <= toDate; date = addDays(date, 1)) {
    const day = formatDay(date);
    points.push({
      day,
      total: byDay.get(day) || 0,
    });
  }

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      days,
      from: effectiveFrom,
      to: toIso,
      points,
    },
  };
}

export async function getTenantQuestionnaireAiSource(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };

  const responses = await listQuestionnaireResponsesForAggregation(env, filters, 120);
  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: context.questionnaire,
      questionnaireVersionId: context.questionnaireVersionId,
      responses: responses.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        respondent: row.respondent || {},
        answers: row.answers || {},
      })),
    },
  };
}

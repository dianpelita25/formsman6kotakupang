import { AI_ANALYSIS_MODES } from '../shared/ai-modes.js';

const DEFAULT_PROMPT_TEMPLATES = Object.freeze({
  [AI_ANALYSIS_MODES.INTERNAL]: [
    'Anda analis internal produk AITI.',
    'Organisasi/Tenant: {{tenant.name}}',
    'Questionnaire: {{questionnaire.name}}',
    'Buat ringkasan eksekutif, KPI, temuan utama, segmentasi, dan rekomendasi aksi.',
    'Jangan mengarang angka. Gunakan data yang ada.',
    '',
    'Summary:',
    '{{summary.json}}',
    '',
    'Distribution:',
    '{{distribution.json}}',
    '',
    'Responses:',
    '{{responses.json}}',
  ].join('\n'),
  [AI_ANALYSIS_MODES.EXTERNAL_PEMERINTAH]: [
    'Anda analis kebijakan pendidikan. Buat laporan formal untuk pemda/dinas.',
    'Organisasi/Tenant: {{tenant.name}}',
    'Questionnaire: {{questionnaire.name}}',
    'Gunakan bahasa Indonesia formal. Jangan mengarang angka.',
    'Wajib tampilkan ringkasan eksekutif, temuan data, rekomendasi 30-90 hari, dan keterbatasan data.',
    '',
    'Summary:',
    '{{summary.json}}',
    '',
    'Distribution:',
    '{{distribution.json}}',
    '',
    'Responses:',
    '{{responses.json}}',
  ].join('\n'),
  [AI_ANALYSIS_MODES.EXTERNAL_MITRA]: [
    'Anda analis bisnis dampak untuk memo mitra/sponsor/investor.',
    'Organisasi/Tenant: {{tenant.name}}',
    'Questionnaire: {{questionnaire.name}}',
    'Jangan mengarang data. Fokus traction, risiko, dan rencana 90 hari.',
    '',
    'Summary:',
    '{{summary.json}}',
    '',
    'Distribution:',
    '{{distribution.json}}',
    '',
    'Responses:',
    '{{responses.json}}',
  ].join('\n'),
  [AI_ANALYSIS_MODES.LIVE_GURU]: [
    'Anda analis program untuk materi presentasi live ke guru dan pimpinan sekolah.',
    'Organisasi/Tenant: {{tenant.name}}',
    'Questionnaire: {{questionnaire.name}}',
    'Outputkan 2 slide ringkasan + script 60-90 detik.',
    '',
    'Summary:',
    '{{summary.json}}',
    '',
    'Distribution:',
    '{{distribution.json}}',
  ].join('\n'),
});

const ALLOWED_TEMPLATE_KEYS = new Set([
  'school.name',
  'school.slug',
  'tenant.id',
  'tenant.name',
  'tenant.slug',
  'tenant.type',
  'questionnaire.id',
  'questionnaire.name',
  'questionnaire.slug',
  'summary.json',
  'summary.totalResponses',
  'summary.avgQ12',
  'summary.interestedPct',
  'summary.avgAiAdoption',
  'distribution.json',
  'distribution.questionAverages',
  'distribution.q10Distribution',
  'responses.json',
  'responses.length',
]);

function toPathSegments(path) {
  return String(path || '')
    .split('.')
    .filter(Boolean);
}

function extractTemplateKeys(template) {
  const keys = new Set();
  const text = String(template || '');
  const pattern = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let match = pattern.exec(text);
  while (match) {
    keys.add(match[1]);
    match = pattern.exec(text);
  }
  return Array.from(keys);
}

function resolvePathValue(context, key) {
  if (key === 'summary.json') return JSON.stringify(context.summary || {}, null, 2);
  if (key === 'distribution.json') return JSON.stringify(context.distribution || {}, null, 2);
  if (key === 'responses.json') return JSON.stringify(context.responses || [], null, 2);

  if (!ALLOWED_TEMPLATE_KEYS.has(key)) {
    throw new Error(`Placeholder tidak diizinkan: ${key}`);
  }

  const segments = toPathSegments(key);
  let value = context;
  for (const segment of segments) {
    if (value == null || typeof value !== 'object') {
      return '';
    }
    value = value[segment];
  }

  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function getDefaultPromptTemplate(mode) {
  return DEFAULT_PROMPT_TEMPLATES[mode] || DEFAULT_PROMPT_TEMPLATES[AI_ANALYSIS_MODES.INTERNAL];
}

export function validatePromptTemplate(template) {
  const content = String(template || '').trim();
  if (!content) {
    return { ok: false, message: 'Template prompt wajib diisi.' };
  }

  const keys = extractTemplateKeys(content);
  const unknownKeys = keys.filter((key) => !ALLOWED_TEMPLATE_KEYS.has(key));
  if (unknownKeys.length) {
    return {
      ok: false,
      message: `Placeholder tidak didukung: ${unknownKeys.join(', ')}`,
    };
  }

  return { ok: true, data: content };
}

export function renderPromptTemplate(template, context) {
  const content = String(template || '');
  return content.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => resolvePathValue(context, key));
}

export function buildPromptTemplateContext({ school, tenant, questionnaire, summary, distribution, responses }) {
  const resolvedTenant = tenant || school || {};
  return {
    school: {
      id: school?.id || null,
      name: school?.name || '',
      slug: school?.slug || '',
    },
    tenant: {
      id: resolvedTenant?.id || null,
      name: resolvedTenant?.name || school?.name || '',
      slug: resolvedTenant?.slug || school?.slug || '',
      type: resolvedTenant?.tenantType || resolvedTenant?.tenant_type || (school ? 'school' : ''),
    },
    questionnaire: {
      id: questionnaire?.id || null,
      name: questionnaire?.name || '',
      slug: questionnaire?.slug || '',
    },
    summary: summary || {},
    distribution: distribution || {},
    responses: Array.isArray(responses) ? responses : [],
  };
}

export function getDefaultPromptTemplateMap() {
  return DEFAULT_PROMPT_TEMPLATES;
}

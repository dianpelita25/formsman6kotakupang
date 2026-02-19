import { z } from 'zod';

const VALID_TYPES = ['text', 'radio', 'checkbox', 'scale'];
const VALID_SEGMENT_ROLES = ['auto', 'dimension', 'exclude'];

const metaSchema = z.object({
  title: z.string().trim().min(1),
  greetingTitle: z.string().trim().min(1),
  greetingText: z.string().trim().min(1),
});

const baseFieldSchema = z.object({
  type: z.enum(VALID_TYPES),
  name: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9_]{1,63}$/),
  label: z.string().trim().min(1),
  criterion: z.string().trim().max(64).optional(),
  required: z.boolean().optional().default(true),
  segmentRole: z.enum(VALID_SEGMENT_ROLES).optional().default('auto'),
  segmentLabel: z.string().trim().max(64).optional(),
  isSensitive: z.boolean().optional().default(false),
});

const textFieldSchema = baseFieldSchema.extend({
  type: z.literal('text'),
});

const radioFieldSchema = baseFieldSchema.extend({
  type: z.literal('radio'),
  options: z.array(z.string().trim().min(1)).min(2),
});

const checkboxFieldSchema = baseFieldSchema.extend({
  type: z.literal('checkbox'),
  options: z.array(z.string().trim().min(1)).min(2),
});

const scaleFieldSchema = baseFieldSchema.extend({
  type: z.literal('scale'),
  fromLabel: z.string().trim().min(1),
  toLabel: z.string().trim().min(1),
});

const fieldSchema = z.discriminatedUnion('type', [textFieldSchema, radioFieldSchema, checkboxFieldSchema, scaleFieldSchema]);

export const questionnaireDraftSchema = z.object({
  meta: metaSchema,
  fields: z.array(fieldSchema).min(1),
});

export function normalizeQuestionnaireDraftInput(input) {
  const parsed = questionnaireDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Draft questionnaire tidak valid.',
      errors: parsed.error.flatten(),
    };
  }

  const uniqueNames = new Set();
  const normalizedFields = [];
  for (const field of parsed.data.fields) {
    if (uniqueNames.has(field.name)) {
      return {
        ok: false,
        message: `Field duplikat: ${field.name}`,
      };
    }
    uniqueNames.add(field.name);

    const normalizedType = String(field.type || '').trim();
    const normalizedSegmentRole = String(field.segmentRole || 'auto')
      .trim()
      .toLowerCase();
    const resolvedSegmentRole =
      normalizedSegmentRole === 'exclude'
        ? 'exclude'
        : normalizedSegmentRole === 'dimension' && (normalizedType === 'radio' || normalizedType === 'checkbox')
          ? 'dimension'
          : 'auto';
    const resolvedSegmentLabel = String(field.segmentLabel || '').trim();

    normalizedFields.push({
      ...field,
      segmentRole: resolvedSegmentRole,
      segmentLabel: resolvedSegmentLabel || undefined,
      isSensitive: field.isSensitive === true,
    });
  }

  return {
    ok: true,
    data: {
      meta: parsed.data.meta,
      fields: normalizedFields,
      schema: {
        fields: normalizedFields,
      },
    },
  };
}

export function normalizeQuestionnaireCreatePayload(payload) {
  const name = String(payload?.name || '').trim();
  const slug = String(payload?.slug || '')
    .trim()
    .toLowerCase();
  const category = String(payload?.category || 'general_feedback').trim().toLowerCase() || 'general_feedback';
  const description = String(payload?.description || '').trim();

  if (!name) {
    return { ok: false, status: 400, message: 'Nama questionnaire wajib diisi.' };
  }

  const normalizedSlug = slug
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalizedSlug) {
    return { ok: false, status: 400, message: 'Slug questionnaire tidak valid.' };
  }

  return {
    ok: true,
    data: {
      name,
      slug: normalizedSlug,
      category,
      description,
    },
  };
}

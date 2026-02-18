import { z } from 'zod';
import { CORE_FIELDS, CORE_FORM_META } from './core.js';

const coreFieldMap = new Map(CORE_FIELDS.map((field) => [field.name, field]));

const metaSchema = z.object({
  title: z.string().trim().min(1),
  greetingTitle: z.string().trim().min(1),
  greetingText: z.string().trim().min(1),
});

const baseFieldSchema = z.object({
  type: z.enum(['text', 'radio', 'checkbox', 'scale']),
  name: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean().optional().default(true),
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

const extraNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{2,63}$/, 'Field tambahan harus huruf kecil/angka/underscore dan minimal 3 karakter.');

const extraFieldSchema = fieldSchema.superRefine((value, ctx) => {
  const parsed = extraNameSchema.safeParse(value.name);
  if (!parsed.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['name'],
      message: parsed.error.issues[0]?.message || 'Nama field tambahan tidak valid.',
    });
  }
  if (/^q\d+$/.test(value.name) || value.name === 'namaGuru' || value.name === 'lamaMengajar' || value.name === 'mataPelajaran') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['name'],
      message: 'Nama field tambahan bentrok dengan core fields.',
    });
  }
});

export const draftSchema = z.object({
  meta: metaSchema,
  coreFields: z.array(fieldSchema),
  extraFields: z.array(extraFieldSchema),
});

export function normalizeDraftInput(input) {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Draft form tidak valid.',
      errors: parsed.error.flatten(),
    };
  }

  const { meta, coreFields, extraFields } = parsed.data;

  if (coreFields.length !== CORE_FIELDS.length) {
    return {
      ok: false,
      message: `Core fields wajib ${CORE_FIELDS.length} item.`,
    };
  }

  const normalizedCore = [];
  for (const field of coreFields) {
    const defaultField = coreFieldMap.get(field.name);
    if (!defaultField) {
      return { ok: false, message: `Core field tidak dikenal: ${field.name}` };
    }
    if (field.type !== defaultField.type) {
      return { ok: false, message: `Type ${field.name} tidak boleh diubah.` };
    }
    if (field.required !== true) {
      return { ok: false, message: `Field ${field.name} wajib required=true.` };
    }

    const normalized = {
      ...defaultField,
      label: field.label,
    };

    if (defaultField.type === 'scale') {
      normalized.fromLabel = field.fromLabel;
      normalized.toLabel = field.toLabel;
    }

    if (defaultField.type === 'radio') {
      const expectedOptions = defaultField.options || [];
      const actualOptions = field.options || [];
      if (expectedOptions.length !== actualOptions.length || expectedOptions.some((opt, index) => opt !== actualOptions[index])) {
        return { ok: false, message: `Opsi ${field.name} tidak boleh diubah.` };
      }
      normalized.options = actualOptions;
    }

    normalizedCore.push(normalized);
  }

  const normalizedCoreNames = normalizedCore.map((field) => field.name);
  const expectedOrder = CORE_FIELDS.map((field) => field.name);
  if (normalizedCoreNames.join('|') !== expectedOrder.join('|')) {
    return { ok: false, message: 'Urutan core fields tidak boleh diubah.' };
  }

  const extraFieldNames = new Set();
  for (const extraField of extraFields) {
    if (extraFieldNames.has(extraField.name)) {
      return { ok: false, message: `Field tambahan duplikat: ${extraField.name}` };
    }
    extraFieldNames.add(extraField.name);
  }

  return {
    ok: true,
    data: {
      meta: {
        title: meta.title,
        greetingTitle: meta.greetingTitle,
        greetingText: meta.greetingText,
      },
      coreFields: normalizedCore,
      extraFields,
    },
  };
}

export function getDefaultMeta() {
  return structuredClone(CORE_FORM_META);
}

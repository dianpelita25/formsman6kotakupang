import { z } from 'zod';

function buildChoiceValueSchema(field) {
  const allowedOptions = new Set((field.options || []).map((option) => String(option)));
  return z
    .string()
    .trim()
    .min(1, `${field.label} wajib diisi`)
    .refine((value) => allowedOptions.has(value), {
      message: `Pilihan ${field.label} tidak valid`,
    });
}

function normalizeOptionalValue(rawValue) {
  if (rawValue == null) return undefined;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(rawValue)) {
    const cleaned = rawValue
      .map((value) => (typeof value === 'string' ? value.trim() : value))
      .filter((value) => value != null && !(typeof value === 'string' && value.length === 0));
    return cleaned.length ? cleaned : undefined;
  }

  return rawValue;
}

function applyRequiredPolicy(field, schema) {
  if (field?.required !== false) return schema;
  return z.preprocess((value) => normalizeOptionalValue(value), schema.optional());
}

function buildFieldSchema(field) {
  const requiredMessage = `${field.label} wajib diisi`;

  if (field.type === 'text') {
    return applyRequiredPolicy(field, z.string().trim().min(1, requiredMessage));
  }

  if (field.type === 'radio') {
    return applyRequiredPolicy(field, buildChoiceValueSchema(field));
  }

  if (field.type === 'checkbox') {
    const choiceSchema = buildChoiceValueSchema(field);
    const checkboxSchema = z
      .union([choiceSchema.transform((value) => [value]), z.array(choiceSchema).min(1, requiredMessage)])
      .transform((values) => Array.from(new Set(values)));
    return applyRequiredPolicy(field, checkboxSchema);
  }

  if (field.type === 'scale') {
    return applyRequiredPolicy(field, z.coerce.number().int().min(1, requiredMessage).max(5, `${field.label} harus 1-5`));
  }

  throw new Error(`Tipe field tidak didukung: ${field.type}`);
}

export function buildSubmissionSchema(fields) {
  const shape = {};
  for (const field of fields) {
    shape[field.name] = buildFieldSchema(field);
  }
  return z.object(shape);
}

export function validateSubmissionPayload(fields, payload) {
  const schema = buildSubmissionSchema(fields);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Data form tidak valid.',
      errors: parsed.error.flatten(),
    };
  }
  return {
    ok: true,
    data: parsed.data,
  };
}

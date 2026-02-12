import { formMeta, formFields } from './schema.js';

export function getFormSchema(_req, res) {
  res.json({
    meta: formMeta,
    fields: formFields,
  });
}

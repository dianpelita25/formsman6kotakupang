export function slugToKey(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function ensureUniqueFieldKey(preferred, fields, excludedKey = null) {
  const base = slugToKey(preferred) || 'q_item';
  const used = new Set(fields.map((field) => field.name).filter((name) => name && name !== excludedKey));
  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function normalizeSegmentRole(rawRole, type) {
  const role = String(rawRole || 'auto')
    .trim()
    .toLowerCase();
  const normalizedType = String(type || '').trim();
  if (role === 'exclude') return 'exclude';
  if (role === 'dimension' && (normalizedType === 'radio' || normalizedType === 'checkbox')) return 'dimension';
  return 'auto';
}

function normalizeSegmentLabel(rawLabel) {
  const label = String(rawLabel || '').trim();
  if (!label) return undefined;
  return label.slice(0, 64);
}

function normalizeSegmentMetadata(rawField, type) {
  const isSensitive = rawField?.isSensitive === true;
  const segmentRole = normalizeSegmentRole(rawField?.segmentRole, type);
  return {
    segmentRole: isSensitive ? 'exclude' : segmentRole,
    segmentLabel: normalizeSegmentLabel(rawField?.segmentLabel),
    isSensitive,
  };
}

export function normalizeBuilderField(rawField, fields = [], excludedKey = null) {
  const type = String(rawField?.type || 'text').trim();
  const label = String(rawField?.label || '').trim();
  const name = ensureUniqueFieldKey(rawField?.name || label, fields, excludedKey);
  const criterion = String(rawField?.criterion || '').trim();
  const required = rawField?.required !== false;
  const segmentMetadata = normalizeSegmentMetadata(rawField, type);

  if (!label) {
    throw new Error('Label pertanyaan wajib diisi.');
  }
  if (!['text', 'radio', 'checkbox', 'scale'].includes(type)) {
    throw new Error('Tipe pertanyaan tidak didukung.');
  }

  if (type === 'text') {
    return { type, name, label, criterion, required, ...segmentMetadata };
  }

  if (type === 'radio' || type === 'checkbox') {
    const options = Array.isArray(rawField?.options)
      ? rawField.options.map((item) => String(item || '').trim()).filter(Boolean)
      : String(rawField?.options || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    if (options.length < 2) {
      throw new Error(`Pertanyaan "${label}" tipe pilihan harus memiliki minimal 2 opsi.`);
    }
    return { type, name, label, criterion, required, options, ...segmentMetadata };
  }

  return {
    type,
    name,
    label,
    criterion,
    required,
    fromLabel: String(rawField?.fromLabel || 'Tidak Setuju').trim() || 'Tidak Setuju',
    toLabel: String(rawField?.toLabel || 'Sangat Setuju').trim() || 'Sangat Setuju',
    ...segmentMetadata,
  };
}

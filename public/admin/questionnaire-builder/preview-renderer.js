export function syncBuilderMetaFromInputs(state, refs) {
  state.meta = {
    title: String(refs.metaTitleEl.value || '').trim(),
    greetingTitle: String(refs.metaGreetingTitleEl.value || '').trim(),
    greetingText: String(refs.metaGreetingTextEl.value || '').trim(),
  };
}

export function syncBuilderMetaToInputs(state, refs) {
  refs.metaTitleEl.value = state.meta.title || '';
  refs.metaGreetingTitleEl.value = state.meta.greetingTitle || '';
  refs.metaGreetingTextEl.value = state.meta.greetingText || '';
}

export function renderBuilderPreview(state, refs) {
  refs.previewTitleEl.textContent = state.meta.title || '-';
  refs.previewGreetingTitleEl.textContent = state.meta.greetingTitle || '-';
  refs.previewGreetingTextEl.textContent = state.meta.greetingText || '-';

  refs.previewFieldsEl.innerHTML = '';
  if (!state.fields.length) {
    const empty = document.createElement('li');
    empty.className = 'small';
    empty.textContent = 'Belum ada pertanyaan.';
    refs.previewFieldsEl.append(empty);
    return;
  }

  state.fields.forEach((field, index) => {
    const item = document.createElement('li');
    let detail = 'Teks';
    if (field.type === 'radio') {
      detail = `Pilihan Tunggal (${(field.options || []).join(', ')})`;
    } else if (field.type === 'checkbox') {
      detail = `Pilihan Ganda (${(field.options || []).join(', ')})`;
    } else if (field.type === 'scale') {
      detail = `Skala 1-5 (${field.fromLabel || '-'} -> ${field.toLabel || '-'})`;
    }

    const title = document.createElement('strong');
    title.textContent = `${index + 1}. ${field.label}`;

    const detailText = [
      `[${field.name}]`,
      detail,
      field.criterion ? `Kriteria ${field.criterion}` : '',
      field.required === false ? 'Opsional' : 'Wajib',
      `Segment: ${String(field.segmentRole || 'auto')}${field.isSensitive ? ' (sensitive)' : ''}`,
    ]
      .filter(Boolean)
      .join(' | ');
    const detailEl = document.createElement('span');
    detailEl.className = 'small';
    detailEl.textContent = detailText;

    item.append(title, document.createTextNode(' '), detailEl);
    refs.previewFieldsEl.append(item);
  });
}

export function createQuestionComposer({
  state,
  refs,
  slugToKey,
  normalizeBuilderField,
  renderQuestionList,
  pushActivity,
}) {
  function setComposerQuestionTypeVisibility() {
    const type = String(refs.newQuestionTypeEl.value || 'text').trim();
    refs.newQuestionOptionsWrapEl.hidden = !['radio', 'checkbox'].includes(type);
    refs.newQuestionFromWrapEl.hidden = type !== 'scale';
    refs.newQuestionToWrapEl.hidden = type !== 'scale';
  }

  function addQuestionFromComposer() {
    const label = String(refs.newQuestionLabelEl.value || '').trim();
    if (!label) {
      throw new Error('Label pertanyaan baru wajib diisi.');
    }

    const type = String(refs.newQuestionTypeEl.value || 'text').trim();
    const candidate = {
      type,
      label,
      name: slugToKey(label),
      criterion: String(refs.newQuestionCriterionEl?.value || '').trim(),
      required: Boolean(refs.newQuestionRequiredEl?.checked ?? true),
    };

    if (type === 'radio' || type === 'checkbox') {
      candidate.options = String(refs.newQuestionOptionsEl.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (type === 'scale') {
      candidate.fromLabel = String(refs.newQuestionFromEl.value || '').trim() || 'Tidak Setuju';
      candidate.toLabel = String(refs.newQuestionToEl.value || '').trim() || 'Sangat Setuju';
    }

    const normalized = normalizeBuilderField(candidate, state.fields);
    state.fields.push(normalized);
    renderQuestionList();

    refs.newQuestionLabelEl.value = '';
    if (refs.newQuestionCriterionEl) refs.newQuestionCriterionEl.value = '';
    refs.newQuestionOptionsEl.value = '';
    refs.newQuestionFromEl.value = '';
    refs.newQuestionToEl.value = '';
    refs.newQuestionTypeEl.value = 'text';
    if (refs.newQuestionRequiredEl) refs.newQuestionRequiredEl.checked = true;
    setComposerQuestionTypeVisibility();
    pushActivity('success', 'Tambah pertanyaan', normalized.label);
  }

  return {
    setComposerQuestionTypeVisibility,
    addQuestionFromComposer,
  };
}

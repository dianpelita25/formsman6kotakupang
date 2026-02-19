export function createAdvancedJsonController({
  state,
  refs,
  normalizeBuilderField,
  syncMetaToInputs,
  renderQuestionList,
  pushActivity,
  setStatus,
}) {
  function syncAdvancedJson() {
    refs.advancedJsonEl.value = JSON.stringify(
      {
        meta: state.meta,
        fields: state.fields,
      },
      null,
      2
    );
  }

  function applyJsonAdvanced() {
    const parsed = JSON.parse(refs.advancedJsonEl.value || '{}');
    const incomingMeta = parsed?.meta || {};
    const incomingFields = Array.isArray(parsed?.fields) ? parsed.fields : [];

    const normalizedFields = [];
    incomingFields.forEach((field) => {
      normalizedFields.push(normalizeBuilderField(field, normalizedFields, null));
    });

    state.meta = {
      title: String(incomingMeta.title || '').trim(),
      greetingTitle: String(incomingMeta.greetingTitle || '').trim(),
      greetingText: String(incomingMeta.greetingText || '').trim(),
    };
    state.fields = normalizedFields;
    syncMetaToInputs();
    renderQuestionList();
    pushActivity('success', 'Apply JSON lanjutan', 'Perubahan dari JSON berhasil diterapkan ke builder visual');
    setStatus('Mode lanjutan berhasil diterapkan.', 'success');
  }

  return {
    syncAdvancedJson,
    applyJsonAdvanced,
  };
}

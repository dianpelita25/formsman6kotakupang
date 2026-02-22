export function createBuilderDraftService({
  state,
  refs,
  baseApiPath,
  normalizeBuilderField,
  cloneField,
  syncMetaFromInputs,
  syncMetaToInputs,
  renderQuestionList,
  api,
  pushActivity,
  setStatus,
}) {
  function normalizeDraftPayloadFromState() {
    syncMetaFromInputs();
    if (!state.meta.title || !state.meta.greetingTitle || !state.meta.greetingText) {
      throw new Error('Info kuesioner belum lengkap. Judul dan sapaan wajib diisi.');
    }
    if (!state.fields.length) {
      throw new Error('Minimal harus ada 1 pertanyaan sebelum disimpan.');
    }
    return {
      meta: state.meta,
      fields: state.fields.map((field) => ({ ...field, required: field.required !== false })),
    };
  }

  function detectBreakingChanges() {
    const before = new Map(state.loadedSnapshot.map((field) => [field.name, field]));
    const after = new Map(state.fields.map((field) => [field.name, field]));
    const removed = [];
    const typeChanged = [];
    before.forEach((field, key) => {
      if (!after.has(key)) return removed.push(field.label || key);
      const next = after.get(key);
      if (next.type !== field.type) {
        typeChanged.push(`${field.label || key} (${field.type} -> ${next.type})`);
      }
    });
    return { removed, typeChanged };
  }

  async function loadDraft() {
    const payload = await api(`${baseApiPath()}/draft`, undefined, 'Muat draf kuesioner');
    const data = payload?.data || {};
    const draft = data.draft || {};
    const questionnaire = data.questionnaire || {};

    state.questionnaireId = questionnaire.id || '';
    state.questionnaireName = questionnaire.name || state.questionnaireSlug;
    state.meta = {
      title: String(draft.meta?.title || '').trim(),
      greetingTitle: String(draft.meta?.greetingTitle || '').trim(),
      greetingText: String(draft.meta?.greetingText || '').trim(),
    };
    state.fields = Array.isArray(draft.fields)
      ? draft.fields.map((field) => normalizeBuilderField(field, state.fields))
      : [];
    state.loadedSnapshot = state.fields.map(cloneField);
    syncMetaToInputs();
    renderQuestionList();

    refs.subtitleEl.textContent = `Organisasi: ${state.tenantSlug} | Kuesioner: ${state.questionnaireName} (${state.questionnaireSlug})`;
    pushActivity('success', 'Muat draf', `${state.questionnaireName} v${draft.version || '-'}`);
  }

  async function refreshResponseFlag() {
    const payload = await api(`${baseApiPath()}/analytics/summary`, undefined, 'Muat ringkasan untuk validasi perubahan berisiko');
    state.hasResponses = Number(payload?.data?.totalResponses || 0) > 0;
  }

  async function saveDraft(options = {}) {
    const { silentStatus = false, silentActivity = false } = options;
    const body = normalizeDraftPayloadFromState();
    await api(
      `${baseApiPath()}/draft`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      'Simpan draf kuesioner'
    );
    state.loadedSnapshot = state.fields.map(cloneField);
    if (!silentActivity) {
      pushActivity('success', 'Simpan draf', `${state.questionnaireSlug} tersimpan`);
    }
    if (!silentStatus) {
      setStatus('Draf berhasil disimpan.', 'success');
    }
  }

  return {
    loadDraft,
    refreshResponseFlag,
    saveDraft,
    detectBreakingChanges,
  };
}

export function createQuestionListController({
  state,
  refs,
  createQuestionCard,
  renderPreview,
  syncAdvancedJson,
  cloneField,
  ensureUniqueFieldKey,
}) {
  function renderQuestionList() {
    refs.questionListEl.innerHTML = '';
    if (!state.fields.length) {
      const empty = document.createElement('p');
      empty.className = 'small';
      empty.textContent = 'Belum ada pertanyaan. Tambahkan pertanyaan pertama Anda.';
      refs.questionListEl.append(empty);
      renderPreview();
      syncAdvancedJson();
      return;
    }

    state.fields.forEach((field, index) => {
      refs.questionListEl.append(createQuestionCard(field, index, state.fields.length));
    });
    renderPreview();
    syncAdvancedJson();
  }

  function openStep(stepName) {
    refs.stepButtons.forEach((button) => {
      const active = button.dataset.stepTarget === stepName;
      button.classList.toggle('is-active', active);
    });

    refs.stepPanels.forEach((panel) => {
      const active = panel.dataset.stepPanel === stepName;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function handleQuestionListInteraction(event) {
    const card = event.target.closest('.builder-question-card');
    if (!card) return;
    const index = Number(card.dataset.index);
    if (!Number.isFinite(index)) return;
    const field = state.fields[index];
    if (!field) return;

    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const action = actionButton.dataset.action;
      if (action === 'move-up' && index > 0) {
        const [item] = state.fields.splice(index, 1);
        state.fields.splice(index - 1, 0, item);
        return renderQuestionList();
      }
      if (action === 'move-down' && index < state.fields.length - 1) {
        const [item] = state.fields.splice(index, 1);
        state.fields.splice(index + 1, 0, item);
        return renderQuestionList();
      }
      if (action === 'duplicate') {
        const duplicate = cloneField(field);
        duplicate.name = ensureUniqueFieldKey(`${field.name}_copy`, state.fields);
        state.fields.splice(index + 1, 0, duplicate);
        return renderQuestionList();
      }
      if (action === 'remove') {
        const confirmed = window.confirm(`Hapus pertanyaan "${field.label}"?`);
        if (!confirmed) return;
        state.fields.splice(index, 1);
        return renderQuestionList();
      }
    }

    if (event.type === 'click') return;

    const fieldInput = event.target.closest('[data-field]');
    if (!fieldInput) return;
    const key = fieldInput.dataset.field;
    const value = fieldInput.value;

    if (key === 'label') {
      state.fields[index].label = value;
    } else if (key === 'required') {
      state.fields[index].required = Boolean(fieldInput.checked);
    } else if (key === 'criterion') {
      state.fields[index].criterion = String(value || '').trim();
    } else if (key === 'type') {
      state.fields[index].type = value;
      if (value === 'radio' || value === 'checkbox') {
        state.fields[index].options = Array.isArray(state.fields[index].options) ? state.fields[index].options : ['Ya', 'Tidak'];
        delete state.fields[index].fromLabel;
        delete state.fields[index].toLabel;
      } else if (value === 'scale') {
        state.fields[index].fromLabel = state.fields[index].fromLabel || 'Tidak Setuju';
        state.fields[index].toLabel = state.fields[index].toLabel || 'Sangat Setuju';
        delete state.fields[index].options;
      } else {
        delete state.fields[index].options;
        delete state.fields[index].fromLabel;
        delete state.fields[index].toLabel;
      }
      return renderQuestionList();
    } else if (key === 'options') {
      state.fields[index].options = value.split(',').map((item) => item.trim()).filter(Boolean);
    } else if (key === 'fromLabel') {
      state.fields[index].fromLabel = value;
    } else if (key === 'toLabel') {
      state.fields[index].toLabel = value;
    }

    renderPreview();
    syncAdvancedJson();
  }

  return {
    renderQuestionList,
    openStep,
    handleQuestionListInteraction,
  };
}

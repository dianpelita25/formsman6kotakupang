export function createVisualOrderEventBinder({
  state,
  VISUAL_CARD_CONFIG,
  visualOrderDragState,
  visualOrderListEl,
  visualVisibilityResetBtnEl,
  visualVisibilitySettingsEl,
  criteriaSummaryListEl,
  questionDetailCloseBtnEl,
  renderAdvancedVizChart,
  moveVisualCardOrder,
  findVisualOrderRowByKey,
  resetVisualOrderDragState,
  reorderVisualCardOrder,
  createDefaultVisualCardVisibility,
  createDefaultVisualCardOrder,
  saveVisualCardVisibility,
  saveVisualCardOrder,
  syncVisualVisibilityInputs,
  renderVisualOrderList,
  applyVisualCardOrder,
  applyVisualCardVisibility,
  setVisualLayoutPresetSelection,
  resolveMatchingVisualPresetId,
  findQuestionByCode,
  renderQuestionDetail,
  setStatus,
} = {}) {
  function bindVisualOrderEvents() {
    visualOrderListEl?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-order-key][data-order-move]');
      if (!button) return;
      const orderKey = String(button.dataset.orderKey || '').trim();
      const direction = String(button.dataset.orderMove || '').trim().toLowerCase();
      if (!orderKey || (direction !== 'up' && direction !== 'down')) return;
      const moved = moveVisualCardOrder(orderKey, direction);
      if (!moved) return;
      setVisualLayoutPresetSelection(resolveMatchingVisualPresetId());
      setStatus(`Urutan visual diperbarui (${VISUAL_CARD_CONFIG[orderKey]?.label || orderKey}).`, 'success');
    });

    visualOrderListEl?.addEventListener('dragstart', (event) => {
      const row = event.target.closest('.dashboard-visual-order-item');
      if (!row) return;
      const key = String(row.dataset.orderKey || '').trim();
      if (!key) return;
      visualOrderDragState.draggedKey = key;
      row.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', key);
      }
    });

    visualOrderListEl?.addEventListener('dragover', (event) => {
      const row = event.target.closest('.dashboard-visual-order-item');
      if (!row) return;
      event.preventDefault();
      const key = String(row.dataset.orderKey || '').trim();
      if (!key || key === visualOrderDragState.draggedKey) return;
      if (visualOrderDragState.overKey && visualOrderDragState.overKey !== key) {
        const previous = findVisualOrderRowByKey(visualOrderDragState.overKey);
        previous?.classList.remove('is-drag-over');
      }
      visualOrderDragState.overKey = key;
      row.classList.add('is-drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });

    visualOrderListEl?.addEventListener('drop', (event) => {
      const row = event.target.closest('.dashboard-visual-order-item');
      if (!row) return;
      event.preventDefault();
      const dropKey = String(row.dataset.orderKey || '').trim();
      const draggedKey =
        String(visualOrderDragState.draggedKey || '').trim() ||
        String(event.dataTransfer?.getData('text/plain') || '').trim();
      if (!draggedKey || !dropKey) {
        resetVisualOrderDragState();
        return;
      }
      const moved = reorderVisualCardOrder(draggedKey, dropKey);
      resetVisualOrderDragState();
      if (!moved) return;
      setVisualLayoutPresetSelection(resolveMatchingVisualPresetId());
      setStatus(`Urutan visual diperbarui (${VISUAL_CARD_CONFIG[draggedKey]?.label || draggedKey}).`, 'success');
    });

    visualOrderListEl?.addEventListener('dragend', () => {
      resetVisualOrderDragState();
    });

    visualVisibilityResetBtnEl?.addEventListener('click', () => {
      state.visualCardVisibility = createDefaultVisualCardVisibility();
      state.visualCardOrder = createDefaultVisualCardOrder();
      state.advancedVizMode = 'criteria';
      saveVisualCardVisibility();
      saveVisualCardOrder();
      syncVisualVisibilityInputs();
      renderVisualOrderList();
      applyVisualCardOrder();
      applyVisualCardVisibility();
      renderAdvancedVizChart();
      setVisualLayoutPresetSelection('full');
      resetVisualOrderDragState();
      if (visualVisibilitySettingsEl) visualVisibilitySettingsEl.open = false;
      setStatus('Tampilan visual dikembalikan ke default.', 'success');
    });

    criteriaSummaryListEl?.addEventListener('click', (event) => {
      const chip = event.target.closest('.criteria-question-chip');
      if (!chip) return;
      const questionCode = String(chip.dataset.questionCode || '').trim();
      if (!questionCode) return;
      const normalizedCode = questionCode.toUpperCase();
      if (state.selectedQuestionCode === normalizedCode) {
        renderQuestionDetail(null);
        return;
      }
      const question = findQuestionByCode(questionCode);
      if (!question) return;
      renderQuestionDetail(question);
    });

    questionDetailCloseBtnEl?.addEventListener('click', () => {
      renderQuestionDetail(null);
    });
  }

  return {
    bindVisualOrderEvents,
  };
}

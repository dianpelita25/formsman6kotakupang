export function createDragManager({ visualOrderDragState, visualOrderListEl } = {}) {
  function clearVisualOrderDragClasses() {
    if (!visualOrderListEl) return;
    const rows = visualOrderListEl.querySelectorAll('.dashboard-visual-order-item');
    rows.forEach((row) => {
      row.classList.remove('is-dragging');
      row.classList.remove('is-drag-over');
    });
  }

  function resetVisualOrderDragState() {
    visualOrderDragState.draggedKey = '';
    visualOrderDragState.overKey = '';
    clearVisualOrderDragClasses();
  }

  return {
    clearVisualOrderDragClasses,
    resetVisualOrderDragState,
  };
}

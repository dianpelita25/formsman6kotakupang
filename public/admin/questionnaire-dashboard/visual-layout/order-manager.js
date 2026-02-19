export function createOrderManager({
  state,
  VISUAL_CARD_CONFIG,
  normalizeVisualCardOrder,
  visualOrderListEl,
  saveVisualCardOrder,
  onAfterOrderApplied,
} = {}) {
  function findVisualOrderRowByKey(key) {
    const targetKey = String(key || '').trim();
    if (!targetKey || !visualOrderListEl) return null;
    const rows = visualOrderListEl.querySelectorAll('.dashboard-visual-order-item');
    for (const row of rows) {
      if (String(row.dataset.orderKey || '').trim() === targetKey) return row;
    }
    return null;
  }

  function applyVisualCardOrder() {
    const grid = document.querySelector('.dashboard-chart-grid');
    if (!grid) return;
    const order = normalizeVisualCardOrder(state.visualCardOrder);
    state.visualCardOrder = order;
    order.forEach((key) => {
      const config = VISUAL_CARD_CONFIG[key];
      if (!config) return;
      const card = document.getElementById(config.cardId);
      if (!card) return;
      grid.append(card);
    });
    onAfterOrderApplied?.();
  }

  function renderVisualOrderList() {
    if (!visualOrderListEl) return;
    const order = normalizeVisualCardOrder(state.visualCardOrder);
    state.visualCardOrder = order;
    visualOrderListEl.innerHTML = '';
    order.forEach((key, index) => {
      const config = VISUAL_CARD_CONFIG[key];
      if (!config) return;
      const row = document.createElement('div');
      row.className = 'dashboard-visual-order-item';
      row.dataset.orderKey = key;
      row.draggable = true;
      row.setAttribute('aria-label', `Urut panel ${config.label}`);

      const head = document.createElement('div');
      head.className = 'dashboard-visual-order-item__head';

      const dragHandle = document.createElement('span');
      dragHandle.className = 'dashboard-visual-order-drag';
      dragHandle.textContent = '::';
      dragHandle.setAttribute('aria-hidden', 'true');

      const label = document.createElement('p');
      label.textContent = `${index + 1}. ${config.label}`;

      const actions = document.createElement('div');
      actions.className = 'dashboard-visual-order-item__actions';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'ghost';
      upBtn.dataset.orderKey = key;
      upBtn.dataset.orderMove = 'up';
      upBtn.textContent = 'Naik';
      upBtn.disabled = index === 0;

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'ghost';
      downBtn.dataset.orderKey = key;
      downBtn.dataset.orderMove = 'down';
      downBtn.textContent = 'Turun';
      downBtn.disabled = index === order.length - 1;

      actions.append(upBtn, downBtn);
      head.append(dragHandle, label);
      row.append(head, actions);
      visualOrderListEl.append(row);
    });
  }

  function reorderVisualCardOrder(draggedKey, dropKey) {
    const fromKey = String(draggedKey || '').trim();
    const toKey = String(dropKey || '').trim();
    if (!fromKey || !toKey || fromKey === toKey) return false;
    if (!VISUAL_CARD_CONFIG[fromKey] || !VISUAL_CARD_CONFIG[toKey]) return false;

    const order = normalizeVisualCardOrder(state.visualCardOrder);
    const fromIndex = order.indexOf(fromKey);
    const toIndex = order.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0) return false;

    const [movedItem] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, movedItem);
    state.visualCardOrder = order;
    saveVisualCardOrder();
    applyVisualCardOrder();
    renderVisualOrderList();
    return true;
  }

  function moveVisualCardOrder(key, direction) {
    const targetKey = String(key || '').trim();
    if (!targetKey || !VISUAL_CARD_CONFIG[targetKey]) return false;
    const order = normalizeVisualCardOrder(state.visualCardOrder);
    const currentIndex = order.indexOf(targetKey);
    if (currentIndex < 0) return false;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= order.length) return false;

    [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
    state.visualCardOrder = order;
    saveVisualCardOrder();
    applyVisualCardOrder();
    renderVisualOrderList();
    return true;
  }

  return {
    findVisualOrderRowByKey,
    applyVisualCardOrder,
    renderVisualOrderList,
    reorderVisualCardOrder,
    moveVisualCardOrder,
  };
}

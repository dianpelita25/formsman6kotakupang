export function createTenantToggleModalController({
  refs,
  state,
  setToggleModalLoading,
}) {
  function openToggleModal(tenant, next, returnFocusElement = null) {
    if (!refs.toggleModalEl || !refs.toggleModalTitleEl || !refs.toggleModalMessageEl || !refs.toggleModalConfirmBtn) return;

    state.pendingToggleAction = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      next,
    };
    state.modalLastFocusedElement = returnFocusElement || state.activeActionTrigger || null;
    refs.toggleModalTitleEl.textContent = next ? 'Aktifkan Organisasi?' : 'Nonaktifkan Organisasi?';
    refs.toggleModalMessageEl.textContent = next
      ? `Anda akan mengaktifkan organisasi "${tenant.name}". Lanjutkan?`
      : `Anda akan menonaktifkan organisasi "${tenant.name}". Lanjutkan?`;
    refs.toggleModalConfirmBtn.textContent = next ? 'Lanjutkan Aktifkan' : 'Lanjutkan Nonaktifkan';
    refs.toggleModalConfirmBtn.dataset.labelOriginal = refs.toggleModalConfirmBtn.textContent;
    refs.toggleModalEl.hidden = false;
    document.body.classList.add('modal-open');
    setToggleModalLoading(false);
    refs.toggleModalConfirmBtn.focus();
  }

  function closeToggleModal() {
    if (!refs.toggleModalEl || refs.toggleModalEl.hidden) return;
    refs.toggleModalEl.hidden = true;
    state.pendingToggleAction = null;
    setToggleModalLoading(false);
    document.body.classList.remove('modal-open');
    const target = state.modalLastFocusedElement || state.activeActionTrigger;
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
    state.modalLastFocusedElement = null;
  }

  function getPendingToggleAction() {
    return state.pendingToggleAction;
  }

  return {
    openToggleModal,
    closeToggleModal,
    getPendingToggleAction,
  };
}

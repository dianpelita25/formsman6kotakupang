export function bindSuperadminEvents({
  refs,
  state,
  getTenantById,
  api,
  requestJson,
  setStatus,
  pushActivity,
  loadTenants,
  executeTenantStatusToggle,
  actionMenu,
  toggleModal,
  promptManager,
}) {
  refs.logoutBtn?.addEventListener('click', async () => {
    try {
      await requestJson('/forms/admin/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/forms/admin/login';
    }
  });

  refs.createTenantBtn?.addEventListener('click', async () => {
    const name = String(refs.tenantNameInput?.value || '').trim();
    const slug = String(refs.tenantSlugInput?.value || '').trim();
    const tenantType = String(refs.tenantTypeSelect?.value || 'school').trim();

    if (!name) {
      setStatus('Nama organisasi wajib diisi.', 'warning');
      return;
    }

    try {
      await api(
        '/forms/admin/api/tenants',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, tenantType }),
        },
        'Create tenant'
      );
      refs.tenantNameInput.value = '';
      refs.tenantSlugInput.value = '';
      refs.tenantTypeSelect.value = 'school';
      await loadTenants();
      await promptManager.loadPromptManager();
      setStatus('Organisasi berhasil dibuat.', 'success');
      pushActivity('success', 'Create tenant', `${name} (${tenantType})`);
    } catch {
      // handled in api()
    }
  });

  refs.tenantsBody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const tenantId = button.dataset.id;
    const action = button.dataset.action;
    if (!tenantId || action !== 'toggle-menu') return;
    event.preventDefault();
    const tenant = getTenantById(tenantId);
    if (!tenant) return;
    actionMenu.toggleTenantActionMenu(button, tenant);
  });

  document.body.addEventListener('click', async (event) => {
    const floatingMenu = state.activeActionMenu;
    if (!floatingMenu || floatingMenu.hidden) return;

    const menuAction = event.target.closest('[data-action]');
    if (!menuAction || !floatingMenu.contains(menuAction)) return;
    const tenantId = String(menuAction.dataset.id || '').trim();
    const action = String(menuAction.dataset.action || '').trim();
    if (!tenantId || !action) return;

    if (action === 'toggle') {
      const tenant = getTenantById(tenantId);
      const next = menuAction.dataset.next === 'true';
      if (!tenant) return;
      const focusTarget = state.activeActionTrigger;
      actionMenu.closeAllTenantActionMenus();
      toggleModal.openToggleModal(tenant, next, focusTarget);
      return;
    }

    if (action === 'prompt-override') {
      actionMenu.closeAllTenantActionMenus();
      promptManager.focusPromptOverride(tenantId);
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.tenant-actions-inline')) return;
    if (event.target.closest('.action-menu--floating')) return;
    actionMenu.closeAllTenantActionMenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (refs.toggleModalEl && !refs.toggleModalEl.hidden) {
      if (refs.toggleModalConfirmBtn?.disabled) return;
      event.preventDefault();
      toggleModal.closeToggleModal();
      return;
    }
    actionMenu.closeAllTenantActionMenus({ restoreFocus: true });
  });

  window.addEventListener('resize', () => actionMenu.closeAllTenantActionMenus());
  window.addEventListener('scroll', () => actionMenu.closeAllTenantActionMenus(), true);

  refs.toggleModalCancelBtn?.addEventListener('click', () => toggleModal.closeToggleModal());
  refs.toggleModalConfirmBtn?.addEventListener('click', executeTenantStatusToggle);
  refs.toggleModalEl?.addEventListener('click', (event) => {
    if (refs.toggleModalConfirmBtn?.disabled) return;
    if (event.target === refs.toggleModalEl) {
      toggleModal.closeToggleModal();
    }
  });

  refs.createAdminBtn?.addEventListener('click', async () => {
    const tenantId = String(refs.tenantSelectEl.value || '').trim();
    const email = String(refs.adminEmailInput?.value || '').trim();
    const password = String(refs.adminPasswordInput?.value || '');

    if (!tenantId) {
      setStatus('Pilih organisasi dulu.', 'warning');
      return;
    }

    try {
      await api(
        `/forms/admin/api/tenants/${tenantId}/admins`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
        'Create tenant admin'
      );
      refs.adminEmailInput.value = '';
      refs.adminPasswordInput.value = '';
      setStatus('Admin organisasi berhasil ditambahkan.', 'success');
      pushActivity('success', 'Create tenant admin', email);
    } catch {
      // handled in api()
    }
  });

  refs.promptModeEl?.addEventListener('change', () => promptManager.loadPromptManager());
  refs.promptScopeEl?.addEventListener('change', async () => {
    promptManager.syncPromptScopeUi();
    await promptManager.loadQuestionnairesForSelectedTenant();
    await promptManager.loadPromptManager();
  });
  refs.promptTenantSelectEl?.addEventListener('change', async () => {
    await promptManager.loadQuestionnairesForSelectedTenant();
    await promptManager.loadPromptManager();
  });
  refs.promptQuestionnaireSelectEl?.addEventListener('change', () => promptManager.loadPromptManager());
  refs.promptTemplateEl?.addEventListener('input', () => promptManager.updatePromptDraftMeta());
  refs.promptChangeNoteEl?.addEventListener('input', () => promptManager.updatePromptDraftMeta());
  refs.promptSaveBtn?.addEventListener('click', () => promptManager.savePromptDraft());
  refs.promptPublishBtn?.addEventListener('click', () => promptManager.publishPrompt());
  refs.promptResetBtn?.addEventListener('click', () => promptManager.resetPromptToPublished());
  refs.promptRefreshBtn?.addEventListener('click', () => promptManager.loadPromptManager());
}

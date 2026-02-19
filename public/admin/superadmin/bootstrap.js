import {
  bindRuntimeErrorHandlers,
  createActivityFeed,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';
import { createSuperadminApiClient } from './api-client.js';
import { createSuperadminDomRefs } from './dom-refs.js';
import { bindSuperadminEvents } from './event-bindings.js';
import { createSuperadminPromptManager } from './prompt-manager.js';
import { createSuperadminState, MODE_LABELS, getTenantById } from './state.js';
import { createSuperadminStatusController } from './status.js';
import { createTenantActionMenuController } from './tenant-action-menu.js';
import { createTenantTableController } from './tenant-table.js';
import { createTenantToggleModalController } from './tenant-toggle-modal.js';

export function bootstrapSuperadminRuntime() {
  const refs = createSuperadminDomRefs(document);
  const state = createSuperadminState({
    createActivityFeed,
    activityFeedEl: refs.activityFeedEl,
  });
  const status = createSuperadminStatusController({
    refs,
    setInlineStatus,
    setErrorDebugPanel,
    activityFeed: state.activityFeed,
  });
  const { api } = createSuperadminApiClient({
    requestJson,
    normalizeUiError,
    setStatus: status.setStatus,
    pushActivity: status.pushActivity,
  });
  const tenantTable = createTenantTableController({ refs });
  const actionMenu = createTenantActionMenuController({
    state,
    buildPublicQuestionnaireLink: tenantTable.buildPublicQuestionnaireLink,
    buildTenantDashboardLink: tenantTable.buildTenantDashboardLink,
  });
  const toggleModal = createTenantToggleModalController({
    refs,
    state,
    setToggleModalLoading: status.setToggleModalLoading,
  });
  const getTenant = (tenantId) => getTenantById(state, tenantId);
  const promptManager = createSuperadminPromptManager({
    refs,
    state,
    modeLabels: MODE_LABELS,
    getTenantById: getTenant,
    formatDateTime: tenantTable.formatDateTime,
    api,
    requestJson,
    normalizeUiError,
    setPromptStatus: status.setPromptStatus,
    pushActivity: status.pushActivity,
    setErrorDebugPanel,
  });

  async function loadMe() {
    const payload = await api('/forms/admin/api/me', undefined, 'Validasi sesi superadmin');
    if (!payload.user?.isSuperadmin) {
      throw new Error('Akun ini bukan superadmin.');
    }
    refs.userInfoEl.textContent = `Login sebagai ${payload.user.email}`;
    status.pushActivity('success', 'Sesi valid', payload.user.email);
  }

  async function loadTenants() {
    const payload = await api('/forms/admin/api/tenants', undefined, 'Load daftar tenant');
    state.tenantCache = Array.isArray(payload.data) ? payload.data : [];
    tenantTable.renderTenants(state.tenantCache);
    tenantTable.mapTenantOptions(state.tenantCache);
    status.pushActivity('success', 'Load tenant', `${state.tenantCache.length} organisasi`);
  }

  async function executeTenantStatusToggle() {
    const pending = toggleModal.getPendingToggleAction();
    if (!pending) return;
    status.setStatus('Memproses perubahan status organisasi...', 'warning');
    status.setToggleModalLoading(true);

    try {
      await api(
        `/forms/admin/api/tenants/${pending.tenantId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: pending.next }),
        },
        'Toggle tenant status'
      );
      await loadTenants();
      await promptManager.loadPromptManager();
      toggleModal.closeToggleModal();
      status.setStatus('Status organisasi berhasil diperbarui.', 'success');
      status.pushActivity(
        'success',
        'Toggle tenant status',
        `${pending.tenantName} -> ${pending.next ? 'aktif' : 'nonaktif'}`
      );
    } catch {
      status.setToggleModalLoading(false);
    }
  }

  bindRuntimeErrorHandlers((normalized, originalError) => {
    status.setStatus(normalized.message, 'error', originalError);
    status.pushActivity(
      'error',
      'Runtime error',
      `${normalized.method || '-'} ${normalized.path || '-'} (status ${normalized.status || '-'})`
    );
  });

  bindSuperadminEvents({
    refs,
    state,
    getTenantById: getTenant,
    api,
    requestJson,
    setStatus: status.setStatus,
    pushActivity: status.pushActivity,
    loadTenants,
    executeTenantStatusToggle,
    actionMenu,
    toggleModal,
    promptManager,
  });

  async function bootstrap() {
    try {
      await loadMe();
      await loadTenants();
      promptManager.syncPromptScopeUi();
      await promptManager.loadQuestionnairesForSelectedTenant();
      await promptManager.loadPromptManager();
      status.setStatus('Panel superadmin siap dipakai.', 'success');
    } catch {
      window.location.href = `/forms/admin/login?redirect=${encodeURIComponent('/forms/admin/')}`;
    }
  }

  return bootstrap();
}

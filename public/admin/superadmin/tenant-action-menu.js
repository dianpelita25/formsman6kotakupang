import { getTenantDefaultQuestionnaireSlug } from './state.js';

function createActionLink(label, href, className = 'action-link') {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

export function createTenantActionMenuController({
  state,
  buildPublicQuestionnaireLink,
  buildTenantDashboardLink,
}) {
  function closeAllTenantActionMenus({ restoreFocus = false } = {}) {
    const trigger = state.activeActionTrigger;
    if (state.activeActionTrigger) {
      state.activeActionTrigger.setAttribute('aria-expanded', 'false');
    }
    if (state.activeActionMenu) {
      state.activeActionMenu.hidden = true;
      state.activeActionMenu.innerHTML = '';
    }
    state.activeActionTrigger = null;
    if (restoreFocus && trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  }

  function ensureFloatingActionMenu() {
    let menu = document.getElementById('tenant-action-menu-floating');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'tenant-action-menu-floating';
      menu.className = 'action-menu action-menu--floating';
      menu.setAttribute('role', 'menu');
      menu.hidden = true;
      const floatingHost = document.querySelector('.superadmin-page') || document.body;
      floatingHost.append(menu);
    }
    return menu;
  }

  function buildFloatingMenuItems(menu, tenant) {
    menu.innerHTML = '';
    const defaultQuestionnaireSlug = getTenantDefaultQuestionnaireSlug(tenant);
    let publicEntry;
    if (defaultQuestionnaireSlug) {
      publicEntry = createActionLink(
        'Form Publik',
        buildPublicQuestionnaireLink(tenant),
        'action-menu-item action-menu-item--link'
      );
      publicEntry.setAttribute('role', 'menuitem');
    } else {
      const disabledButton = document.createElement('button');
      disabledButton.type = 'button';
      disabledButton.className = 'action-menu-item is-disabled';
      disabledButton.disabled = true;
      disabledButton.title = 'Belum ada questionnaire default.';
      disabledButton.setAttribute('aria-disabled', 'true');
      disabledButton.textContent = 'Form Publik';
      publicEntry = disabledButton;
    }

    const dashboardLink = createActionLink(
      'Dashboard',
      buildTenantDashboardLink(tenant),
      'action-menu-item action-menu-item--link'
    );
    dashboardLink.setAttribute('role', 'menuitem');

    const promptButton = document.createElement('button');
    promptButton.type = 'button';
    promptButton.className = 'action-menu-item';
    promptButton.dataset.action = 'prompt-override';
    promptButton.dataset.id = tenant.id;
    promptButton.setAttribute('role', 'menuitem');
    promptButton.textContent = 'Kelola Prompt';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'action-menu-item is-danger';
    toggleButton.dataset.action = 'toggle';
    toggleButton.dataset.id = tenant.id;
    toggleButton.dataset.next = String(!tenant.is_active);
    toggleButton.setAttribute('role', 'menuitem');
    toggleButton.textContent = tenant.is_active ? 'Nonaktifkan Organisasi' : 'Aktifkan Organisasi';

    const divider = document.createElement('div');
    divider.className = 'action-menu-divider';
    menu.append(publicEntry, dashboardLink, promptButton, divider, toggleButton);
  }

  function toggleTenantActionMenu(triggerButton, tenant) {
    if (!triggerButton || !tenant) return;
    const isSameTrigger = state.activeActionTrigger === triggerButton;
    if (isSameTrigger && state.activeActionMenu && !state.activeActionMenu.hidden) {
      closeAllTenantActionMenus();
      return;
    }

    closeAllTenantActionMenus();

    const menu = ensureFloatingActionMenu();
    buildFloatingMenuItems(menu, tenant);
    menu.hidden = false;
    menu.style.visibility = 'hidden';

    const triggerRect = triggerButton.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    let top = triggerRect.bottom + 6;
    if (viewportHeight - triggerRect.bottom < menuRect.height + 8) {
      top = triggerRect.top - menuRect.height - 6;
    }
    top = Math.max(8, Math.min(top, viewportHeight - menuRect.height - 8));

    let left = triggerRect.right - menuRect.width;
    left = Math.max(8, Math.min(left, viewportWidth - menuRect.width - 8));

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = 'visible';

    state.activeActionMenu = menu;
    state.activeActionTrigger = triggerButton;
    state.activeActionTrigger.setAttribute('aria-expanded', 'true');
  }

  return {
    closeAllTenantActionMenus,
    toggleTenantActionMenu,
  };
}

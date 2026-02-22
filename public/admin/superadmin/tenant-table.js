import { LEGACY_SCHOOL_SLUG, getTenantDefaultQuestionnaireSlug } from './state.js';

function createActionLink(label, href, className = 'action-link') {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

export function tenantTypeLabel(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'school') return 'Sekolah';
  if (normalized === 'business') return 'Usaha';
  if (normalized === 'government') return 'Pemerintah';
  if (normalized === 'class') return 'Kelas';
  if (normalized === 'community') return 'Komunitas';
  if (normalized === 'event') return 'Event';
  return 'Lainnya';
}

export function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createTruncateCell(className, value) {
  const cell = document.createElement('td');
  if (className) {
    cell.className = className;
  }
  const span = document.createElement('span');
  span.className = 'cell-truncate';
  span.textContent = value || '-';
  span.title = value || '-';
  cell.append(span);
  return cell;
}

export function createTenantTableController({ refs }) {
  function buildPublicQuestionnaireLink(tenant) {
    if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
      return `/forms/${tenant.slug}/`;
    }
    const preferredSlug = getTenantDefaultQuestionnaireSlug(tenant);
    if (!preferredSlug) {
      return `/forms/${tenant.slug}/`;
    }
    return `/forms/${tenant.slug}/${preferredSlug}/`;
  }

  function buildTenantDashboardLink(tenant) {
    if (tenant?.slug === LEGACY_SCHOOL_SLUG) {
      return `/forms/${tenant.slug}/admin/dashboard/`;
    }
    const preferredSlug = getTenantDefaultQuestionnaireSlug(tenant);
    if (!preferredSlug) {
      return `/forms/${tenant.slug}/admin/`;
    }
    return `/forms/${tenant.slug}/admin/questionnaires/${preferredSlug}/dashboard/`;
  }

  function createTenantActionsCell(tenant) {
    const cell = document.createElement('td');
    cell.className = 'school-actions-cell';

    const actionWrap = document.createElement('div');
    actionWrap.className = 'tenant-actions-inline';
    const actionRow = document.createElement('div');
    actionRow.className = 'tenant-actions-row';

    const panelLink = createActionLink(
      'Panel Organisasi',
      `/forms/${tenant.slug}/admin/`,
      'action-link action-link--primary'
    );

    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'action-menu-trigger ghost';
    menuTrigger.dataset.action = 'toggle-menu';
    menuTrigger.dataset.id = tenant.id;
    menuTrigger.setAttribute('aria-label', `Aksi organisasi ${tenant.name}`);
    menuTrigger.setAttribute('aria-haspopup', 'menu');
    menuTrigger.setAttribute('aria-expanded', 'false');
    menuTrigger.textContent = 'Aksi';

    actionRow.append(panelLink, menuTrigger);
    actionWrap.append(actionRow);
    cell.append(actionWrap);
    return cell;
  }

  function renderTenants(tenants) {
    refs.tenantsBody.innerHTML = '';
    if (!tenants.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'Belum ada organisasi.';
      row.append(cell);
      refs.tenantsBody.append(row);
      return;
    }

    tenants.forEach((tenant) => {
      const row = document.createElement('tr');
      row.append(createTruncateCell('school-name-cell', tenant.name));
      row.append(createTruncateCell('school-slug-cell', tenant.slug));

      const typeCell = document.createElement('td');
      typeCell.textContent = tenantTypeLabel(tenant.tenant_type);
      row.append(typeCell);

      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-badge ${tenant.is_active ? 'is-active' : 'is-inactive'}`;
      statusBadge.textContent = tenant.is_active ? 'Aktif' : 'Nonaktif';
      statusCell.append(statusBadge);
      row.append(statusCell);

      const totalQuestionnairesCell = document.createElement('td');
      totalQuestionnairesCell.className = 'cell-number';
      totalQuestionnairesCell.textContent = String(tenant.total_questionnaires ?? 0);
      row.append(totalQuestionnairesCell);

      const totalResponsesCell = document.createElement('td');
      totalResponsesCell.className = 'total-responses-cell cell-number';
      totalResponsesCell.textContent = String(tenant.total_responses ?? 0);
      row.append(totalResponsesCell);

      row.append(createTenantActionsCell(tenant));
      refs.tenantsBody.append(row);
    });
  }

  function mapTenantOptions(items) {
    refs.tenantSelectEl.innerHTML = '';
    refs.promptTenantSelectEl.innerHTML = '';

    if (!items.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Belum ada organisasi';
      refs.tenantSelectEl.append(option.cloneNode(true));
      refs.promptTenantSelectEl.append(option);
      return;
    }

    items.forEach((tenant) => {
      const label = `${tenant.name} (${tenant.slug})`;

      const adminOption = document.createElement('option');
      adminOption.value = tenant.id;
      adminOption.textContent = label;
      refs.tenantSelectEl.append(adminOption);

      const promptOption = document.createElement('option');
      promptOption.value = tenant.id;
      promptOption.textContent = label;
      refs.promptTenantSelectEl.append(promptOption);
    });
  }

  return {
    mapTenantOptions,
    renderTenants,
    buildPublicQuestionnaireLink,
    buildTenantDashboardLink,
    formatDateTime,
  };
}

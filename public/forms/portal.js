import {
  bindRuntimeErrorHandlers,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';

const schoolGrid = document.getElementById('school-grid');
const schoolSearch = document.getElementById('school-search');
const portalStatus = document.getElementById('portal-status');
const portalErrorDebug = document.getElementById('portal-error-debug');
const portalErrorDebugWrap = document.getElementById('portal-error-debug-wrap');

let tenantCache = [];

function setStatus(message, kind = 'info', error = null) {
  setInlineStatus(portalStatus, message, kind);
  if (error) {
    if (portalErrorDebugWrap) {
      portalErrorDebugWrap.hidden = false;
      portalErrorDebugWrap.open = false;
    }
    setErrorDebugPanel(portalErrorDebug, error);
    return;
  }
  if (portalErrorDebug) {
    portalErrorDebug.textContent = 'Belum ada error.';
  }
  if (portalErrorDebugWrap) {
    portalErrorDebugWrap.hidden = true;
    portalErrorDebugWrap.open = false;
  }
}

function tenantTypeLabel(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'school') return 'Sekolah';
  if (normalized === 'business') return 'Usaha';
  if (normalized === 'government') return 'Pemerintah';
  if (normalized === 'class') return 'Kelas';
  if (normalized === 'community') return 'Komunitas';
  if (normalized === 'event') return 'Event';
  return 'Organisasi';
}

function resolveDefaultQuestionnaire(tenant) {
  const questionnaires = Array.isArray(tenant.questionnaires) ? tenant.questionnaires : [];
  if (!questionnaires.length) return null;
  return questionnaires.find((item) => item.isDefault) || questionnaires[0];
}

function renderTenants(items) {
  schoolGrid.innerHTML = '';
  if (!items.length) {
    schoolGrid.innerHTML = `<div class="school-card"><p>Tidak ada organisasi aktif yang cocok.</p></div>`;
    return;
  }

  items.forEach((tenant) => {
    const defaultQuestionnaire = resolveDefaultQuestionnaire(tenant);
    const publicFormLink = defaultQuestionnaire ? `/forms/${tenant.slug}/${defaultQuestionnaire.slug}/` : '';
    const publicDashboardLink = defaultQuestionnaire
      ? `/forms/${tenant.slug}/${defaultQuestionnaire.slug}/dashboard/`
      : '';

    const card = document.createElement('article');
    card.className = 'school-card';
    const publicAction = defaultQuestionnaire
      ? `<a href="${publicFormLink}">Buka Form Publik</a>`
      : '<span class="action-disabled">Form publik belum tersedia</span>';
    const dashboardAction = defaultQuestionnaire
      ? `<a href="${publicDashboardLink}">Dashboard Publik</a>`
      : '<span class="action-disabled">Dashboard publik belum tersedia</span>';
    card.innerHTML = `
      <h3>${tenant.name}</h3>
      <p class="school-meta">Slug: ${tenant.slug}</p>
      <p class="school-meta">Tipe: ${tenantTypeLabel(tenant.tenant_type || tenant.tenantType)}</p>
      <p class="school-meta">Kuesioner: ${defaultQuestionnaire ? defaultQuestionnaire.name : 'Belum tersedia'}</p>
      <div class="school-actions">
        ${publicAction}
        ${dashboardAction}
        <a href="/forms/${tenant.slug}/admin/">Panel Organisasi</a>
      </div>
    `;
    schoolGrid.append(card);
  });
}

function applyFilter() {
  const keyword = String(schoolSearch.value || '')
    .trim()
    .toLowerCase();
  if (!keyword) {
    renderTenants(tenantCache);
    return;
  }

  const filtered = tenantCache.filter((tenant) => {
    const questionnaires = Array.isArray(tenant.questionnaires) ? tenant.questionnaires : [];
    const questionnaireText = questionnaires.map((item) => `${item.name} ${item.slug}`).join(' ');
    const haystack = `${tenant.name} ${tenant.slug} ${tenant.tenant_type || ''} ${questionnaireText}`.toLowerCase();
    return haystack.includes(keyword);
  });
  renderTenants(filtered);
}

async function loadTenantQuestionnaires(tenantSlug) {
  try {
    const payload = await requestJson(`/forms/${tenantSlug}/api/questionnaires/public`);
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

async function loadTenants() {
  setStatus('Memuat daftar organisasi...');
  try {
    const payload = await requestJson('/forms/api/tenants/public');
    const tenants = Array.isArray(payload.data) ? payload.data : [];
    const questionnaireLists = await Promise.all(tenants.map((tenant) => loadTenantQuestionnaires(tenant.slug)));
    tenantCache = tenants.map((tenant, index) => ({
      ...tenant,
      questionnaires: questionnaireLists[index] || [],
    }));
    renderTenants(tenantCache);
    setStatus(`Menampilkan ${tenantCache.length} organisasi aktif.`, 'success');
  } catch (error) {
    const normalized = normalizeUiError(error, 'Gagal memuat portal.');
    setStatus(normalized.message, 'error', error);
  }
}

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

schoolSearch.addEventListener('input', applyFilter);
loadTenants();

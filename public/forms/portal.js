import {
  bindRuntimeErrorHandlers,
  normalizeUiError,
  requestJson,
  setErrorDebugPanel,
  setInlineStatus,
} from '/forms-static/shared/ux.js';
import { clearChildren, createElement } from '/forms-static/shared/safe-dom.js';

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
  const defaultFromPayload = tenant?.defaultQuestionnaire;
  if (defaultFromPayload && defaultFromPayload.slug) {
    return defaultFromPayload;
  }

  const legacyDefaultSlug =
    String(tenant?.defaultQuestionnaireSlug || tenant?.default_questionnaire_slug || '').trim();
  if (legacyDefaultSlug) {
    return {
      id: tenant?.defaultQuestionnaireId || tenant?.default_questionnaire_id || '',
      slug: legacyDefaultSlug,
      name:
        String(
          tenant?.defaultQuestionnaireName ||
            tenant?.default_questionnaire_name ||
            'Kuesioner Utama'
        ).trim() || 'Kuesioner Utama',
      isDefault: true,
    };
  }

  const questionnaires = Array.isArray(tenant.questionnaires) ? tenant.questionnaires : [];
  if (!questionnaires.length) return null;
  return questionnaires.find((item) => item.isDefault) || questionnaires[0];
}

function renderTenants(items) {
  clearChildren(schoolGrid);
  if (!items.length) {
    const emptyCard = createElement('div', { className: 'school-card' });
    emptyCard.append(createElement('p', { text: 'Tidak ada organisasi aktif yang cocok.' }));
    schoolGrid.append(emptyCard);
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
    card.append(createElement('h3', { text: tenant.name }));
    card.append(createElement('p', { className: 'school-meta', text: `Slug: ${tenant.slug}` }));
    card.append(
      createElement('p', {
        className: 'school-meta',
        text: `Tipe: ${tenantTypeLabel(tenant.tenant_type || tenant.tenantType)}`,
      })
    );
    card.append(
      createElement('p', {
        className: 'school-meta',
        text: `Kuesioner: ${defaultQuestionnaire ? defaultQuestionnaire.name : 'Belum tersedia'}`,
      })
    );

    const actions = createElement('div', { className: 'school-actions' });

    if (defaultQuestionnaire) {
      actions.append(createElement('a', { text: 'Buka Form Publik', attrs: { href: publicFormLink } }));
    } else {
      actions.append(createElement('span', { className: 'action-disabled', text: 'Form publik belum tersedia' }));
    }

    if (defaultQuestionnaire) {
      actions.append(createElement('a', { text: 'Dashboard Publik', attrs: { href: publicDashboardLink } }));
    } else {
      actions.append(
        createElement('span', { className: 'action-disabled', text: 'Dashboard publik belum tersedia' })
      );
    }

    actions.append(
      createElement('a', {
        text: 'Panel Organisasi',
        attrs: { href: `/forms/${tenant.slug}/admin/` },
      })
    );
    card.append(actions);
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
    const questionnaireTextFromList = questionnaires.map((item) => `${item.name} ${item.slug}`).join(' ');
    const questionnaireTextFromDefault = tenant.defaultQuestionnaire
      ? `${tenant.defaultQuestionnaire.name} ${tenant.defaultQuestionnaire.slug}`
      : '';
    const questionnaireText = `${questionnaireTextFromList} ${questionnaireTextFromDefault}`.trim();
    const haystack = `${tenant.name} ${tenant.slug} ${tenant.tenant_type || ''} ${questionnaireText}`.toLowerCase();
    return haystack.includes(keyword);
  });
  renderTenants(filtered);
}

async function loadTenants() {
  setStatus('Memuat daftar organisasi...');
  try {
    const payload = await requestJson('/forms/api/tenants/public');
    const tenants = Array.isArray(payload.data) ? payload.data : [];
    tenantCache = tenants.map((tenant) => ({
      ...tenant,
      defaultQuestionnaire: resolveDefaultQuestionnaire(tenant),
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

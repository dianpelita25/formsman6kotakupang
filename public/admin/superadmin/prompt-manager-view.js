export function createPromptChip(label, value) {
  const chip = document.createElement('span');
  chip.className = 'prompt-chip';

  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  const text = document.createElement('span');
  text.textContent = value;

  chip.append(strong, text);
  return chip;
}

function formatScopeLabel(scope) {
  const normalized = String(scope || '').trim().toLowerCase();
  if (normalized === 'questionnaire') return 'Override Kuesioner';
  if (normalized === 'tenant') return 'Override Organisasi';
  return 'Global';
}

export function resolveDraftTemplate(bundle, selection) {
  if (!bundle) return '';
  if (selection.scope === 'questionnaire') {
    return (
      bundle.questionnaireDraft?.template ||
      bundle.questionnairePublished?.template ||
      bundle.tenantDraft?.template ||
      bundle.tenantPublished?.template ||
      bundle.globalDraft?.template ||
      bundle.globalPublished?.template ||
      bundle.effective?.template ||
      ''
    );
  }
  if (selection.scope === 'tenant') {
    return (
      bundle.tenantDraft?.template ||
      bundle.tenantPublished?.template ||
      bundle.globalDraft?.template ||
      bundle.globalPublished?.template ||
      bundle.effective?.template ||
      ''
    );
  }
  return bundle.globalDraft?.template || bundle.globalPublished?.template || bundle.effective?.template || '';
}

export function resolvePublishedTemplate(bundle, selection) {
  if (!bundle) return '';
  if (selection.scope === 'questionnaire') {
    return (
      bundle.questionnairePublished?.template ||
      bundle.tenantPublished?.template ||
      bundle.globalPublished?.template ||
      bundle.effective?.template ||
      ''
    );
  }
  if (selection.scope === 'tenant') {
    return bundle.tenantPublished?.template || bundle.globalPublished?.template || bundle.effective?.template || '';
  }
  return bundle.globalPublished?.template || bundle.effective?.template || '';
}

export function renderPromptEffective({
  refs,
  bundle,
  selection,
  modeLabels,
  getTenantById,
  questionnaireCache,
  formatDateTime,
}) {
  if (!bundle?.effective) {
    refs.promptEffectiveMetaEl.innerHTML = '';
    refs.promptEffectiveEl.textContent = 'Belum ada prompt efektif.';
    return;
  }

  const source =
    bundle.effective.source === 'questionnaire'
      ? 'override kuesioner'
      : bundle.effective.source === 'tenant'
        ? 'override organisasi'
        : bundle.effective.source === 'global'
          ? 'global'
          : 'cadangan';

  const effectiveTenant =
    bundle.effective.tenantId && getTenantById(bundle.effective.tenantId)
      ? getTenantById(bundle.effective.tenantId).name
      : '-';
  const effectiveQuestionnaire = questionnaireCache.find(
    (item) => item.id === (bundle.effective.questionnaireId || bundle.questionnaireId || selection.questionnaireId)
  );

  refs.promptEffectiveMetaEl.innerHTML = '';
  refs.promptEffectiveMetaEl.append(
    createPromptChip('Mode', modeLabels[bundle.mode] || bundle.mode),
    createPromptChip('Sumber', source),
    createPromptChip('Cakupan', formatScopeLabel(selection.scope)),
    createPromptChip('Organisasi', selection.scope === 'global' ? '-' : effectiveTenant),
    createPromptChip('Kuesioner', effectiveQuestionnaire?.name || '-'),
    createPromptChip('Terpublikasi', formatDateTime(bundle.effective.publishedAt))
  );
  refs.promptEffectiveEl.textContent = bundle.effective.template || '';
}

export function updatePromptDraftMeta({
  refs,
  selection,
  modeLabels,
  getTenantById,
  questionnaireCache,
}) {
  const tenantName = selection.scope === 'global' ? '-' : getTenantById(selection.tenantId)?.name || '-';
  const questionnaireName =
    selection.scope === 'questionnaire'
      ? questionnaireCache.find((item) => item.id === selection.questionnaireId)?.name || '-'
      : '-';
  const templateLength = String(refs.promptTemplateEl.value || '').length;
  const noteLength = String(refs.promptChangeNoteEl.value || '').length;

  refs.promptDraftMetaEl.textContent = `Template Draf ${modeLabels[selection.mode] || selection.mode} | Cakupan: ${formatScopeLabel(
    selection.scope
  )} | Organisasi: ${tenantName} | Kuesioner: ${questionnaireName} | Template: ${templateLength} karakter | Catatan: ${noteLength}/500`;
}

export function renderPromptHistoryRows({
  refs,
  rows,
  getTenantById,
  questionnaireCache,
  formatDateTime,
}) {
  refs.promptHistoryBody.innerHTML = '';
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'Belum ada riwayat.';
    row.append(cell);
    refs.promptHistoryBody.append(row);
    return;
  }

  rows.forEach((entry) => {
    const row = document.createElement('tr');

    const statusCell = document.createElement('td');
    statusCell.textContent = entry.status || '-';
    row.append(statusCell);

    const scopeCell = document.createElement('td');
    if (entry.scope === 'questionnaire') {
      const tenant = getTenantById(entry.tenantId);
      const questionnaire = questionnaireCache.find((item) => item.id === entry.questionnaireId);
      scopeCell.textContent = questionnaire
        ? `kuesioner: ${questionnaire.name} @ ${tenant?.name || '-'}`
        : `kuesioner: ${entry.questionnaireId || '-'}`;
    } else if (entry.scope === 'tenant') {
      const tenant = getTenantById(entry.tenantId);
      scopeCell.textContent = tenant ? `organisasi: ${tenant.name}` : `organisasi: ${entry.tenantId || '-'}`;
    } else {
      scopeCell.textContent = 'Global';
    }
    row.append(scopeCell);

    const noteCell = document.createElement('td');
    noteCell.textContent = entry.changeNote || '-';
    row.append(noteCell);

    const createdCell = document.createElement('td');
    createdCell.textContent = formatDateTime(entry.createdAt);
    row.append(createdCell);

    const publishedCell = document.createElement('td');
    publishedCell.textContent = formatDateTime(entry.publishedAt);
    row.append(publishedCell);
    refs.promptHistoryBody.append(row);
  });
}

import { questionnaireBuilderLink, questionnaireDashboardLink, questionnairePublicLink } from './api-client.js';

export function renderQuestionnairePromptOptions({ state, tenantPromptQuestionnaireEl } = {}) {
  tenantPromptQuestionnaireEl.innerHTML = '';
  if (!state.questionnaireItems.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Belum ada kuesioner';
    tenantPromptQuestionnaireEl.append(option);
    return;
  }

  state.questionnaireItems.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} (${item.slug})${item.isDefault ? ' [default]' : ''}`;
    tenantPromptQuestionnaireEl.append(option);
  });
}

export function renderQuestionnaireList({
  state,
  questionnaireListBodyEl,
  questionnaireEmptyEl,
} = {}) {
  questionnaireListBodyEl.innerHTML = '';
  if (!state.questionnaireItems.length) {
    questionnaireEmptyEl.style.display = 'block';
    return;
  }

  questionnaireEmptyEl.style.display = 'none';
  state.questionnaireItems.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}${item.isDefault ? ' <span class="small">[default]</span>' : ''}</td>
      <td><code>${item.slug}</code></td>
      <td>${item.category}</td>
      <td>${item.isActive ? 'Aktif' : 'Nonaktif'}</td>
      <td>${Number(item.totalResponses || 0).toLocaleString('id-ID')}</td>
      <td>
        <div class="row" style="gap:8px">
          <a class="ghost" style="padding:8px 10px;border-radius:9px;text-decoration:none" href="${questionnaireBuilderLink(state, item.slug)}">Builder Visual</a>
          <a class="ghost" style="padding:8px 10px;border-radius:9px;text-decoration:none" href="${questionnaireDashboardLink(state, item.slug)}">Dashboard</a>
          <a class="ghost" style="padding:8px 10px;border-radius:9px;text-decoration:none" href="${questionnairePublicLink(state, item.slug)}" target="_blank" rel="noopener">Form Publik</a>
          <button class="ghost" type="button" data-action="prompt" data-id="${item.id}" style="padding:8px 10px;border-radius:9px">Kelola Prompt</button>
        </div>
      </td>
    `;
    questionnaireListBodyEl.append(row);
  });
}

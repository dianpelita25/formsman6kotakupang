import { questionnaireBuilderLink, questionnaireDashboardLink, questionnairePublicLink } from './api-client.js';
import { clearChildren, createElement } from '/forms-static/shared/safe-dom.js';

export function renderQuestionnairePromptOptions({ state, tenantPromptQuestionnaireEl } = {}) {
  clearChildren(tenantPromptQuestionnaireEl);
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
    option.textContent = `${item.name} (${item.slug})${item.isDefault ? ' [utama]' : ''}`;
    tenantPromptQuestionnaireEl.append(option);
  });
}

export function renderQuestionnaireList({
  state,
  questionnaireListBodyEl,
  questionnaireEmptyEl,
} = {}) {
  clearChildren(questionnaireListBodyEl);
  if (!state.questionnaireItems.length) {
    questionnaireEmptyEl.style.display = 'block';
    return;
  }

  questionnaireEmptyEl.style.display = 'none';
  state.questionnaireItems.forEach((item) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.append(createElement('span', { text: item.name }));
    if (item.isDefault) {
      nameCell.append(document.createTextNode(' '));
      nameCell.append(createElement('span', { className: 'small', text: '[utama]' }));
    }
    row.append(nameCell);

    const slugCell = document.createElement('td');
    slugCell.append(createElement('code', { text: item.slug }));
    row.append(slugCell);

    row.append(createElement('td', { text: item.category }));
    row.append(createElement('td', { text: item.isActive ? 'Aktif' : 'Nonaktif' }));
    row.append(createElement('td', { text: Number(item.totalResponses || 0).toLocaleString('id-ID') }));

    const actionsCell = document.createElement('td');
    const actionRow = createElement('div', { className: 'row' });
    actionRow.style.gap = '8px';

    const builderLink = createElement('a', {
      className: 'ghost',
      text: 'Builder Visual',
      attrs: { href: questionnaireBuilderLink(state, item.slug) },
    });
    builderLink.style.padding = '8px 10px';
    builderLink.style.borderRadius = '9px';
    builderLink.style.textDecoration = 'none';

    const dashboardLink = createElement('a', {
      className: 'ghost',
      text: 'Dashboard',
      attrs: { href: questionnaireDashboardLink(state, item.slug) },
    });
    dashboardLink.style.padding = '8px 10px';
    dashboardLink.style.borderRadius = '9px';
    dashboardLink.style.textDecoration = 'none';

    const publicLink = createElement('a', {
      className: 'ghost',
      text: 'Form Publik',
      attrs: {
        href: questionnairePublicLink(state, item.slug),
        target: '_blank',
        rel: 'noopener',
      },
    });
    publicLink.style.padding = '8px 10px';
    publicLink.style.borderRadius = '9px';
    publicLink.style.textDecoration = 'none';

    const promptButton = createElement('button', {
      className: 'ghost',
      text: 'Kelola Prompt',
      attrs: {
        type: 'button',
        'data-action': 'prompt',
        'data-id': item.id,
      },
    });
    promptButton.style.padding = '8px 10px';
    promptButton.style.borderRadius = '9px';

    actionRow.append(builderLink, dashboardLink, publicLink, promptButton);
    actionsCell.append(actionRow);
    row.append(actionsCell);
    questionnaireListBodyEl.append(row);
  });
}

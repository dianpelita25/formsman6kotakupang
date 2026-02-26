export function createCriteriaController({
  state,
  criteriaSummaryListEl,
  criteriaSummaryHelpEl,
  questionDetailPanelEl,
  questionDetailCodeEl,
  questionDetailCriterionEl,
  questionDetailLabelEl,
  formatNumber,
  normalizeQuestionCode,
  normalizeQuestionCriterion,
} = {}) {
  function findQuestionByCode(questionCode) {
    const key = String(questionCode || '').trim().toUpperCase();
    if (!key) return null;
    return state.questionLookup.get(key) || null;
  }

  function syncCriteriaChipStates() {
    const activeCode = String(state.selectedQuestionCode || '').trim().toUpperCase();
    const chips = criteriaSummaryListEl?.querySelectorAll('.criteria-question-chip') || [];
    chips.forEach((chip) => {
      const code = String(chip.dataset.questionCode || '').trim().toUpperCase();
      const isActive = Boolean(activeCode) && code === activeCode;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderQuestionDetail(question) {
    if (!questionDetailPanelEl || !questionDetailCodeEl || !questionDetailCriterionEl || !questionDetailLabelEl) return;
    if (!question) {
      state.selectedQuestionCode = '';
      questionDetailPanelEl.hidden = true;
      questionDetailCodeEl.textContent = '-';
      questionDetailCriterionEl.textContent = '-';
      questionDetailLabelEl.textContent = '-';
      syncCriteriaChipStates();
      return;
    }

    const questionCode = normalizeQuestionCode(question);
    state.selectedQuestionCode = String(questionCode || '').trim().toUpperCase();
    const criterion = normalizeQuestionCriterion(question);
    questionDetailCodeEl.textContent = questionCode;
    questionDetailCriterionEl.textContent = criterion ? `Kriteria ${criterion}` : 'Tanpa Kriteria';
    questionDetailLabelEl.textContent = String(question.label || '-');
    questionDetailPanelEl.hidden = false;
    syncCriteriaChipStates();
  }

  function renderCriteriaSummary() {
    if (!criteriaSummaryListEl || !criteriaSummaryHelpEl) return;
    const summary = Array.isArray(state.criteriaSummary) ? state.criteriaSummary : [];
    criteriaSummaryListEl.innerHTML = '';

    const totalQuestionsWithCriterion = Number(state.distribution?.totalQuestionsWithCriterion || 0);
    const totalQuestions = Number(state.questionTypeStats?.total || 0);
    if (!summary.length) {
      criteriaSummaryHelpEl.textContent = 'Belum ada data kriteria untuk filter ini.';
      renderQuestionDetail(null);
      return;
    }

    const onlyUncategorized = summary.length === 1 && String(summary[0].criterion || '').trim() === 'Tanpa Kriteria';
    if (onlyUncategorized && totalQuestionsWithCriterion === 0) {
      criteriaSummaryHelpEl.textContent =
        'Semua soal masih tanpa kriteria. Disarankan isi kriteria di Builder agar analisis lebih presisi. Klik chip Qx untuk lihat detail soal.';
    } else if (totalQuestionsWithCriterion > 0 && totalQuestions > totalQuestionsWithCriterion) {
      const coverage = Math.round((totalQuestionsWithCriterion / Math.max(1, totalQuestions)) * 100);
      criteriaSummaryHelpEl.textContent = `Kriteria terisi ${totalQuestionsWithCriterion}/${totalQuestions} soal (${coverage}%). Dashboard menampilkan mode campuran (dengan + tanpa kriteria). Klik chip Qx untuk detail.`;
    } else if (totalQuestionsWithCriterion > 0 && totalQuestions > 0) {
      criteriaSummaryHelpEl.textContent = `Semua soal sudah berkriteria (${totalQuestionsWithCriterion}/${totalQuestions}). Klik chip Qx untuk melihat detail soal lengkap.`;
    } else {
      criteriaSummaryHelpEl.textContent = `${summary.length} kelompok kriteria terdeteksi. Klik chip Qx untuk melihat detail soal lengkap.`;
    }

    summary.forEach((item) => {
      const criterion = String(item.criterion || 'Tanpa Kriteria').trim() || 'Tanpa Kriteria';
      const totalQuestions = Number(item.totalQuestions || 0);
      const totalScaleQuestions = Number(item.totalScaleQuestions || 0);
      const avgScale = Number(item.avgScale || 0);
      const questionCodes = Array.isArray(item.questionCodes) ? item.questionCodes : [];

      const card = document.createElement('article');
      card.className = 'criteria-summary-item';

      const title = document.createElement('h4');
      title.textContent = criterion === 'Tanpa Kriteria' ? criterion : `Kriteria ${criterion}`;

      const infoQuestions = document.createElement('p');
      infoQuestions.textContent = `Jumlah soal: ${formatNumber(totalQuestions)} | Soal skala: ${formatNumber(totalScaleQuestions)}`;

      const infoScale = document.createElement('p');
      infoScale.textContent = `Rata-rata skala: ${formatNumber(avgScale, 2)}`;

      const chips = document.createElement('div');
      chips.className = 'criteria-question-chips';
      questionCodes.forEach((questionCode) => {
        const question = findQuestionByCode(questionCode);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'criteria-question-chip';
        chip.dataset.questionCode = String(questionCode);
        chip.textContent = String(questionCode);
        chip.setAttribute('aria-pressed', 'false');
        chip.setAttribute('aria-label', `Tampilkan detail ${String(questionCode)}`);
        chip.title = question?.label || String(questionCode);
        chips.append(chip);
      });

      card.append(title, infoQuestions, infoScale, chips);
      criteriaSummaryListEl.append(card);
    });

    if (state.selectedQuestionCode) {
      const selectedQuestion = findQuestionByCode(state.selectedQuestionCode);
      if (selectedQuestion) {
        renderQuestionDetail(selectedQuestion);
        return;
      }
    }
    renderQuestionDetail(null);
  }

  return {
    findQuestionByCode,
    renderQuestionDetail,
    renderCriteriaSummary,
  };
}

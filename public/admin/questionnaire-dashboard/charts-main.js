export function createMainChartsController({
  state,
  radioQuestionSelectEl,
  radioQuestionHelpEl,
  formatNumber,
  truncateText,
  normalizeQuestionCode,
  normalizeQuestionCriterion,
  renderQuestionDetail,
} = {}) {
  function destroyChart(chartKey) {
    if (state.charts[chartKey]) {
      state.charts[chartKey].destroy();
      state.charts[chartKey] = null;
    }
  }

  function renderScaleAverageChart(scaleAverages = []) {
    destroyChart('scaleAverage');
    const canvas = document.getElementById('scale-average-chart');
    if (!canvas) return;

    const normalizedItems = Array.isArray(scaleAverages) ? scaleAverages : [];
    const labels = normalizedItems.map((item, index) => normalizeQuestionCode(item, index));
    const values = normalizedItems.map((item) => Number(item.average || 0));
    if (!labels.length) {
      state.charts.scaleAverage = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Belum ada data'],
          datasets: [{ label: 'Skor', data: [0], backgroundColor: 'rgba(64,153,255,0.55)' }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
      return;
    }

    state.charts.scaleAverage = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Rata-rata',
            data: values,
            borderRadius: 8,
            backgroundColor: 'rgba(47, 198, 229, 0.65)',
            borderColor: 'rgba(47, 198, 229, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => {
                const first = Array.isArray(items) && items.length ? items[0] : null;
                if (!first) return '-';
                const detail = normalizedItems[first.dataIndex];
                if (!detail) return '-';
                const code = normalizeQuestionCode(detail, first.dataIndex);
                return `${code} - ${detail.label || detail.name || '-'}`;
              },
              label: (item) => `Rata-rata: ${formatNumber(item.parsed?.y || 0, 2)}`,
              afterLabel: (item) => {
                const detail = normalizedItems[item.dataIndex];
                const criterion = normalizeQuestionCriterion(detail);
                return criterion ? `Kriteria: ${criterion}` : 'Kriteria: Tanpa Kriteria';
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
          },
        },
      },
    });
  }

  function renderRadioQuestionOptions() {
    if (!radioQuestionSelectEl || !radioQuestionHelpEl) return;
    const options = state.radioQuestions;
    radioQuestionSelectEl.innerHTML = '';
    if (!options.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Tidak ada pertanyaan pilihan';
      radioQuestionSelectEl.append(option);
      radioQuestionSelectEl.disabled = true;
      state.selectedRadioQuestion = '';
      radioQuestionHelpEl.textContent = 'Hanya pertanyaan tipe "Pilihan" atau "Pilihan Ganda" yang bisa dianalisis di panel ini.';
      renderQuestionDetail(null);
      return;
    }

    radioQuestionSelectEl.disabled = false;
    options.forEach((question, index) => {
      const questionCode = normalizeQuestionCode(question, index);
      const option = document.createElement('option');
      option.value = question.name;
      option.textContent =
        question.type === 'checkbox'
          ? `${questionCode} - ${truncateText(question.label, 58)} (Pilihan Ganda)`
          : `${questionCode} - ${truncateText(question.label, 58)}`;
      option.title = question.label || question.name;
      radioQuestionSelectEl.append(option);
    });

    if (!state.selectedRadioQuestion || !options.some((item) => item.name === state.selectedRadioQuestion)) {
      state.selectedRadioQuestion = options[0].name;
    }
    radioQuestionSelectEl.value = state.selectedRadioQuestion;
    radioQuestionHelpEl.textContent = `${options.length} pertanyaan tipe Pilihan/Pilihan Ganda tersedia. Label dipersingkat menjadi Qx.`;
  }

  function renderRadioDistributionChart() {
    destroyChart('radioDistribution');
    const canvas = document.getElementById('radio-distribution-chart');
    if (!canvas) return;

    const question = state.radioQuestions.find((item) => item.name === state.selectedRadioQuestion);
    if (!question) {
      state.charts.radioDistribution = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Belum ada data'],
          datasets: [{ data: [1], backgroundColor: ['rgba(106,164,255,0.45)'] }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
      renderQuestionDetail(null);
      return;
    }

    renderQuestionDetail(question);

    const labels = (question.counts || []).map((entry) => entry.label);
    const values = (question.counts || []).map((entry) => Number(entry.total || 0));
    state.charts.radioDistribution = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ['#3ba6ff', '#31d5ff', '#6f7dff', '#8f6dff', '#3ce6b4', '#ff7b9d', '#ffb347'],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  function renderTrendChart(points = []) {
    destroyChart('trend');
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    const labels = points.map((entry) => entry.day);
    const values = points.map((entry) => Number(entry.total || 0));

    state.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total respons',
            data: values,
            borderColor: '#33d9ff',
            backgroundColor: 'rgba(51, 217, 255, 0.18)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  return {
    destroyChart,
    renderScaleAverageChart,
    renderRadioQuestionOptions,
    renderRadioDistributionChart,
    renderTrendChart,
  };
}

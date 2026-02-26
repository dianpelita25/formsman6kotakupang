function resolveChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue('--theme-chart-primary').trim() || '#3a8dff',
    secondary: styles.getPropertyValue('--theme-chart-secondary').trim() || '#2ce3ff',
    tertiary: styles.getPropertyValue('--theme-chart-tertiary').trim() || '#8b5cf6',
    text: styles.getPropertyValue('--theme-chart-text').trim() || '#dce8ff',
    grid: styles.getPropertyValue('--theme-chart-grid').trim() || 'rgba(126, 176, 255, 0.2)',
  };
}

function createCommonOptions(colors, extraY = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 180,
    plugins: {
      legend: {
        labels: { color: colors.text },
      },
    },
    scales: {
      x: {
        ticks: { color: colors.text },
        grid: { color: colors.grid },
      },
      y: {
        ticks: { color: colors.text, ...extraY.ticks },
        grid: { color: colors.grid },
        beginAtZero: true,
        ...extraY.base,
      },
    },
  };
}

export function createChartRenderer() {
  let trendChart = null;
  let criteriaChart = null;
  let scaleChart = null;

  function resetCharts() {
    [trendChart, criteriaChart, scaleChart].forEach((chart) => chart?.destroy?.());
    trendChart = null;
    criteriaChart = null;
    scaleChart = null;
  }

  function renderTrendChart(points = []) {
    if (!window.Chart) return;
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    const colors = resolveChartColors();

    trendChart = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map((point) => String(point.day || '')),
        datasets: [
          {
            label: 'Respons Harian',
            data: points.map((point) => Number(point.total || 0)),
            borderColor: colors.primary,
            backgroundColor: 'rgba(58, 141, 255, 0.22)',
            fill: true,
            tension: 0.24,
          },
        ],
      },
      options: createCommonOptions(colors, { ticks: { precision: 0 } }),
    });
  }

  function renderCriteriaChart(criteriaSummary = []) {
    if (!window.Chart) return;
    const canvas = document.getElementById('criteria-chart');
    if (!canvas) return;
    const colors = resolveChartColors();
    const list = (Array.isArray(criteriaSummary) ? criteriaSummary : []).slice(0, 8);

    criteriaChart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: list.map((entry) => entry.criterion || '-'),
        datasets: [
          {
            label: 'Rata-rata Skala',
            data: list.map((entry) => Number(entry.avgScale || 0)),
            backgroundColor: 'rgba(44, 227, 255, 0.35)',
            borderColor: colors.secondary,
            borderWidth: 1,
          },
        ],
      },
      options: createCommonOptions(colors, { base: { suggestedMax: 5 } }),
    });
  }

  function renderScaleChart(scaleAverages = []) {
    if (!window.Chart) return;
    const canvas = document.getElementById('scale-chart');
    if (!canvas) return;
    const colors = resolveChartColors();
    const list = (Array.isArray(scaleAverages) ? scaleAverages : [])
      .slice()
      .sort((left, right) => Number(right.average || 0) - Number(left.average || 0))
      .slice(0, 8);

    scaleChart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: list.map((entry) => entry.questionCode || entry.label || entry.name || '-'),
        datasets: [
          {
            label: 'Skor Rata-rata',
            data: list.map((entry) => Number(entry.average || 0)),
            backgroundColor: 'rgba(139, 92, 246, 0.34)',
            borderColor: colors.tertiary,
            borderWidth: 1,
          },
        ],
      },
      options: createCommonOptions(colors, { base: { suggestedMax: 5 } }),
    });
  }

  return {
    resetCharts,
    renderTrendChart,
    renderCriteriaChart,
    renderScaleChart,
  };
}

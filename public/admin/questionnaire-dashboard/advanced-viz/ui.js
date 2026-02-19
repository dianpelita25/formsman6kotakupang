export function createAdvancedVizUi({
  state,
  advancedVizTabButtons,
  advancedVizInsightsEl,
  advancedVizHelpEl,
} = {}) {
  function setAdvancedVizTabs(mode) {
    const normalizedMode = String(mode || '').trim();
    advancedVizTabButtons.forEach((button) => {
      const buttonMode = String(button.dataset.vizMode || '').trim();
      const isActive = buttonMode === normalizedMode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function renderAdvancedVizInsights(items = []) {
    if (!advancedVizInsightsEl) return;
    advancedVizInsightsEl.innerHTML = '';
    const normalizedItems = Array.isArray(items) ? items.filter((item) => item && item.title) : [];
    if (!normalizedItems.length) {
      const fallback = document.createElement('article');
      fallback.className = 'advanced-viz-insight-card';
      fallback.innerHTML = '<h4>Insight belum tersedia</h4><p>Tambah respons agar insight visual bisa dihitung otomatis.</p>';
      advancedVizInsightsEl.append(fallback);
      return;
    }

    normalizedItems.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'advanced-viz-insight-card';
      const tone = String(item.tone || '').trim();
      if (tone) card.classList.add(`is-${tone}`);

      const title = document.createElement('h4');
      title.textContent = item.title;
      const value = document.createElement('strong');
      value.textContent = item.value || '-';
      const note = document.createElement('p');
      note.textContent = item.note || '-';
      card.append(title, value, note);
      advancedVizInsightsEl.append(card);
    });
  }

  function renderEmptyAdvancedVizChart(canvas, message = 'Belum ada data untuk visual ini.') {
    state.charts.advancedViz = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Data'],
        datasets: [
          {
            label: 'Nilai',
            data: [0],
            borderRadius: 8,
            backgroundColor: 'rgba(88, 157, 255, 0.45)',
            borderColor: 'rgba(88, 157, 255, 0.95)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { enabled: false },
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, suggestedMax: 5 },
        },
      },
    });
    if (advancedVizHelpEl) advancedVizHelpEl.textContent = message;
    renderAdvancedVizInsights([]);
  }

  return {
    setAdvancedVizTabs,
    renderAdvancedVizInsights,
    renderEmptyAdvancedVizChart,
  };
}

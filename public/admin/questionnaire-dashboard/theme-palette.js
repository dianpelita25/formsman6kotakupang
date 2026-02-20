function readCssVariable(name, fallback) {
  const root = document.documentElement;
  const style = window.getComputedStyle(root);
  const value = String(style.getPropertyValue(name) || '').trim();
  return value || fallback;
}

export function getDashboardThemePalette() {
  return {
    emptyBackground: readCssVariable('--theme-chart-empty-bg', 'rgba(88, 157, 255, 0.45)'),
    emptyBorder: readCssVariable('--theme-chart-empty-border', 'rgba(88, 157, 255, 0.95)'),
    primaryBackground: readCssVariable('--theme-chart-primary-bg', 'rgba(47, 198, 229, 0.62)'),
    primaryBorder: readCssVariable('--theme-chart-primary-border', 'rgba(47, 198, 229, 1)'),
    secondaryBackground: readCssVariable('--theme-chart-secondary-bg', 'rgba(139, 140, 255, 0.18)'),
    secondaryBorder: readCssVariable('--theme-chart-secondary-border', '#8b8cff'),
    trendLine: readCssVariable('--theme-chart-line', '#33d9ff'),
    trendFill: readCssVariable('--theme-chart-line-fill', 'rgba(51, 217, 255, 0.2)'),
    pointBackground: readCssVariable('--theme-chart-point-bg', '#82f7ff'),
    pointBorder: readCssVariable('--theme-chart-point-border', '#082039'),
    gridColor: readCssVariable('--theme-chart-grid', 'rgba(130, 170, 255, 0.15)'),
    tickColor: readCssVariable('--theme-chart-tick', '#b9d4ff'),
    palette: [
      readCssVariable('--theme-chart-palette-1', '#3ba6ff'),
      readCssVariable('--theme-chart-palette-2', '#31d5ff'),
      readCssVariable('--theme-chart-palette-3', '#6f7dff'),
      readCssVariable('--theme-chart-palette-4', '#8f6dff'),
      readCssVariable('--theme-chart-palette-5', '#3ce6b4'),
      readCssVariable('--theme-chart-palette-6', '#ff7b9d'),
      readCssVariable('--theme-chart-palette-7', '#ffb347'),
    ],
    contrastLine: readCssVariable('--theme-chart-contrast-line', 'rgba(126, 155, 255, 1)'),
    contrastFill: readCssVariable('--theme-chart-contrast-fill', 'rgba(126, 155, 255, 0.58)'),
  };
}

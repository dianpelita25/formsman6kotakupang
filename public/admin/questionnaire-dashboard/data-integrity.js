function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveDashboardTotalsIntegrity(state = {}) {
  const summaryTotal = toNumber(state.summary?.totalResponses);
  const distributionTotal = toNumber(state.distribution?.totalResponses);
  const responsesTotal = toNumber(state.totalResponses);
  return {
    ok: summaryTotal === distributionTotal && distributionTotal === responsesTotal,
    summaryTotal,
    distributionTotal,
    responsesTotal,
  };
}

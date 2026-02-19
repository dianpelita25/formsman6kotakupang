export async function loadDashboardPayload({ apiBase, requestJson }) {
  const [summaryJson, distributionJson] = await Promise.all([
    requestJson(`${apiBase}/analytics/summary`),
    requestJson(`${apiBase}/analytics/distribution`),
  ]);
  return {
    summary: summaryJson.data,
    distribution: distributionJson.data,
  };
}

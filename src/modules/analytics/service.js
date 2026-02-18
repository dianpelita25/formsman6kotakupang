import { getDistribution, getSummary, getTrendAnalytics } from '../submissions/service.js';

export async function getAnalyticsSummary(env, schoolId) {
  return getSummary(env, schoolId);
}

export async function getAnalyticsDistribution(env, schoolId) {
  return getDistribution(env, schoolId);
}

export async function getAnalyticsTrend(env, schoolId, days) {
  return getTrendAnalytics(env, schoolId, days);
}

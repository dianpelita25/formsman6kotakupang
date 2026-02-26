import 'dotenv/config';
import { getRequiredEnv, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.DASHBOARD_PARITY_SMOKE_PORT || 8901);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_PARITY_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function failHard(message) {
  throw new Error(message);
}

function createAssertions() {
  const failures = [];

  function pass(label, detail = '') {
    console.log(`[PASS] ${label}${detail ? ` -> ${detail}` : ''}`);
  }

  function fail(label, detail = '') {
    const message = `${label}${detail ? ` -> ${detail}` : ''}`;
    failures.push(message);
    console.error(`[FAIL] ${message}`);
  }

  function expect(label, condition, detailOnFail = '') {
    if (condition) {
      pass(label);
      return true;
    }
    fail(label, detailOnFail);
    return false;
  }

  return {
    failures,
    pass,
    fail,
    expect,
  };
}

function parseSetCookie(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  const firstPart = value.split(';')[0]?.trim() || '';
  return firstPart;
}

function findSegmentCandidate(summaryData = null) {
  const dimensions = toArray(summaryData?.segmentSummary?.dimensions);
  for (const dimension of dimensions) {
    if (!dimension?.drilldownEligible) continue;
    const buckets = toArray(dimension?.buckets);
    const firstBucket = buckets.find((entry) => String(entry?.label || '').trim());
    if (!firstBucket) continue;
    return {
      dimensionId: String(dimension.id || '').trim(),
      bucketLabel: String(firstBucket.label || '').trim(),
    };
  }
  return null;
}

async function requestWithSession(baseUrl, session, method, path, { jsonBody } = {}) {
  const headers = new Headers();
  if (session.cookie) headers.set('cookie', session.cookie);
  let body = undefined;
  if (jsonBody !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(jsonBody);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
  });

  const setCookieHeader = response.headers.get('set-cookie');
  const cookieValue = parseSetCookie(setCookieHeader);
  if (cookieValue) {
    session.cookie = cookieValue;
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  return {
    response,
    text,
    payload,
  };
}

function buildSegmentPairQuery(path, query = {}) {
  const params = new URLSearchParams();
  if (query.segmentDimensionId) params.set('segmentDimensionId', query.segmentDimensionId);
  if (query.segmentBucket) params.set('segmentBucket', query.segmentBucket);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function run() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('SESSION_SECRET');
  const email = getRequiredEnv('SUPERADMIN_EMAIL');
  const password = getRequiredEnv('SUPERADMIN_PASSWORD');

  const assertions = createAssertions();
  const externalBaseUrl = buildBaseUrl();
  const isExternal = Boolean(externalBaseUrl);
  const localServer = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : localServer.baseUrl;
  const session = { cookie: '' };

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);

    const login = await requestWithSession(baseUrl, session, 'POST', '/forms/admin/api/login', {
      jsonBody: { email, password },
    });
    assertions.expect('POST /forms/admin/api/login status', login.response.status === 200, `status=${login.response.status}`);
    assertions.expect('Session cookie tersedia', Boolean(session.cookie), 'cookie login tidak ditemukan');

    const tenantsRes = await requestWithSession(baseUrl, session, 'GET', '/forms/api/tenants/public');
    assertions.expect(
      'GET /forms/api/tenants/public status',
      tenantsRes.response.status === 200,
      `status=${tenantsRes.response.status}`
    );
    const tenants = toArray(tenantsRes.payload?.data);
    assertions.expect('Public tenant tidak kosong', tenants.length > 0, 'data tenant kosong');

    let targetTenantSlug = '';
    let targetQuestionnaireSlug = '';
    for (const tenant of tenants) {
      const tenantSlug = String(tenant?.slug || '').trim();
      if (!tenantSlug) continue;
      const questionnairesRes = await requestWithSession(
        baseUrl,
        session,
        'GET',
        `/forms/${tenantSlug}/api/questionnaires/public`
      );
      if (!questionnairesRes.response.ok) continue;
      const questionnaires = toArray(questionnairesRes.payload?.data);
      const firstQuestionnaire = questionnaires.find((entry) => String(entry?.slug || '').trim());
      if (!firstQuestionnaire) continue;
      targetTenantSlug = tenantSlug;
      targetQuestionnaireSlug = String(firstQuestionnaire.slug || '').trim();
      break;
    }

    assertions.expect('Target tenant tersedia', Boolean(targetTenantSlug), 'tenant slug untuk parity tidak ditemukan');
    assertions.expect(
      'Target questionnaire tersedia',
      Boolean(targetQuestionnaireSlug),
      'questionnaire slug untuk parity tidak ditemukan'
    );
    if (!targetTenantSlug || !targetQuestionnaireSlug) {
      failHard('Tidak bisa melanjutkan parity smoke tanpa tenant/questionnaire target.');
    }

    const analyticsBasePath = `/forms/${targetTenantSlug}/admin/api/questionnaires/${targetQuestionnaireSlug}/analytics`;
    const responsesBasePath = `/forms/${targetTenantSlug}/admin/api/questionnaires/${targetQuestionnaireSlug}/responses`;
    const aiBasePath = `/forms/${targetTenantSlug}/admin/api/questionnaires/${targetQuestionnaireSlug}/ai`;

    const snapshotRes = await requestWithSession(baseUrl, session, 'GET', `${analyticsBasePath}/snapshot`);
    assertions.expect('GET analytics/snapshot status', snapshotRes.response.status === 200, `status=${snapshotRes.response.status}`);
    const snapshotData = snapshotRes.payload?.data || null;
    assertions.expect('snapshot.summary ada', Boolean(snapshotData?.summary), 'snapshot.summary hilang');
    assertions.expect('snapshot.distribution ada', Boolean(snapshotData?.distribution), 'snapshot.distribution hilang');
    assertions.expect('snapshot.trend ada', Boolean(snapshotData?.trend), 'snapshot.trend hilang');
    assertions.expect(
      'snapshot totals integrity field',
      typeof snapshotData?.totals?.integrityOk === 'boolean',
      `integrityOk=${String(snapshotData?.totals?.integrityOk)}`
    );

    const summaryRes = await requestWithSession(baseUrl, session, 'GET', `${analyticsBasePath}/summary`);
    assertions.expect('GET analytics/summary status', summaryRes.response.status === 200, `status=${summaryRes.response.status}`);
    const summaryData = summaryRes.payload?.data || null;
    const dataQuality = summaryData?.dataQuality || null;
    assertions.expect('summary.dataQuality ada', Boolean(dataQuality && typeof dataQuality === 'object'), 'dataQuality hilang');
    assertions.expect(
      'summary.dataQuality.sampleSize number',
      Number.isFinite(Number(dataQuality?.sampleSize)),
      `sampleSize=${String(dataQuality?.sampleSize)}`
    );
    assertions.expect(
      'summary.dataQuality.confidence valid',
      ['low', 'medium', 'high'].includes(String(dataQuality?.confidence || '')),
      `confidence=${String(dataQuality?.confidence || '-')}`
    );
    assertions.expect(
      'summary.dataQuality.warnings array',
      Array.isArray(dataQuality?.warnings),
      `warnings type=${typeof dataQuality?.warnings}`
    );

    const aiLatestRes = await requestWithSession(baseUrl, session, 'GET', `${aiBasePath}/latest?mode=internal`);
    assertions.expect('GET ai/latest status', aiLatestRes.response.status === 200, `status=${aiLatestRes.response.status}`);
    const aiLatestData = aiLatestRes.payload?.data || null;
    assertions.expect('ai/latest payload object', Boolean(aiLatestData && typeof aiLatestData === 'object'), 'payload data tidak valid');
    assertions.expect(
      'ai/latest grounding object',
      Boolean(aiLatestData?.grounding && typeof aiLatestData.grounding === 'object'),
      'grounding tidak tersedia'
    );
    assertions.expect(
      'ai/latest grounding available flag',
      typeof aiLatestData?.grounding?.available === 'boolean',
      `available type=${typeof aiLatestData?.grounding?.available}`
    );

    const segmentCompareMissingRes = await requestWithSession(baseUrl, session, 'GET', `${analyticsBasePath}/segment-compare`);
    assertions.expect(
      'GET analytics/segment-compare tidak 404',
      segmentCompareMissingRes.response.status !== 404,
      `status=${segmentCompareMissingRes.response.status}`
    );

    const schoolBenchmarkRes = await requestWithSession(baseUrl, session, 'GET', `${analyticsBasePath}/school-benchmark`);
    assertions.expect(
      'GET analytics/school-benchmark tidak 404',
      schoolBenchmarkRes.response.status !== 404,
      `status=${schoolBenchmarkRes.response.status}`
    );
    if (schoolBenchmarkRes.response.status === 200) {
      assertions.expect(
        'school-benchmark payload summary object',
        Boolean(schoolBenchmarkRes.payload?.data?.summary && typeof schoolBenchmarkRes.payload.data.summary === 'object'),
        'summary benchmark tidak tersedia'
      );
      assertions.expect(
        'school-benchmark payload schools array',
        Array.isArray(schoolBenchmarkRes.payload?.data?.schools),
        'array schools benchmark tidak tersedia'
      );
    }

    const pairValidationTargets = [
      `${analyticsBasePath}/snapshot`,
      `${analyticsBasePath}/summary`,
      `${analyticsBasePath}/distribution`,
      `${analyticsBasePath}/trend`,
      responsesBasePath,
      `${responsesBasePath}/export.csv`,
    ];

    for (const targetPath of pairValidationTargets) {
      const dimOnlyRes = await requestWithSession(
        baseUrl,
        session,
        'GET',
        buildSegmentPairQuery(targetPath, { segmentDimensionId: 'question:q1' })
      );
      assertions.expect(
        `${targetPath} reject dimension-only`,
        dimOnlyRes.response.status === 400,
        `status=${dimOnlyRes.response.status}`
      );

      const bucketOnlyRes = await requestWithSession(
        baseUrl,
        session,
        'GET',
        buildSegmentPairQuery(targetPath, { segmentBucket: 'ya' })
      );
      assertions.expect(
        `${targetPath} reject bucket-only`,
        bucketOnlyRes.response.status === 400,
        `status=${bucketOnlyRes.response.status}`
      );
    }

    const segmentCandidate = findSegmentCandidate(summaryData);
    if (!segmentCandidate) {
      assertions.pass('segment candidate optional', 'tidak ada dimensi drilldown yang valid untuk tenant ini');
    } else {
      const validParams = new URLSearchParams();
      validParams.set('segmentDimensionId', segmentCandidate.dimensionId);
      validParams.set('segmentBucket', segmentCandidate.bucketLabel);

      const responsesFiltered = await requestWithSession(baseUrl, session, 'GET', `${responsesBasePath}?${validParams.toString()}`);
      assertions.expect(
        'GET responses dengan segment filter status',
        responsesFiltered.response.status === 200,
        `status=${responsesFiltered.response.status}`
      );

      const segmentCompareParams = new URLSearchParams();
      segmentCompareParams.set('segmentDimensionId', segmentCandidate.dimensionId);
      segmentCompareParams.set('segmentBuckets', segmentCandidate.bucketLabel);

      const compareRes = await requestWithSession(
        baseUrl,
        session,
        'GET',
        `${analyticsBasePath}/segment-compare?${segmentCompareParams.toString()}`
      );
      assertions.expect(
        'GET analytics/segment-compare valid status',
        compareRes.response.status === 200,
        `status=${compareRes.response.status}`
      );
      assertions.expect(
        'segment-compare buckets array',
        Array.isArray(compareRes.payload?.data?.buckets),
        'payload buckets tidak valid'
      );
      const firstBucket = Array.isArray(compareRes.payload?.data?.buckets) ? compareRes.payload.data.buckets[0] : null;
      assertions.expect(
        'segment-compare bucket dataQuality object',
        Boolean(firstBucket?.dataQuality && typeof firstBucket.dataQuality === 'object'),
        'dataQuality bucket compare tidak tersedia'
      );
    }

    const logout = await requestWithSession(baseUrl, session, 'POST', '/forms/admin/api/logout');
    assertions.expect('POST /forms/admin/api/logout status', logout.response.status === 200, `status=${logout.response.status}`);

    if (assertions.failures.length) {
      failHard(`Parity smoke gagal (${assertions.failures.length} failure).`);
    }

    console.log('[PASS] smoke-dashboard-parity selesai tanpa pelanggaran kontrak.');
  } finally {
    if (localServer) {
      await localServer.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-dashboard-parity');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

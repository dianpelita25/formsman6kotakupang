import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import app from '../src/worker.js';
import { SESSION_COOKIE_NAME } from '../src/lib/http/session-cookie.js';

const WITH_WRITES = process.argv.includes('--with-writes');
const PROJECT_ROOT = process.cwd();

function failHard(message) {
  throw new Error(message);
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    failHard(`${name} belum di-set di .env`);
  }
  return value;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

async function readPublicAsset(pathname) {
  let normalizedPath = String(pathname || '/');
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '');
  let filePath = path.join(PROJECT_ROOT, 'public', relativePath);

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    return null;
  }

  try {
    const content = await fs.readFile(filePath);
    return {
      content,
      contentType: contentTypeFor(filePath),
    };
  } catch {
    return null;
  }
}

const env = {
  ...process.env,
  ASSETS: {
    async fetch(requestLike) {
      const request = requestLike instanceof Request ? requestLike : new Request(String(requestLike));
      const url = new URL(request.url);
      const asset = await readPublicAsset(url.pathname);
      if (!asset) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(asset.content, {
        status: 200,
        headers: {
          'content-type': asset.contentType,
        },
      });
    },
  },
};

const failures = [];
let cookieHeader = '';

function logPass(label, detail = '') {
  console.log(`[PASS] ${label}${detail ? ` -> ${detail}` : ''}`);
}

function logFail(label, detail) {
  const message = `${label}: ${detail}`;
  failures.push(message);
  console.error(`[FAIL] ${message}`);
}

function expect(label, condition, detailOnFail) {
  if (!condition) {
    logFail(label, detailOnFail);
    return false;
  }
  logPass(label);
  return true;
}

function updateCookieFromSetCookie(setCookieHeader = '') {
  if (!setCookieHeader) return;
  const firstSegment = setCookieHeader.split(';')[0]?.trim();
  if (!firstSegment) return;
  const expectedPrefix = `${SESSION_COOKIE_NAME}=`;
  if (!firstSegment.toLowerCase().startsWith(expectedPrefix.toLowerCase())) return;
  const value = firstSegment.slice(expectedPrefix.length);
  cookieHeader = value ? firstSegment : '';
}

async function send(method, endpoint, { body, useCookie = true } = {}) {
  const headers = new Headers();
  if (useCookie && cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  let payloadBody;
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
    payloadBody = JSON.stringify(body);
  }

  const response = await app.request(`http://localhost${endpoint}`, { method, headers, body: payloadBody }, env);
  updateCookieFromSetCookie(response.headers.get('set-cookie'));

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // no-op
  }

  return { response, text, json };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function run() {
  const superadminEmail = getRequiredEnv('SUPERADMIN_EMAIL');
  const superadminPassword = getRequiredEnv('SUPERADMIN_PASSWORD');
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('SESSION_SECRET');

  const health = await send('GET', '/health', { useCookie: false });
  expect('GET /health status', health.response.status === 200, `status ${health.response.status}`);
  expect('GET /health payload', health.json?.ok === true, 'payload.ok != true');

  const healthDb = await send('GET', '/health/db', { useCookie: false });
  expect('GET /health/db status', healthDb.response.status === 200, `status ${healthDb.response.status}`);

  const portal = await send('GET', '/forms', { useCookie: false });
  expect('GET /forms status', portal.response.status === 200, `status ${portal.response.status}`);
  expect('GET /forms html marker', portal.text.includes('Portal Navigasi Form & Admin'), 'marker text tidak ditemukan');

  const loginPage = await send('GET', '/forms/admin/login', { useCookie: false });
  expect('GET /forms/admin/login status', loginPage.response.status === 200, `status ${loginPage.response.status}`);

  const publicSchoolsRes = await send('GET', '/forms/api/schools/public', { useCookie: false });
  expect(
    'GET /forms/api/schools/public status',
    publicSchoolsRes.response.status === 200,
    `status ${publicSchoolsRes.response.status}`
  );

  const publicSchools = asArray(publicSchoolsRes.json?.data);
  expect('Public schools not empty', publicSchools.length > 0, 'daftar sekolah publik kosong');
  const publicFieldsSafe = publicSchools.every((school) =>
    Object.keys(school || {}).every((key) => ['id', 'slug', 'name'].includes(key))
  );
  expect('Public schools fields safe', publicFieldsSafe, 'ada field sensitif di response sekolah publik');

  const schoolSlug = publicSchools[0]?.slug;
  expect('School slug resolved', Boolean(schoolSlug), 'slug sekolah tidak ditemukan');
  if (!schoolSlug) {
    throw new Error('Tidak ada school slug untuk pengujian lanjutan.');
  }

  const publicTenantsRes = await send('GET', '/forms/api/tenants/public', { useCookie: false });
  expect(
    'GET /forms/api/tenants/public status',
    publicTenantsRes.response.status === 200,
    `status ${publicTenantsRes.response.status}`
  );
  const publicTenants = asArray(publicTenantsRes.json?.data);
  expect('Public tenants not empty', publicTenants.length > 0, 'daftar tenant publik kosong');
  const tenantSlug = publicTenants[0]?.slug || schoolSlug;
  expect('Tenant slug resolved', Boolean(tenantSlug), 'slug tenant tidak ditemukan');

  const legacyRedirect = await send('GET', '/formsman6kotakupang/test', { useCookie: false });
  expect('Legacy redirect status', legacyRedirect.response.status === 301, `status ${legacyRedirect.response.status}`);
  expect(
    'Legacy redirect location',
    legacyRedirect.response.headers.get('location') === '/forms/sman6-kotakupang/test',
    `location ${legacyRedirect.response.headers.get('location')}`
  );

  const publicForm = await send('GET', `/forms/${schoolSlug}/`, { useCookie: false });
  expect('GET public form status', publicForm.response.status === 200, `status ${publicForm.response.status}`);

  const schemaRes = await send('GET', `/forms/${schoolSlug}/api/form-schema`, { useCookie: false });
  expect('GET form schema status', schemaRes.response.status === 200, `status ${schemaRes.response.status}`);
  expect('Schema has minimum fields', asArray(schemaRes.json?.fields).length >= 12, 'jumlah field schema < 12');

  const publicQuestionnairesRes = await send('GET', `/forms/${tenantSlug}/api/questionnaires/public`, { useCookie: false });
  expect(
    'GET /forms/:tenantSlug/api/questionnaires/public status',
    publicQuestionnairesRes.response.status === 200,
    `status ${publicQuestionnairesRes.response.status}`
  );
  const publicQuestionnaires = asArray(publicQuestionnairesRes.json?.data);
  expect('Public questionnaires not empty', publicQuestionnaires.length > 0, 'daftar questionnaire publik kosong');
  const questionnaireSlug = publicQuestionnaires[0]?.slug;
  expect('Questionnaire slug resolved', Boolean(questionnaireSlug), 'slug questionnaire tidak ditemukan');

  if (questionnaireSlug) {
    const publicQuestionnairePage = await send('GET', `/forms/${tenantSlug}/${questionnaireSlug}/`, { useCookie: false });
    expect(
      'GET questionnaire public page status',
      publicQuestionnairePage.response.status === 200,
      `status ${publicQuestionnairePage.response.status}`
    );

    const questionnaireSchemaRes = await send('GET', `/forms/${tenantSlug}/${questionnaireSlug}/api/schema`, {
      useCookie: false,
    });
    expect(
      'GET questionnaire schema status',
      questionnaireSchemaRes.response.status === 200,
      `status ${questionnaireSchemaRes.response.status}`
    );
  }

  const noAuthSchoolPanel = await send('GET', `/forms/${schoolSlug}/admin/`, { useCookie: false });
  expect(
    'School panel requires auth',
    noAuthSchoolPanel.response.status === 302,
    `status ${noAuthSchoolPanel.response.status}`
  );

  const loginRes = await send('POST', '/forms/admin/api/login', {
    useCookie: false,
    body: { email: superadminEmail, password: superadminPassword },
  });
  expect('POST /forms/admin/api/login status', loginRes.response.status === 200, `status ${loginRes.response.status}`);
  expect('Session cookie set', Boolean(cookieHeader), 'cookie session tidak keluar');

  const meRes = await send('GET', '/forms/admin/api/me');
  expect('GET /forms/admin/api/me status', meRes.response.status === 200, `status ${meRes.response.status}`);
  expect('User is superadmin', meRes.json?.user?.isSuperadmin === true, 'isSuperadmin != true');

  const schoolsAdminRes = await send('GET', '/forms/admin/api/schools');
  expect(
    'GET /forms/admin/api/schools status',
    schoolsAdminRes.response.status === 200,
    `status ${schoolsAdminRes.response.status}`
  );

  const adminSchools = asArray(schoolsAdminRes.json?.data);
  expect('Admin schools available', adminSchools.length > 0, 'daftar sekolah admin kosong');

  const tenantsAdminRes = await send('GET', '/forms/admin/api/tenants');
  expect(
    'GET /forms/admin/api/tenants status',
    tenantsAdminRes.response.status === 200,
    `status ${tenantsAdminRes.response.status}`
  );
  const adminTenants = asArray(tenantsAdminRes.json?.data);
  expect('Admin tenants available', adminTenants.length > 0, 'daftar tenant admin kosong');

  const superadminPage = await send('GET', '/forms/admin/');
  expect('GET /forms/admin/ status', superadminPage.response.status === 200, `status ${superadminPage.response.status}`);

  const selectSchoolPage = await send('GET', '/forms/admin/select-school');
  expect(
    'GET /forms/admin/select-school status',
    selectSchoolPage.response.status === 200,
    `status ${selectSchoolPage.response.status}`
  );

  const schoolPanel = await send('GET', `/forms/${schoolSlug}/admin/`);
  expect('GET school admin panel status', schoolPanel.response.status === 200, `status ${schoolPanel.response.status}`);

  const dashboardPage = await send('GET', `/forms/${schoolSlug}/admin/dashboard/`);
  const legacyDashboardStatusOk = [200, 302].includes(dashboardPage.response.status);
  expect('GET school dashboard status', legacyDashboardStatusOk, `status ${dashboardPage.response.status}`);
  if (dashboardPage.response.status === 302) {
    const location = String(dashboardPage.response.headers.get('location') || '');
    expect(
      'Legacy school dashboard redirect target',
      location.includes(`/forms/${schoolSlug}/admin/questionnaires/`) && location.endsWith('/dashboard/'),
      `location ${location}`
    );
  }

  if (questionnaireSlug) {
    const tenantPanel = await send('GET', `/forms/${tenantSlug}/admin/`);
    expect('GET tenant admin panel status', tenantPanel.response.status === 200, `status ${tenantPanel.response.status}`);

    const builderPage = await send('GET', `/forms/${tenantSlug}/admin/questionnaires/${questionnaireSlug}/builder/`);
    expect(
      'GET questionnaire builder page status',
      builderPage.response.status === 200,
      `status ${builderPage.response.status}`
    );

    const genericDashboardPage = await send(
      'GET',
      `/forms/${tenantSlug}/admin/questionnaires/${questionnaireSlug}/dashboard/`
    );
    const genericDashboardStatusOk = [200, 302].includes(genericDashboardPage.response.status);
    expect(
      'GET questionnaire dashboard page status',
      genericDashboardStatusOk,
      `status ${genericDashboardPage.response.status}`
    );
    if (genericDashboardPage.response.status === 302) {
      const location = String(genericDashboardPage.response.headers.get('location') || '');
      expect(
        'Questionnaire dashboard redirect target',
        location.endsWith(`/forms/${tenantSlug}/admin/dashboard/`),
        `location ${location}`
      );
    }

    const genericSummaryRes = await send(
      'GET',
      `/forms/${tenantSlug}/admin/api/questionnaires/${questionnaireSlug}/analytics/summary`
    );
    expect(
      'GET questionnaire analytics summary status',
      genericSummaryRes.response.status === 200,
      `status ${genericSummaryRes.response.status}`
    );
    expect(
      'Summary has totalResponses',
      typeof genericSummaryRes.json?.data?.totalResponses === 'number',
      'totalResponses bukan number'
    );

    const genericDistributionRes = await send(
      'GET',
      `/forms/${tenantSlug}/admin/api/questionnaires/${questionnaireSlug}/analytics/distribution`
    );
    expect(
      'GET questionnaire analytics distribution status',
      genericDistributionRes.response.status === 200,
      `status ${genericDistributionRes.response.status}`
    );
    expect(
      'Distribution has questions array',
      Array.isArray(genericDistributionRes.json?.data?.questions),
      'questions bukan array'
    );

    const genericTrendRes = await send(
      'GET',
      `/forms/${tenantSlug}/admin/api/questionnaires/${questionnaireSlug}/analytics/trend?days=30`
    );
    expect(
      'GET questionnaire analytics trend status',
      genericTrendRes.response.status === 200,
      `status ${genericTrendRes.response.status}`
    );
    expect('Trend has points array', Array.isArray(genericTrendRes.json?.data?.points), 'points bukan array');

    const genericResponsesRes = await send(
      'GET',
      `/forms/${tenantSlug}/admin/api/questionnaires/${questionnaireSlug}/responses?page=1&pageSize=20`
    );
    expect(
      'GET questionnaire responses status',
      genericResponsesRes.response.status === 200,
      `status ${genericResponsesRes.response.status}`
    );
    expect(
      'Responses payload has pagination',
      typeof genericResponsesRes.json?.data?.total === 'number' && Array.isArray(genericResponsesRes.json?.data?.items),
      'payload responses tidak valid'
    );

    const genericAiLatestRes = await send(
      'GET',
      `/forms/${tenantSlug}/admin/api/questionnaires/${questionnaireSlug}/ai/latest?mode=internal`
    );
    expect(
      'GET questionnaire ai latest status',
      genericAiLatestRes.response.status === 200,
      `status ${genericAiLatestRes.response.status}`
    );
  }

  const aiPromptBundleRes = await send('GET', '/forms/admin/api/ai-prompts?mode=internal');
  expect(
    'GET ai-prompts bundle status',
    aiPromptBundleRes.response.status === 200,
    `status ${aiPromptBundleRes.response.status}`
  );

  const promptTemplate =
    aiPromptBundleRes.json?.data?.globalDraft?.template ||
    aiPromptBundleRes.json?.data?.globalPublished?.template ||
    aiPromptBundleRes.json?.data?.effective?.template;
  expect('Prompt template exists', Boolean(String(promptTemplate || '').trim()), 'template prompt kosong');

  const aiPromptHistoryRes = await send('GET', '/forms/admin/api/ai-prompts/history?mode=internal&scope=global');
  expect(
    'GET ai-prompts history status',
    aiPromptHistoryRes.response.status === 200,
    `status ${aiPromptHistoryRes.response.status}`
  );

  if (WITH_WRITES) {
    const tenantQuestionnairesRes = await send('GET', `/forms/${tenantSlug}/admin/api/questionnaires`);
    expect(
      'GET /forms/:tenantSlug/admin/api/questionnaires status',
      tenantQuestionnairesRes.response.status === 200,
      `status ${tenantQuestionnairesRes.response.status}`
    );

    const saveDraftRes = await send('PUT', '/forms/admin/api/ai-prompts/draft', {
      body: {
        mode: 'internal',
        scope: 'global',
        template: promptTemplate,
        changeNote: 'smoke-e2e write test',
      },
    });
    expect(
      'PUT ai-prompts draft status',
      saveDraftRes.response.status === 200,
      `status ${saveDraftRes.response.status}`
    );

    const publishRes = await send('POST', '/forms/admin/api/ai-prompts/publish', {
      body: {
        mode: 'internal',
        scope: 'global',
        changeNote: 'smoke-e2e write test',
      },
    });
    expect(
      'POST ai-prompts publish status',
      publishRes.response.status === 200,
      `status ${publishRes.response.status}`
    );

    if (questionnaireSlug) {
      const questionnairePromptDraftRes = await send('PUT', `/forms/${tenantSlug}/admin/api/ai-prompts/draft`, {
        body: {
          mode: 'internal',
          scope: 'questionnaire',
          questionnaireId: publicQuestionnaires[0].id,
          template: promptTemplate,
          changeNote: 'smoke-e2e questionnaire scope',
        },
      });
      expect(
        'PUT tenant questionnaire ai-prompts draft status',
        questionnairePromptDraftRes.response.status === 200,
        `status ${questionnairePromptDraftRes.response.status}`
      );
    }
  } else {
    logPass('Write checks skipped', 'jalankan dengan --with-writes untuk uji save/publish prompt');
  }

  const logoutRes = await send('POST', '/forms/admin/api/logout');
  expect('POST /forms/admin/api/logout status', logoutRes.response.status === 200, `status ${logoutRes.response.status}`);

  const meAfterLogout = await send('GET', '/forms/admin/api/me', { useCookie: false });
  expect(
    'GET /forms/admin/api/me after logout',
    meAfterLogout.response.status === 401,
    `status ${meAfterLogout.response.status}`
  );

  if (failures.length) {
    console.error('\nSmoke E2E gagal:');
    failures.forEach((item, index) => {
      console.error(`${index + 1}. ${item}`);
    });
    process.exit(1);
  }

  console.log(`\nSmoke E2E lulus (${WITH_WRITES ? 'with writes' : 'read-only'}).`);
}

run().catch((error) => {
  console.error('[FATAL]', error?.message || error);
  process.exit(1);
});

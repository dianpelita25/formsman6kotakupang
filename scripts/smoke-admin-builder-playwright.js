import 'dotenv/config';
import { launchBrowser, getRequiredEnv, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const PORT = Number(process.env.BUILDER_SMOKE_PORT || 8898);

async function resolveBuilderTarget(baseUrl) {
  const tenantsRes = await fetch(`${baseUrl}/forms/api/tenants/public`);
  if (!tenantsRes.ok) throw new Error(`Gagal ambil tenant publik: ${tenantsRes.status}`);
  const tenantsPayload = await tenantsRes.json().catch(() => ({}));
  const tenants = Array.isArray(tenantsPayload?.data) ? tenantsPayload.data : [];
  if (!tenants.length) throw new Error('Tenant publik kosong.');

  for (const tenant of tenants) {
    const tenantSlug = String(tenant?.slug || '').trim();
    if (!tenantSlug) continue;
    const questionnairesRes = await fetch(`${baseUrl}/forms/${tenantSlug}/api/questionnaires/public`);
    if (!questionnairesRes.ok) continue;
    const questionnairesPayload = await questionnairesRes.json().catch(() => ({}));
    const questionnaires = Array.isArray(questionnairesPayload?.data) ? questionnairesPayload.data : [];
    const questionnaire = questionnaires.find((item) => String(item?.slug || '').trim());
    if (questionnaire) {
      return {
        tenantSlug,
        questionnaireSlug: String(questionnaire.slug).trim(),
      };
    }
  }

  throw new Error('Tidak ada tenant dengan questionnaire publik.');
}

async function run() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('SESSION_SECRET');
  const email = getRequiredEnv('SUPERADMIN_EMAIL');
  const password = getRequiredEnv('SUPERADMIN_PASSWORD');

  const local = await startLocalServer(PORT);
  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginAsSuperadmin(page, { baseUrl: local.baseUrl, email, password });
    const target = await resolveBuilderTarget(local.baseUrl);
    const builderUrl = `${local.baseUrl}/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`;

    await page.goto(builderUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#save-draft-btn', { timeout: 30000, state: 'attached' });
    await page.waitForSelector('#question-list', { timeout: 30000, state: 'attached' });
    await page.waitForFunction(
      () => {
        const status = document.querySelector('#status');
        return Boolean(status && /builder siap dipakai/i.test(status.textContent || ''));
      },
      { timeout: 30000 }
    );
    await page.locator('[data-step-target=\"pertanyaan\"]').first().click({ force: true });

    console.log('[PASS] questionnaire builder loaded');
    console.log('[PASS] builder interaction basic check');
  } finally {
    await context.close();
    await browser.close();
    await local.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-admin-builder');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

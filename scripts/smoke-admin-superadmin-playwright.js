import 'dotenv/config';
import { launchBrowser, getRequiredEnv, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const PORT = Number(process.env.ADMIN_SMOKE_PORT || 8897);

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
    await page.waitForSelector('#tenants-body', { timeout: 30000 });
    await page.waitForSelector('#prompt-manager-panel', { timeout: 30000 });
    await page.waitForFunction(
      () => {
        const status = document.querySelector('#status');
        return Boolean(status && /panel (superadmin|admin utama) siap dipakai/i.test(status.textContent || ''));
      },
      { timeout: 30000 }
    );

    const refreshBtn = page.locator('#prompt-refresh-btn');
    if (await refreshBtn.count()) {
      await refreshBtn.click();
    }

    await page.waitForSelector('#prompt-effective', { timeout: 30000 });

    console.log('[PASS] superadmin page loaded');
    console.log('[PASS] tenants table + prompt manager ready');
  } finally {
    await context.close();
    await browser.close();
    await local.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-admin-superadmin');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

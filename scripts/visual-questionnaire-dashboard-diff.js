import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import app from '../src/worker.js';

const PROJECT_ROOT = process.cwd();
const PORT = Number(process.env.VISUAL_DIFF_QUESTIONNAIRE_PORT || 8901);
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'artifacts', 'visual-questionnaire-dashboard');

function fail(message) {
  throw new Error(message);
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    fail(`${name} belum di-set di .env`);
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

function createEnv() {
  return {
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
}

async function readRequestBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      if (!chunks.length) {
        resolve(undefined);
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function startLocalServer() {
  const env = createEnv();
  const server = createServer(async (req, res) => {
    try {
      const method = String(req.method || 'GET').toUpperCase();
      const url = `${BASE_URL}${req.url || '/'}`;
      const headers = new Headers();
      Object.entries(req.headers || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          headers.set(key, value.join(', '));
          return;
        }
        if (typeof value === 'string') {
          headers.set(key, value);
        }
      });

      const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);
      const response = await app.request(url, { method, headers, body }, env);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'transfer-encoding') return;
        res.setHeader(key, value);
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      res.end(buffer);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          message: error?.message || 'Internal bridge error',
        })
      );
    }
  });

  server.listen(PORT);
  await once(server, 'listening');
  return server;
}

function getBaselineAssetFromHead(filePath) {
  try {
    return execFileSync('git', ['show', `HEAD:${filePath}`], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    fail(`Gagal ambil baseline dari git HEAD (${filePath}): ${error?.message || error}`);
  }
}

async function launchBrowser() {
  const attempts = [];
  if (process.env.PW_CHANNEL) {
    attempts.push({ channel: process.env.PW_CHANNEL, headless: true });
  }
  attempts.push({ channel: 'msedge', headless: true });
  attempts.push({ channel: 'chrome', headless: true });
  attempts.push({ headless: true });

  let lastError;
  for (const option of attempts) {
    try {
      return await chromium.launch(option);
    } catch (error) {
      lastError = error;
    }
  }

  fail(`Gagal launch browser Playwright: ${lastError?.message || 'unknown error'}`);
}

async function loginAsSuperadmin(page, email, password) {
  await page.goto(`${BASE_URL}/forms/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox', { name: /^(Masuk Sebagai|Login Sebagai)$/i }).selectOption('superadmin');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  const submitButton = page.getByRole('button', { name: /^(Masuk|Login)$/i }).first();
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/forms/admin/'),
    submitButton.click(),
  ]);
}

async function resolveQuestionnaireDashboardTarget() {
  const tenantsRes = await fetch(`${BASE_URL}/forms/api/tenants/public`);
  if (!tenantsRes.ok) {
    fail(`Gagal ambil tenant publik: ${tenantsRes.status}`);
  }
  const tenantsPayload = await tenantsRes.json().catch(() => ({}));
  const tenants = Array.isArray(tenantsPayload?.data) ? tenantsPayload.data : [];
  if (!tenants.length) {
    fail('Tenant publik kosong.');
  }

  for (const tenant of tenants) {
    const tenantSlug = String(tenant?.slug || '').trim();
    if (!tenantSlug) continue;
    const questionnairesRes = await fetch(`${BASE_URL}/forms/${tenantSlug}/api/questionnaires/public`);
    if (!questionnairesRes.ok) continue;
    const questionnairesPayload = await questionnairesRes.json().catch(() => ({}));
    const questionnaires = Array.isArray(questionnairesPayload?.data) ? questionnairesPayload.data : [];
    const questionnaire = questionnaires.find((item) => String(item?.slug || '').trim());
    if (!questionnaire) continue;
    return {
      tenantSlug,
      questionnaireSlug: String(questionnaire.slug).trim(),
    };
  }

  fail('Tidak ada tenant dengan questionnaire publik untuk visual diff.');
}

function normalizePngSize(image, width, height) {
  if (image.width === width && image.height === height) return image;
  const output = new PNG({ width, height });
  PNG.bitblt(image, output, 0, 0, image.width, image.height, 0, 0);
  return output;
}

async function compareScreenshots(oldPath, newPath) {
  const oldImage = PNG.sync.read(await fs.readFile(oldPath));
  const newImage = PNG.sync.read(await fs.readFile(newPath));
  const width = Math.max(oldImage.width, newImage.width);
  const height = Math.max(oldImage.height, newImage.height);

  const normalizedOld = normalizePngSize(oldImage, width, height);
  const normalizedNew = normalizePngSize(newImage, width, height);
  const diffImage = new PNG({ width, height });

  const mismatchPixels = pixelmatch(
    normalizedOld.data,
    normalizedNew.data,
    diffImage.data,
    width,
    height,
    {
      threshold: 0.12,
      includeAA: true,
    }
  );

  const diffRatio = mismatchPixels / (width * height);
  return {
    width,
    height,
    mismatchPixels,
    diffRatio,
    diffImage,
    normalizedOld,
    normalizedNew,
  };
}

async function saveComparisonArtifacts({ normalizedOld, normalizedNew, diffImage, diffPath, sideBySidePath }) {
  await fs.writeFile(diffPath, PNG.sync.write(diffImage));

  const combined = new PNG({ width: normalizedOld.width * 3, height: normalizedOld.height });
  PNG.bitblt(normalizedOld, combined, 0, 0, normalizedOld.width, normalizedOld.height, 0, 0);
  PNG.bitblt(
    normalizedNew,
    combined,
    0,
    0,
    normalizedNew.width,
    normalizedNew.height,
    normalizedOld.width,
    0
  );
  PNG.bitblt(
    diffImage,
    combined,
    0,
    0,
    diffImage.width,
    diffImage.height,
    normalizedOld.width * 2,
    0
  );

  await fs.writeFile(sideBySidePath, PNG.sync.write(combined));
}

async function normalizeVisualNoise(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      html { scroll-behavior: auto !important; }
    `,
  });

  await page.evaluate(() => {
    if (String(document.documentElement.dataset.themeScope || '').trim() === 'modern') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const volatileIds = [
      'status',
      'dashboard-inline-status',
      'error-debug',
      'responses-page-info',
      'ai-progress-elapsed',
      'ai-output',
    ];
    volatileIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = '';
    });
  });
}

async function waitForDashboardStable(page) {
  await page.locator('#dashboard-title').waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

async function captureDashboardScreenshot({
  browser,
  email,
  password,
  dashboardUrl,
  baselineHtml = null,
  baselineJs = null,
  outputPath,
}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 3400 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('aiti_theme_preference_v1', 'dark');
    } catch {
      // ignore storage constraints in visual diff
    }
  });

  if (baselineHtml && baselineJs) {
    await context.route('**/forms/*/admin/questionnaires/*/dashboard/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: baselineHtml,
      });
    });

    await context.route('**/forms-static/admin/questionnaire-dashboard.js*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: baselineJs,
      });
    });
  }

  const page = await context.newPage();

  try {
    await loginAsSuperadmin(page, email, password);
    await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
    await waitForDashboardStable(page);
    await normalizeVisualNoise(page);
    await page.waitForTimeout(250);
    await page.locator('body').screenshot({ path: outputPath });
  } finally {
    await context.close();
  }
}

async function run() {
  const superadminEmail = getRequiredEnv('SUPERADMIN_EMAIL');
  const superadminPassword = getRequiredEnv('SUPERADMIN_PASSWORD');
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('SESSION_SECRET');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const baselineHtml = getBaselineAssetFromHead('public/admin/questionnaire-dashboard.html');
  const baselineJs = getBaselineAssetFromHead('public/admin/questionnaire-dashboard.js');

  const server = await startLocalServer();
  const browser = await launchBrowser();

  try {
    const target = await resolveQuestionnaireDashboardTarget();
    const dashboardUrl = `${BASE_URL}/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`;

    const baselinePngPath = path.join(OUTPUT_DIR, 'baseline-old-head.png');
    const currentPngPath = path.join(OUTPUT_DIR, 'current-working-tree.png');
    const diffPngPath = path.join(OUTPUT_DIR, 'diff.png');
    const sideBySidePngPath = path.join(OUTPUT_DIR, 'side-by-side.png');
    const reportPath = path.join(OUTPUT_DIR, 'report.json');

    await captureDashboardScreenshot({
      browser,
      email: superadminEmail,
      password: superadminPassword,
      dashboardUrl,
      baselineHtml,
      baselineJs,
      outputPath: baselinePngPath,
    });

    await captureDashboardScreenshot({
      browser,
      email: superadminEmail,
      password: superadminPassword,
      dashboardUrl,
      outputPath: currentPngPath,
    });

    const comparison = await compareScreenshots(baselinePngPath, currentPngPath);
    await saveComparisonArtifacts({
      normalizedOld: comparison.normalizedOld,
      normalizedNew: comparison.normalizedNew,
      diffImage: comparison.diffImage,
      diffPath: diffPngPath,
      sideBySidePath: sideBySidePngPath,
    });

    const maxAllowedRatio = Number(process.env.VISUAL_DIFF_QUESTIONNAIRE_MAX_RATIO || 0.04);
    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      tenantSlug: target.tenantSlug,
      questionnaireSlug: target.questionnaireSlug,
      baselineSource: 'git:HEAD public/admin/questionnaire-dashboard.(html|js)',
      maxAllowedRatio,
      width: comparison.width,
      height: comparison.height,
      mismatchPixels: comparison.mismatchPixels,
      diffRatio: comparison.diffRatio,
      passed: comparison.diffRatio <= maxAllowedRatio,
      artifacts: {
        baseline: baselinePngPath,
        current: currentPngPath,
        diff: diffPngPath,
        sideBySide: sideBySidePngPath,
      },
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`[INFO] target: ${target.tenantSlug}/${target.questionnaireSlug}`);
    console.log(`[INFO] mismatch pixels: ${comparison.mismatchPixels}`);
    console.log(`[INFO] diff ratio: ${comparison.diffRatio.toFixed(6)}`);
    console.log(`[INFO] max allowed ratio: ${maxAllowedRatio}`);
    console.log(`[INFO] report: ${reportPath}`);

    if (!report.passed) {
      fail(
        `Visual diff questionnaire dashboard melebihi ambang batas. ratio=${comparison.diffRatio.toFixed(
          6
        )}, max=${maxAllowedRatio}. Cek ${reportPath}`
      );
    }

    console.log('[PASS] Visual diff questionnaire dashboard within threshold.');
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(`[FAIL] ${error?.message || error}`);
  process.exit(1);
});

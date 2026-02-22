import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import app from '../src/worker.js';

const PROJECT_ROOT = process.cwd();
const PORT = Number(process.env.PDF_SMOKE_PORT || 8899);
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'artifacts', 'dashboard-pdf');

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

async function resolveDashboardTarget() {
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
    if (questionnaire) {
      return {
        tenantSlug,
        questionnaireSlug: String(questionnaire.slug).trim(),
      };
    }
  }

  fail('Tidak ada tenant yang punya questionnaire publik.');
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

function sanitizeFilename(name) {
  return String(name || 'download.pdf').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
}

async function waitUntilDownloadReady(page, timeoutMs = 180000) {
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const runButton = buttons.find((btn) => (btn.textContent || '').includes('Jalankan Analisis'));
    const downloadButton = buttons.find((btn) => (btn.textContent || '').includes('Unduh PDF Analisis'));
    return Boolean(runButton && !runButton.disabled && downloadButton && !downloadButton.disabled);
  }, { timeout: timeoutMs });
}

async function run() {
  const superadminEmail = getRequiredEnv('SUPERADMIN_EMAIL');
  const superadminPassword = getRequiredEnv('SUPERADMIN_PASSWORD');
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('SESSION_SECRET');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const server = await startLocalServer();
  const browser = await launchBrowser();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const modeMatrix = [
    { key: 'internal' },
    { key: 'external_pemerintah' },
    { key: 'external_mitra' },
    { key: 'live_guru' },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    result: [],
  };

  try {
    const target = await resolveDashboardTarget();
    const dashboardUrl = `${BASE_URL}/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/dashboard/`;

    await page.goto(`${BASE_URL}/forms/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('combobox', { name: /^(Masuk Sebagai|Login Sebagai)$/i }).selectOption('superadmin');
    await page.getByRole('textbox', { name: 'Email' }).fill(superadminEmail);
    await page.getByRole('textbox', { name: 'Password' }).fill(superadminPassword);
    const submitButton = page.getByRole('button', { name: /^(Masuk|Login)$/i }).first();
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/forms/admin/'),
      submitButton.click(),
    ]);

    await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('combobox', { name: 'Mode Analisis' }).waitFor({ timeout: 30000 });

    const modeSelect = page.getByRole('combobox', { name: 'Mode Analisis' });
    const loadLatestButton = page.getByRole('button', { name: 'Muat Terakhir' });
    const runButton = page.getByRole('button', { name: 'Jalankan Analisis' });
    const downloadButton = page.getByRole('button', { name: 'Unduh PDF Analisis' });

    for (const mode of modeMatrix) {
      await modeSelect.selectOption(mode.key);
      await loadLatestButton.click();
      await page.waitForTimeout(500);

      const downloadReady = await downloadButton.isEnabled();
      if (!downloadReady) {
        await runButton.click();
        await waitUntilDownloadReady(page);
      }

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        downloadButton.click(),
      ]);

      const failure = await download.failure();
      if (failure) {
        fail(`Download gagal untuk mode ${mode.key}: ${failure}`);
      }

      const suggestedFilename = download.suggestedFilename();
      const outputFilename = `${Date.now()}-${mode.key}-${sanitizeFilename(suggestedFilename)}`;
      const outputPath = path.join(OUTPUT_DIR, outputFilename);
      await download.saveAs(outputPath);
      const stat = await fs.stat(outputPath);
      if (stat.size <= 100) {
        fail(`PDF mode ${mode.key} tidak valid (size=${stat.size}).`);
      }

      report.result.push({
        mode: mode.key,
        file: outputPath,
        bytes: stat.size,
        suggestedFilename,
      });
      console.log(`[PASS] mode=${mode.key} file=${outputFilename} bytes=${stat.size}`);
    }

    const reportPath = path.join(OUTPUT_DIR, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[PASS] report saved: ${reportPath}`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(`[FAIL] ${error?.message || error}`);
  process.exit(1);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import app from '../src/worker.js';

const PROJECT_ROOT = process.cwd();

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

export async function startLocalServer(port) {
  const baseUrl = `http://localhost:${port}`;
  const env = createEnv();
  const server = createServer(async (req, res) => {
    try {
      const method = String(req.method || 'GET').toUpperCase();
      const url = `${baseUrl}${req.url || '/'}`;
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

  server.listen(port);
  await once(server, 'listening');

  return {
    baseUrl,
    close: async () => {
      server.close();
      await once(server, 'close').catch(() => {});
    },
  };
}

export async function launchBrowser() {
  const attempts = [];
  if (process.env.PW_CHANNEL) {
    attempts.push({ channel: process.env.PW_CHANNEL, headless: true });
  }
  attempts.push({ headless: true });
  attempts.push({ channel: 'msedge', headless: true });
  attempts.push({ channel: 'chrome', headless: true });

  let lastError;
  for (const option of attempts) {
    try {
      return await chromium.launch(option);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Gagal launch browser Playwright: ${lastError?.message || 'unknown error'}`);
}

export function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} belum di-set di .env`);
  }
  return value;
}

export async function loginAsSuperadmin(page, { baseUrl, email, password }) {
  await page.goto(`${baseUrl}/forms/admin/login`, { waitUntil: 'domcontentloaded' });
  const roleSelect = page.getByRole('combobox', { name: /^(Masuk Sebagai|Login Sebagai)$/i });
  await roleSelect.selectOption('superadmin');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  const submitButton = page.getByRole('button', { name: /^(Masuk|Login)$/i }).first();
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/forms/admin/'),
    submitButton.click(),
  ]);
}

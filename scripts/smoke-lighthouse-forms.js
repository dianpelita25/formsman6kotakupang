import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_LIGHTHOUSE_FORMS_PORT || 8912);

const THRESHOLDS = {
  performance: 0.55,
  accessibility: 0.9,
  'best-practices': 0.8,
  seo: 0.9,
};

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_LIGHTHOUSE_FORMS_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return '';
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${command} ${args.join(' ')}) with exit code ${code}`));
    });
  });
}

function readCategoryScore(reportJson, categoryId) {
  const score = reportJson?.categories?.[categoryId]?.score;
  return Number.isFinite(score) ? Number(score) : null;
}

async function run() {
  const externalBaseUrl = buildBaseUrl();
  const isExternal = Boolean(externalBaseUrl);

  if (!isExternal) {
    const databaseUrl = String(process.env.DATABASE_URL || '').trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL belum di-set di .env untuk menjalankan smoke Lighthouse lokal.');
    }
  }

  const localServer = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : localServer.baseUrl;
  const targetUrl = `${baseUrl}/forms`;

  const artifactDir = path.join(process.cwd(), 'artifacts', 'lighthouse-forms');
  const reportPath = path.join(artifactDir, 'lighthouse-report.json');
  const summaryPath = path.join(artifactDir, 'summary.json');

  await fs.mkdir(artifactDir, { recursive: true });

  try {
    const args = [
      'exec',
      'lighthouse',
      targetUrl,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--preset=desktop',
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--output=json',
      `--output-path=${reportPath}`,
      '--quiet',
    ];

    console.log(`[INFO] Menjalankan Lighthouse untuk ${targetUrl}`);
    await runCommand('pnpm', args, { cwd: process.cwd() });

    const reportRaw = await fs.readFile(reportPath, 'utf8');
    const reportJson = JSON.parse(reportRaw);

    const scores = {
      performance: readCategoryScore(reportJson, 'performance'),
      accessibility: readCategoryScore(reportJson, 'accessibility'),
      'best-practices': readCategoryScore(reportJson, 'best-practices'),
      seo: readCategoryScore(reportJson, 'seo'),
    };

    const failures = [];
    Object.entries(THRESHOLDS).forEach(([category, threshold]) => {
      const actual = scores[category];
      if (!Number.isFinite(actual)) {
        failures.push(`${category}: score tidak tersedia`);
        return;
      }
      if (actual < threshold) {
        failures.push(`${category}: ${actual.toFixed(2)} < ${threshold.toFixed(2)}`);
      }
    });

    const summary = {
      targetUrl,
      thresholds: THRESHOLDS,
      scores,
      status: failures.length ? 'FAILED' : 'PASS',
      failures,
      generatedAt: new Date().toISOString(),
    };

    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(`[INFO] Skor Lighthouse: ${JSON.stringify(scores)}`);
    console.log(`[INFO] Summary disimpan: ${path.relative(process.cwd(), summaryPath).replace(/\\/g, '/')}`);

    if (failures.length) {
      throw new Error(`Lighthouse threshold gagal: ${failures.join(' | ')}`);
    }

    console.log('PASS: Lighthouse /forms memenuhi threshold minimal.');
  } finally {
    if (localServer) {
      await localServer.close().catch(() => {});
    }
  }
}

run().catch((error) => {
  console.error('FAILED: smoke Lighthouse /forms error.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

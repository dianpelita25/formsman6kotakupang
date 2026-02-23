import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_LIGHTHOUSE_FORMS_PORT || 8912);
const DEFAULT_SAMPLE_COUNT = Number(process.env.SMOKE_LIGHTHOUSE_FORMS_SAMPLES || 3);

const ROUTE_AUDITS = [
  {
    id: 'portal',
    path: '/forms',
    thresholds: {
      performance: 0.75,
      accessibility: 0.9,
      'best-practices': 0.9,
      seo: 0.9,
    },
  },
  {
    id: 'public-form',
    path: '/forms/{tenantSlug}/{questionnaireSlug}/',
    thresholds: {
      performance: 0.65,
      accessibility: 0.9,
      'best-practices': 0.85,
      seo: 0.9,
    },
  },
];

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

function resolveSampleCount() {
  const requested = Number.isFinite(DEFAULT_SAMPLE_COUNT) ? DEFAULT_SAMPLE_COUNT : 3;
  return Math.max(1, Math.floor(requested));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

async function resolveTargetQuestionnaire(baseUrl) {
  const tenantsRes = await fetch(`${baseUrl}/forms/api/tenants/public`);
  if (!tenantsRes.ok) {
    throw new Error(`Gagal memuat tenant publik: status=${tenantsRes.status}`);
  }
  const tenantsPayload = await tenantsRes.json().catch(() => ({}));
  const tenants = toArray(tenantsPayload?.data);
  if (!tenants.length) {
    throw new Error('Daftar tenant publik kosong.');
  }

  for (const tenant of tenants) {
    const tenantSlug = String(tenant?.slug || '').trim();
    if (!tenantSlug) continue;

    const questionnairesRes = await fetch(`${baseUrl}/forms/${tenantSlug}/api/questionnaires/public`);
    if (!questionnairesRes.ok) continue;

    const questionnairesPayload = await questionnairesRes.json().catch(() => ({}));
    const questionnaires = toArray(questionnairesPayload?.data);
    const questionnaire = questionnaires.find((item) => String(item?.slug || '').trim());
    if (!questionnaire) continue;

    return {
      tenantSlug,
      questionnaireSlug: String(questionnaire.slug || '').trim(),
    };
  }

  throw new Error('Tidak ada tenant dengan kuesioner publik untuk audit Lighthouse.');
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

function buildTargetUrl(baseUrl, route, target) {
  if (!route.path.includes('{tenantSlug}') && !route.path.includes('{questionnaireSlug}')) {
    return `${baseUrl}${route.path}`;
  }

  return `${baseUrl}${route.path
    .replace('{tenantSlug}', target.tenantSlug)
    .replace('{questionnaireSlug}', target.questionnaireSlug)}`;
}

function getMedianScore(scores) {
  const normalized = scores.filter((value) => Number.isFinite(value)).map((value) => Number(value));
  if (!normalized.length) return null;
  const sorted = normalized.slice().sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middleIndex];
  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
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

  const artifactDir = path.join(process.cwd(), 'artifacts', 'lighthouse-forms');
  const summaryPath = path.join(artifactDir, 'summary.json');
  await fs.mkdir(artifactDir, { recursive: true });

  try {
    const target = await resolveTargetQuestionnaire(baseUrl);
    const routeSummaries = [];
    const globalFailures = [];

    const sampleCount = resolveSampleCount();

    for (const route of ROUTE_AUDITS) {
      const targetUrl = buildTargetUrl(baseUrl, route, target);
      const samples = [];

      for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
        const reportPath = path.join(artifactDir, `${route.id}-report-${sampleIndex}.json`);
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

        console.log(
          `[INFO] Menjalankan Lighthouse untuk ${targetUrl} (sample ${sampleIndex}/${sampleCount})`
        );
        await runCommand('pnpm', args, { cwd: process.cwd() });

        const reportRaw = await fs.readFile(reportPath, 'utf8');
        const reportJson = JSON.parse(reportRaw);

        samples.push({
          sample: sampleIndex,
          reportPath: path.relative(process.cwd(), reportPath).replace(/\\/g, '/'),
          scores: {
            performance: readCategoryScore(reportJson, 'performance'),
            accessibility: readCategoryScore(reportJson, 'accessibility'),
            'best-practices': readCategoryScore(reportJson, 'best-practices'),
            seo: readCategoryScore(reportJson, 'seo'),
          },
        });
      }

      const scores = {
        performance: getMedianScore(samples.map((sample) => sample.scores.performance)),
        accessibility: getMedianScore(samples.map((sample) => sample.scores.accessibility)),
        'best-practices': getMedianScore(samples.map((sample) => sample.scores['best-practices'])),
        seo: getMedianScore(samples.map((sample) => sample.scores.seo)),
      };

      const failures = [];
      Object.entries(route.thresholds).forEach(([category, threshold]) => {
        const actual = scores[category];
        if (!Number.isFinite(actual)) {
          failures.push(`${category}: score tidak tersedia`);
          return;
        }
        if (actual < threshold) {
          failures.push(`${category}: ${actual.toFixed(2)} < ${threshold.toFixed(2)}`);
        }
      });

      if (failures.length) {
        globalFailures.push(...failures.map((item) => `${route.id} -> ${item}`));
      }

      routeSummaries.push({
        id: route.id,
        targetUrl,
        sampleCount,
        thresholds: route.thresholds,
        samples,
        scores,
        status: failures.length ? 'FAILED' : 'PASS',
        failures,
      });

      console.log(`[INFO] Skor Lighthouse ${route.id}: ${JSON.stringify(scores)}`);
    }

    const summary = {
      status: globalFailures.length ? 'FAILED' : 'PASS',
      generatedAt: new Date().toISOString(),
      routes: routeSummaries,
      failures: globalFailures,
    };

    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(`[INFO] Summary disimpan: ${path.relative(process.cwd(), summaryPath).replace(/\\/g, '/')}`);

    if (globalFailures.length) {
      throw new Error(`Lighthouse threshold gagal: ${globalFailures.join(' | ')}`);
    }

    console.log('PASS: Lighthouse /forms + public form memenuhi threshold minimal.');
  } finally {
    if (localServer) {
      await localServer.close().catch(() => {});
    }
  }
}

run().catch((error) => {
  console.error('FAILED: smoke Lighthouse forms error.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

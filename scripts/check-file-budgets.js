#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(projectRoot, 'scripts', 'file-budget-baseline.json');
const sourceRoots = [path.join(projectRoot, 'src'), path.join(projectRoot, 'public')];

const BUDGET_RULES = [
  {
    id: 'd05-version-repository-exact',
    test: (relativePath) => relativePath === 'src/modules/questionnaires/repositories/version-repository.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd05-forms-repository-exact',
    test: (relativePath) => relativePath === 'src/modules/forms/repository.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd05-submissions-service-exact',
    test: (relativePath) => relativePath === 'src/modules/submissions/service.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd05-auth-service-exact',
    test: (relativePath) => relativePath === 'src/modules/auth/service.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd07-bootstrap-questionnaire-sync-exact',
    test: (relativePath) => relativePath === 'src/lib/db/bootstrap/questionnaire-sync.js',
    maxLines: 260,
    enforceAbsolute: true,
  },
  {
    id: 'd07-bootstrap-schema-ddl-exact',
    test: (relativePath) => relativePath === 'src/lib/db/bootstrap/schema-ddl.js',
    maxLines: 260,
    enforceAbsolute: true,
  },
  {
    id: 'd07-public-script-exact',
    test: (relativePath) => relativePath === 'public/script.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd07-legacy-pdf-renderer-exact',
    test: (relativePath) => relativePath === 'public/shared/dashboard-legacy/pdf-renderer.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd07-legacy-charts-exact',
    test: (relativePath) => relativePath === 'public/shared/dashboard-legacy/charts.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'd07-legacy-ai-exact',
    test: (relativePath) => relativePath === 'public/shared/dashboard-legacy/ai.js',
    maxLines: 220,
    enforceAbsolute: true,
  },
  {
    id: 'distribution-subfiles',
    test: (relativePath) => /^src\/modules\/.+\/distribution\/.+\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'repositories-subfiles',
    test: (relativePath) => /^src\/modules\/.+\/repositories\/.+\.js$/.test(relativePath),
    maxLines: 260,
  },
  {
    id: 'service-files',
    test: (relativePath) =>
      /^src\/modules\/.+\/(?:service[^/]*|[^/]+-service)\.js$/.test(relativePath),
    maxLines: 300,
  },
  {
    id: 'repository-files',
    test: (relativePath) =>
      /^src\/modules\/.+\/(?:repository[^/]*|[^/]+-repository)\.js$/.test(relativePath),
    maxLines: 350,
  },
  {
    id: 'http-routes',
    test: (relativePath) => /^src\/http\/routes\/.+\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'worker-entry',
    test: (relativePath) => /^src\/worker\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'lib-js',
    test: (relativePath) => /^src\/lib\/.+\.js$/.test(relativePath),
    maxLines: 260,
  },
  {
    id: 'admin-page-entry',
    test: (relativePath) => /^public\/admin\/[^/]+\.js$/.test(relativePath),
    maxLines: 80,
  },
  {
    id: 'admin-feature-files',
    test: (relativePath) => /^public\/admin\/.+\/.+\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'shared-admin-feature-files',
    test: (relativePath) => /^public\/shared\/admin\/.+\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'forms-js',
    test: (relativePath) => /^public\/forms\/.+\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'shared-dashboard-legacy',
    test: (relativePath) => /^public\/shared\/dashboard-legacy\/.+\.js$/.test(relativePath),
    maxLines: 220,
  },
  {
    id: 'public-script',
    test: (relativePath) => /^public\/script\.js$/.test(relativePath),
    maxLines: 220,
  },
];

function toPosix(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function toRelative(filePath) {
  return toPosix(path.relative(projectRoot, filePath));
}

async function walkFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function matchRule(relativePath) {
  return BUDGET_RULES.find((rule) => rule.test(relativePath)) || null;
}

async function readBaseline() {
  try {
    const raw = await fs.readFile(baselinePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.files && typeof parsed.files === 'object' ? parsed.files : {};
  } catch {
    return {};
  }
}

async function main() {
  const baseline = await readBaseline();
  const violations = [];

  const files = [];
  for (const root of sourceRoots) {
    try {
      const rootFiles = await walkFiles(root);
      files.push(...rootFiles.filter((filePath) => filePath.endsWith('.js')));
    } catch {
      // ignore missing source root
    }
  }

  for (const filePath of files) {
    const relativePath = toRelative(filePath);
    const rule = matchRule(relativePath);
    if (!rule) continue;

    const sourceCode = await fs.readFile(filePath, 'utf8');
    const lineCount = countLines(sourceCode);
    if (lineCount <= rule.maxLines) continue;

    const baselineLines = Number(baseline[relativePath] || 0);
    if (!rule.enforceAbsolute && baselineLines > 0 && lineCount <= baselineLines) {
      continue;
    }

    violations.push({
      file: relativePath,
      ruleId: rule.id,
      maxLines: rule.maxLines,
      baselineLines,
      currentLines: lineCount,
    });
  }

  console.log('File budget check summary');
  console.log(`- Rules: ${BUDGET_RULES.length}`);
  console.log(`- Baseline entries: ${Object.keys(baseline).length}`);
  console.log(`- Violations: ${violations.length}`);

  if (!violations.length) {
    console.log('\nPASS: file budget constraints satisfied.');
    return;
  }

  console.log('\nViolations:');
  for (const violation of violations) {
    const baselineInfo = violation.baselineLines > 0 ? `baseline=${violation.baselineLines}` : 'baseline=none';
    console.log(
      `- ${violation.file} [${violation.ruleId}] current=${violation.currentLines}, max=${violation.maxLines}, ${baselineInfo}`
    );
  }
  console.error('\nFAILED: file budget violation(s) detected.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: unable to run file budget check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

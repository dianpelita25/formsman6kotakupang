#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const modulesDir = path.join(projectRoot, 'src', 'modules');
const waiversPath = path.join(projectRoot, 'scripts', 'modularity-waivers.json');

const args = new Set(process.argv.slice(2));
const strictMode = args.has('--strict');
const updateWaivers = args.has('--update-waivers');

const violations = [];

function toPosix(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function toRelative(filePath) {
  return toPosix(path.relative(projectRoot, filePath));
}

function makeKey(item) {
  return `${item.rule}|${item.file}|${item.detail}`;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
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

function parseImports(sourceCode) {
  const imports = [];
  const fromRegex = /^\s*import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const sideEffectRegex = /^\s*import\s+['"]([^'"]+)['"]/gm;
  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/gm;

  for (const match of sourceCode.matchAll(fromRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  for (const match of sourceCode.matchAll(sideEffectRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  for (const match of sourceCode.matchAll(dynamicImportRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  return imports.filter(Boolean);
}

function parseNonLiteralDynamicImports(sourceCode) {
  const results = [];
  const dynamicImportExpressionRegex = /import\(\s*([^)]*?)\s*\)/gm;
  for (const match of sourceCode.matchAll(dynamicImportExpressionRegex)) {
    const expression = String(match[1] || '').trim();
    if (!expression) continue;
    if (/^['"][^'"]+['"]$/.test(expression)) continue;
    results.push(expression);
  }
  return [...new Set(results)];
}

function addViolation(rule, file, detail, suggestion) {
  violations.push({ rule, file, detail, suggestion });
}

function isAllowedRepositoryImport(importPath) {
  if (!importPath) return false;
  if (importPath.startsWith('./')) return true;
  if (importPath === '../../lib/db/sql.js') return true;
  return false;
}

function extractModuleName(relativePath) {
  const normalized = toPosix(relativePath);
  const match = normalized.match(/^src\/modules\/([^/]+)\//);
  return match ? match[1] : null;
}

async function resolveImportFilePath(sourceFilePath, importPath) {
  if (!(importPath.startsWith('./') || importPath.startsWith('../'))) {
    return null;
  }

  const sourceDir = path.dirname(sourceFilePath);
  const resolvedBase = path.resolve(sourceDir, importPath);
  const candidates = importPath.endsWith('.js')
    ? [resolvedBase]
    : [resolvedBase, `${resolvedBase}.js`, path.join(resolvedBase, 'index.js')];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return importPath.endsWith('.js') ? resolvedBase : `${resolvedBase}.js`;
}

function isRepositoryFileName(baseName) {
  return /(^|[-_])repository\.js$/i.test(baseName);
}

function isServiceFileName(baseName) {
  return /(^|[-_])service\.js$/i.test(baseName);
}

async function findCrossModuleRepositoryImport(filePath, currentModule, importPath) {
  const resolvedPath = await resolveImportFilePath(filePath, importPath);
  if (!resolvedPath) return null;

  const relativePath = toRelative(resolvedPath);
  const targetModule = extractModuleName(relativePath);
  if (!targetModule || targetModule === currentModule) return null;

  const baseName = path.basename(relativePath);
  const isRepositoryTarget = isRepositoryFileName(baseName) || /^src\/modules\/[^/]+\/repositories\/.+\.js$/.test(relativePath);
  if (!isRepositoryTarget) return null;

  return {
    targetModule,
    relativePath,
  };
}

function collectServiceSqlWriteViolations(relativePath, sourceCode) {
  const templateRegex = /sql`([\s\S]*?)`/g;
  const writeRegex = /\b(INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_][a-z0-9_]*)\b/gi;
  const seen = new Set();

  for (const templateMatch of sourceCode.matchAll(templateRegex)) {
    const sqlText = String(templateMatch[1] || '');
    for (const writeMatch of sqlText.matchAll(writeRegex)) {
      const verb = String(writeMatch[1] || '').toUpperCase();
      const table = String(writeMatch[2] || '').toLowerCase();
      if (table === 'set') continue;
      const detail = `${verb} ${table}`;
      const key = `${relativePath}|${detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      addViolation(
        'SERVICE_RAW_SQL_WRITE',
        relativePath,
        detail,
        'SQL write di service melanggar boundary. Pindahkan ke repository module pemilik tabel.'
      );
    }
  }
}

async function analyzeRepositoryFile(filePath, sourceCode) {
  const relativePath = toRelative(filePath);
  const imports = parseImports(sourceCode);

  for (const importPath of imports) {
    if (isAllowedRepositoryImport(importPath)) continue;
    addViolation(
      'REPOSITORY_IMPORT_BOUNDARY',
      relativePath,
      `import ${importPath}`,
      'Repository hanya boleh import dari lib/db/sql.js atau file lokal (./*).'
    );
  }
}

async function analyzeServiceFile(filePath, sourceCode) {
  const relativePath = toRelative(filePath);
  const currentModule = extractModuleName(relativePath);
  const imports = parseImports(sourceCode);

  for (const importPath of imports) {
    if (/^hono(\/|$)/.test(importPath)) {
      addViolation(
        'SERVICE_FRAMEWORK_COUPLING',
        relativePath,
        `import ${importPath}`,
        'Service tidak boleh coupling ke framework HTTP. Pindahkan ke router/controller.'
      );
    }

    if (importPath.includes('/lib/db/bootstrap.js')) {
      addViolation(
        'SERVICE_BOOTSTRAP_COUPLING',
        relativePath,
        `import ${importPath}`,
        'Service tidak boleh import bootstrap runtime/migration.'
      );
    }

    if (importPath.includes('/lib/db/sql.js') || importPath.includes('/lib/db/client.js')) {
      addViolation(
        'SERVICE_DIRECT_DB_CLIENT',
        relativePath,
        `import ${importPath}`,
        'Service tidak boleh langsung akses DB client. Gunakan repository.'
      );
    }

    const crossModuleRepository = await findCrossModuleRepositoryImport(filePath, currentModule, importPath);
    if (crossModuleRepository) {
      addViolation(
        'SERVICE_CROSS_MODULE_REPOSITORY_IMPORT',
        relativePath,
        `import ${importPath} -> ${crossModuleRepository.relativePath}`,
        'Service tidak boleh import repository module lain langsung.'
      );
    }
  }

  collectServiceSqlWriteViolations(relativePath, sourceCode);
}

async function analyzeModuleFiles() {
  const files = await walkFiles(modulesDir);
  const targetFiles = files.filter((filePath) => filePath.endsWith('.js'));
  const sourceCache = new Map();

  for (const filePath of targetFiles) {
    const sourceCode = await fs.readFile(filePath, 'utf8');
    sourceCache.set(filePath, sourceCode);

    const relativePath = toRelative(filePath);
    const nonLiteralDynamicImports = parseNonLiteralDynamicImports(sourceCode);
    for (const expression of nonLiteralDynamicImports) {
      addViolation(
        'MODULE_DYNAMIC_IMPORT_NON_LITERAL',
        relativePath,
        `import(${expression})`,
        'Gunakan import literal (mis. import("./module.js")) agar checker boundary/cycle bisa mengunci dependency.'
      );
    }
  }

  for (const filePath of targetFiles) {
    const baseName = path.basename(filePath);
    const isRepositoryFile = isRepositoryFileName(baseName);
    const isServiceFile = isServiceFileName(baseName);
    if (!isRepositoryFile && !isServiceFile) {
      continue;
    }

    const sourceCode = sourceCache.get(filePath) || '';
    if (isRepositoryFile) {
      await analyzeRepositoryFile(filePath, sourceCode);
    }
    if (isServiceFile) {
      await analyzeServiceFile(filePath, sourceCode);
    }
  }
}

function sortViolations(list) {
  return [...list].sort((a, b) => {
    if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.detail.localeCompare(b.detail);
  });
}

async function loadWaivers() {
  if (!(await fileExists(waiversPath))) {
    return { waivers: [], waiverSet: new Set() };
  }

  const raw = await fs.readFile(waiversPath, 'utf8');
  const parsed = JSON.parse(raw);
  const waivers = Array.isArray(parsed?.waivers) ? parsed.waivers : [];
  const waiverSet = new Set(
    waivers.map((item) =>
      makeKey({
        rule: String(item.rule || ''),
        file: String(item.file || ''),
        detail: String(item.detail || ''),
      })
    )
  );
  return { waivers, waiverSet };
}

async function writeWaivers(currentViolations) {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    notes: 'Baseline waivers for existing modular boundary debt. New debt must not be added.',
    waivers: currentViolations.map((item) => ({
      rule: item.rule,
      file: item.file,
      detail: item.detail,
      reason: 'existing-debt',
    })),
  };
  await fs.writeFile(waiversPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printList(title, list) {
  console.log(`\n${title}`);
  for (const item of list) {
    console.log(`- [${item.rule}] ${item.file} -> ${item.detail}`);
    if (item.suggestion) {
      console.log(`  fix: ${item.suggestion}`);
    }
  }
}

async function main() {
  await analyzeModuleFiles();
  const sortedViolations = sortViolations(violations);

  if (updateWaivers) {
    await writeWaivers(sortedViolations);
    console.log(`Updated waivers: ${toRelative(waiversPath)} (${sortedViolations.length} entries).`);
    return;
  }

  const { waivers, waiverSet } = await loadWaivers();
  const violationsByKey = new Map(sortedViolations.map((item) => [makeKey(item), item]));

  const enforcedViolations = strictMode
    ? sortedViolations
    : sortedViolations.filter((item) => !waiverSet.has(makeKey(item)));

  const waivedViolations = strictMode
    ? []
    : sortedViolations.filter((item) => waiverSet.has(makeKey(item)));

  const staleWaivers = strictMode
    ? []
    : waivers.filter((item) => !violationsByKey.has(makeKey(item)));

  console.log('Modular boundary check summary');
  console.log(`- Total violations detected: ${sortedViolations.length}`);
  console.log(`- Strict mode: ${strictMode ? 'ON' : 'OFF'}`);
  if (!strictMode) {
    console.log(`- Waived (existing debt): ${waivedViolations.length}`);
    console.log(`- New/unwaived: ${enforcedViolations.length}`);
  }

  if (enforcedViolations.length) {
    printList('Violations to fix', enforcedViolations);
    console.error('\nFAILED: modular boundary violations found.');
    console.error('Tip: fix issues or run `pnpm check:modularity:update-waivers` only after architecture review.');
    process.exitCode = 1;
    return;
  }

  if (waivedViolations.length) {
    printList('Waived violations (backlog)', waivedViolations);
  }

  if (staleWaivers.length) {
    console.log('\nStale waivers (safe to remove from baseline):');
    for (const item of staleWaivers) {
      console.log(`- [${item.rule}] ${item.file} -> ${item.detail}`);
    }
  }

  console.log('\nPASS: no new modular boundary violations.');
}

main().catch((error) => {
  console.error('FAILED: unable to run modular boundary check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

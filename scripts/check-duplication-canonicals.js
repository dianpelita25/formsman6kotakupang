#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const policyPath = path.join(projectRoot, 'scripts', 'duplication-canonicals.json');

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

function countRegexMatches(text, regex) {
  let count = 0;
  let match = regex.exec(text);
  while (match) {
    count += 1;
    match = regex.exec(text);
  }
  return count;
}

function includesFile(allowedList, targetPath) {
  return allowedList.some((item) => item === targetPath);
}

function createRegex(pattern) {
  return new RegExp(pattern, 'gm');
}

function printRuleHeader(ruleId, description, debtId) {
  console.log(`Rule ${ruleId}`);
  if (description) {
    console.log(`- ${description}`);
  }
  console.log(`- Debt ID: ${debtId || '-'}`);
}

function validateRuleBase(rule, violations) {
  const ruleId = String(rule?.id || '').trim();
  const debtId = String(rule?.debtId || '').trim();
  if (!ruleId) {
    violations.push({
      ruleId: '<missing-id>',
      debtId: debtId || '-',
      detail: 'Rule tidak valid (id wajib).',
    });
    return null;
  }
  return { ruleId, debtId };
}

function evaluateDeclarationRule({ rule, sourceCache, violations }) {
  const base = validateRuleBase(rule, violations);
  if (!base) return;
  const { ruleId, debtId } = base;

  const description = String(rule?.description || '').trim();
  const pattern = String(rule?.declarationPattern || '').trim();
  const allowedDeclarationFiles = Array.isArray(rule?.allowedDeclarationFiles)
    ? rule.allowedDeclarationFiles.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const maxAllowedDeclarations = Number(rule?.maxAllowedDeclarations || 0);
  const enforceExactFiles = Boolean(rule?.enforceExactFiles);

  if (!pattern || !allowedDeclarationFiles.length) {
    violations.push({
      ruleId,
      debtId: debtId || '-',
      detail: 'Rule declaration tidak valid (declarationPattern + allowedDeclarationFiles wajib).',
    });
    return;
  }

  let declarationCount = 0;
  const declarationFiles = new Set();
  const regex = createRegex(pattern);
  for (const [filePath, sourceCode] of sourceCache.entries()) {
    regex.lastIndex = 0;
    const matchCount = countRegexMatches(sourceCode, regex);
    if (!matchCount) continue;
    declarationCount += matchCount;
    declarationFiles.add(toRelative(filePath));
  }

  const actualFiles = [...declarationFiles].sort();
  const unexpectedFiles = actualFiles.filter((file) => !includesFile(allowedDeclarationFiles, file));
  if (unexpectedFiles.length) {
    violations.push({
      ruleId,
      debtId: debtId || '-',
      detail: `Deklarasi baru di luar allowlist: ${unexpectedFiles.join(', ')}`,
    });
  }

  if (enforceExactFiles) {
    const missingFiles = allowedDeclarationFiles.filter((file) => !declarationFiles.has(file));
    if (missingFiles.length) {
      violations.push({
        ruleId,
        debtId: debtId || '-',
        detail: `Deklarasi expected tidak ditemukan: ${missingFiles.join(', ')}`,
      });
    }
  }

  if (maxAllowedDeclarations > 0 && declarationCount > maxAllowedDeclarations) {
    violations.push({
      ruleId,
      debtId: debtId || '-',
      detail: `Jumlah deklarasi melebihi batas (${declarationCount} > ${maxAllowedDeclarations}).`,
    });
  }

  printRuleHeader(ruleId, description, debtId);
  console.log(`- Type: declaration`);
  console.log(`- Declaration files: ${actualFiles.length}`);
  console.log(`- Declaration matches: ${declarationCount}`);
}

function evaluateForbiddenPatternRule({ rule, sourceByRelative, violations }) {
  const base = validateRuleBase(rule, violations);
  if (!base) return;
  const { ruleId, debtId } = base;

  const description = String(rule?.description || '').trim();
  const pattern = String(rule?.forbiddenPattern || '').trim();
  const targetFiles = Array.isArray(rule?.targetFiles)
    ? rule.targetFiles.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const maxAllowedMatches = Number(rule?.maxAllowedMatches || 0);

  if (!pattern || !targetFiles.length) {
    violations.push({
      ruleId,
      debtId: debtId || '-',
      detail: 'Rule forbiddenPattern tidak valid (forbiddenPattern + targetFiles wajib).',
    });
    return;
  }

  const regex = createRegex(pattern);
  let totalMatches = 0;
  const fileSummaries = [];

  for (const targetFile of targetFiles) {
    const sourceCode = sourceByRelative.get(targetFile);
    if (typeof sourceCode !== 'string') {
      violations.push({
        ruleId,
        debtId: debtId || '-',
        detail: `Target file tidak ditemukan: ${targetFile}`,
      });
      continue;
    }

    regex.lastIndex = 0;
    const matchCount = countRegexMatches(sourceCode, regex);
    totalMatches += matchCount;
    fileSummaries.push({ file: targetFile, matches: matchCount });

    if (matchCount > 0) {
      violations.push({
        ruleId,
        debtId: debtId || '-',
        detail: `Forbidden pattern terdeteksi di ${targetFile} (${matchCount} match).`,
      });
    }
  }

  if (totalMatches > maxAllowedMatches) {
    violations.push({
      ruleId,
      debtId: debtId || '-',
      detail: `Total forbidden match melebihi batas (${totalMatches} > ${maxAllowedMatches}).`,
    });
  }

  printRuleHeader(ruleId, description, debtId);
  console.log(`- Type: forbiddenPattern`);
  console.log(`- Target files: ${targetFiles.length}`);
  for (const summary of fileSummaries) {
    console.log(`  * ${summary.file}: ${summary.matches}`);
  }
  console.log(`- Total forbidden matches: ${totalMatches}`);
}

async function main() {
  const violations = [];
  let policy;

  try {
    const raw = await fs.readFile(policyPath, 'utf8');
    policy = JSON.parse(raw);
  } catch (error) {
    console.error(`FAILED: tidak bisa membaca policy ${toRelative(policyPath)}.`);
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
    return;
  }

  const defaults = policy?.defaults || {};
  const scanRoots = Array.isArray(defaults.scanRoots) ? defaults.scanRoots : ['src', 'public'];
  const includeExtensions = Array.isArray(defaults.includeExtensions) ? defaults.includeExtensions : ['.js'];
  const ignorePathPrefixes = Array.isArray(defaults.ignorePathPrefixes) ? defaults.ignorePathPrefixes : [];
  const rules = Array.isArray(policy?.rules) ? policy.rules : [];

  if (!rules.length) {
    console.error('FAILED: policy duplication-canonicals tidak punya rule.');
    process.exitCode = 1;
    return;
  }

  const files = [];
  for (const relativeRoot of scanRoots) {
    const absoluteRoot = path.join(projectRoot, relativeRoot);
    try {
      const rootFiles = await walkFiles(absoluteRoot);
      files.push(...rootFiles);
    } catch {
      // ignore missing roots
    }
  }

  const sourceFiles = files.filter((filePath) => {
    const relativePath = toRelative(filePath);
    if (ignorePathPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      return false;
    }
    return includeExtensions.some((ext) => relativePath.endsWith(ext));
  });

  const sourceCache = new Map();
  const sourceByRelative = new Map();
  for (const filePath of sourceFiles) {
    const sourceCode = await fs.readFile(filePath, 'utf8');
    sourceCache.set(filePath, sourceCode);
    sourceByRelative.set(toRelative(filePath), sourceCode);
  }

  for (const rule of rules) {
    const ruleType = String(rule?.type || 'declaration').trim();
    if (ruleType === 'declaration') {
      evaluateDeclarationRule({ rule, sourceCache, violations });
      continue;
    }
    if (ruleType === 'forbiddenPattern') {
      evaluateForbiddenPatternRule({ rule, sourceByRelative, violations });
      continue;
    }

    const ruleId = String(rule?.id || '<missing-id>').trim();
    const debtId = String(rule?.debtId || '-').trim();
    violations.push({
      ruleId,
      debtId,
      detail: `Rule type tidak dikenal: ${ruleType}`,
    });
  }

  console.log('\nDuplication canonical check summary');
  console.log(`- Policy: ${toRelative(policyPath)}`);
  console.log(`- Rules: ${rules.length}`);
  console.log(`- Files scanned: ${sourceFiles.length}`);
  console.log(`- Violations: ${violations.length}`);

  if (!violations.length) {
    console.log('\nPASS: canonical duplication policy satisfied.');
    return;
  }

  console.log('\nViolations:');
  for (const violation of violations) {
    console.log(`- [${violation.debtId}] ${violation.ruleId}: ${violation.detail}`);
  }
  console.error('\nFAILED: duplication canonical policy violation(s) detected.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: unable to run canonical duplication check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

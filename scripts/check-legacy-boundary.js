#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

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

function parseImports(sourceCode) {
  const imports = [];
  const fromRegex = /^\s*import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const sideEffectRegex = /^\s*import\s+['"]([^'"]+)['"]/gm;

  for (const match of sourceCode.matchAll(fromRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  for (const match of sourceCode.matchAll(sideEffectRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  return imports.filter(Boolean);
}

function isLegacyImport(importPath) {
  return importPath.includes('/legacy/') || importPath.startsWith('../legacy/') || importPath.startsWith('./legacy/');
}

async function main() {
  const files = (await walkFiles(srcDir)).filter((filePath) => filePath.endsWith('.js'));
  const violations = [];

  for (const filePath of files) {
    const relativePath = toRelative(filePath);
    if (relativePath.startsWith('src/legacy/')) continue;

    const sourceCode = await fs.readFile(filePath, 'utf8');
    const imports = parseImports(sourceCode);
    for (const importPath of imports) {
      if (!isLegacyImport(importPath)) continue;
      violations.push({
        file: relativePath,
        importPath,
      });
    }
  }

  console.log('Legacy boundary check summary');
  console.log(`- Files analyzed: ${files.length}`);
  console.log(`- Violations: ${violations.length}`);

  if (!violations.length) {
    console.log('\nPASS: no non-legacy imports to src/legacy/**.');
    return;
  }

  console.log('\nViolations:');
  for (const violation of violations) {
    console.log(`- ${violation.file} -> ${violation.importPath}`);
  }
  console.error('\nFAILED: non-legacy code importing src/legacy/** detected.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: unable to run legacy boundary check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

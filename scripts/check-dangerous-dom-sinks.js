#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const sourceRoots = [path.join(projectRoot, 'public')];

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

function lineNumberForIndex(sourceCode, index) {
  return sourceCode.slice(0, index).split(/\r?\n/).length;
}

function isStaticHtmlExpression(expression) {
  const value = String(expression || '').trim();
  if (!value) return false;

  if (value === "''" || value === '""') {
    return true;
  }

  if (value.startsWith("'") || value.startsWith('"')) {
    return true;
  }

  if (value.startsWith('`')) {
    return !value.includes('${');
  }

  return false;
}

function collectInnerHtmlViolations(sourceCode) {
  const violations = [];
  const assignRegex = /\.((?:inner|outer)HTML)\s*=\s*([\s\S]*?);/gm;
  for (const match of sourceCode.matchAll(assignRegex)) {
    const sink = String(match[1] || '');
    const expression = String(match[2] || '');
    if (isStaticHtmlExpression(expression)) {
      continue;
    }
    const index = Number(match.index || 0);
    violations.push({
      line: lineNumberForIndex(sourceCode, index),
      rule: `${sink}-dynamic-assignment`,
      snippet: `${sink} = ${expression.trim().slice(0, 120)}`,
    });
  }
  return violations;
}

function collectInsertAdjacentHtmlViolations(sourceCode) {
  const violations = [];
  const regex = /insertAdjacentHTML\s*\(\s*([^,]+)\s*,\s*([\s\S]*?)\)\s*;/gm;
  for (const match of sourceCode.matchAll(regex)) {
    const expression = String(match[2] || '');
    if (isStaticHtmlExpression(expression)) {
      continue;
    }
    const index = Number(match.index || 0);
    violations.push({
      line: lineNumberForIndex(sourceCode, index),
      rule: 'insertAdjacentHTML-dynamic-assignment',
      snippet: `insertAdjacentHTML(..., ${expression.trim().slice(0, 120)})`,
    });
  }
  return violations;
}

async function main() {
  const jsFiles = [];
  for (const root of sourceRoots) {
    try {
      const rootFiles = await walkFiles(root);
      jsFiles.push(...rootFiles.filter((filePath) => filePath.endsWith('.js')));
    } catch {
      // ignore missing roots
    }
  }

  const violations = [];
  for (const filePath of jsFiles) {
    const relativePath = toRelative(filePath);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const fileViolations = [
      ...collectInnerHtmlViolations(sourceCode),
      ...collectInsertAdjacentHtmlViolations(sourceCode),
    ];
    fileViolations.forEach((item) => {
      violations.push({
        file: relativePath,
        ...item,
      });
    });
  }

  console.log('DOM sink safety check summary');
  console.log(`- Files analyzed: ${jsFiles.length}`);
  console.log(`- Violations: ${violations.length}`);

  if (!violations.length) {
    console.log('\nPASS: tidak ada assignment dinamis ke sink HTML berisiko.');
    return;
  }

  console.log('\nViolations:');
  violations.forEach((item) => {
    console.log(`- ${item.file}:${item.line} [${item.rule}] ${item.snippet}`);
  });
  console.error('\nFAILED: ditemukan sink HTML dinamis yang berisiko XSS.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: tidak bisa menjalankan checker sink DOM.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

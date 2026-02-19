#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const frontendRoots = [
  path.join(projectRoot, 'public', 'admin'),
  path.join(projectRoot, 'public', 'forms'),
  path.join(projectRoot, 'public', 'shared'),
];
const SHARED_ADMIN_RUNTIME_PATTERN = /^public\/shared\/admin\/[^/]+\/runtime\.js$/;

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

function isEntryFile(relativePath) {
  return /^public\/(admin|forms)\/[^/]+\.js$/.test(relativePath);
}

function resolvePageRoot(relativePath) {
  const adminModuleMatch = relativePath.match(/^public\/admin\/([^/]+)\/.+\.js$/);
  if (adminModuleMatch) {
    return `public/admin/${adminModuleMatch[1]}/`;
  }
  const formsModuleMatch = relativePath.match(/^public\/forms\/([^/]+)\/.+\.js$/);
  if (formsModuleMatch) {
    return `public/forms/${formsModuleMatch[1]}/`;
  }
  return null;
}

function resolveImportTarget(sourceFile, importPath) {
  if (importPath.startsWith('/forms-static/')) {
    const relativeStaticPath = importPath.slice('/forms-static/'.length);
    const resolved = path.join(projectRoot, 'public', relativeStaticPath);
    const withExt = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
    return withExt;
  }
  if (!(importPath.startsWith('./') || importPath.startsWith('../'))) return null;
  const sourceDir = path.dirname(sourceFile);
  const resolved = path.resolve(sourceDir, importPath);
  const withExt = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  return withExt;
}

async function main() {
  const violations = [];
  const jsFiles = [];

  for (const root of frontendRoots) {
    try {
      const rootFiles = await walkFiles(root);
      jsFiles.push(...rootFiles.filter((filePath) => filePath.endsWith('.js')));
    } catch {
      // ignore missing roots
    }
  }

  for (const filePath of jsFiles) {
    const relativePath = toRelative(filePath);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const imports = parseImports(sourceCode);
    const sourceIsEntry = isEntryFile(relativePath);
    const sourcePageRoot = resolvePageRoot(relativePath);

    for (const importPath of imports) {
      const targetPath = resolveImportTarget(filePath, importPath);
      if (!targetPath) continue;
      const targetRelative = toRelative(targetPath);
      const targetIsEntry = isEntryFile(targetRelative);
      const targetPageRoot = resolvePageRoot(targetRelative);

      if (SHARED_ADMIN_RUNTIME_PATTERN.test(targetRelative)) {
        violations.push({
          file: relativePath,
          importPath,
          reason: 'Import ke public/shared/admin/*/runtime.js dilarang (runtime legacy bridge only).',
        });
        continue;
      }

      if (sourceIsEntry && targetIsEntry) {
        violations.push({
          file: relativePath,
          importPath,
          reason: 'Entry file tidak boleh import entry page lain secara relatif.',
        });
        continue;
      }

      if (sourcePageRoot && targetPageRoot && sourcePageRoot !== targetPageRoot) {
        violations.push({
          file: relativePath,
          importPath,
          reason: `Cross-page import tidak diizinkan (${sourcePageRoot} -> ${targetPageRoot}).`,
        });
      }
    }
  }

  console.log('Frontend boundary check summary');
  console.log(`- Files analyzed: ${jsFiles.length}`);
  console.log(`- Violations: ${violations.length}`);

  if (!violations.length) {
    console.log('\nPASS: frontend boundary constraints satisfied.');
    return;
  }

  console.log('\nViolations:');
  for (const violation of violations) {
    console.log(`- ${violation.file} -> ${violation.importPath}`);
    console.log(`  reason: ${violation.reason}`);
  }
  console.error('\nFAILED: frontend boundary violation(s) detected.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: unable to run frontend boundary check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const modulesDir = path.join(projectRoot, 'src', 'modules');

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

function findCrossModuleImport(sourceModule, importPath) {
  if (!importPath.startsWith('../')) return null;
  const match = importPath.match(/^\.\.\/([^/]+)\//);
  if (!match) return null;
  const targetModule = String(match[1] || '').trim();
  if (!targetModule || targetModule === sourceModule) return null;
  return targetModule;
}

function normalizeCycle(pathItems) {
  const body = [...pathItems];
  let minIndex = 0;
  for (let index = 1; index < body.length; index += 1) {
    if (body[index].localeCompare(body[minIndex]) < 0) {
      minIndex = index;
    }
  }
  const rotated = [...body.slice(minIndex), ...body.slice(0, minIndex)];
  rotated.push(rotated[0]);
  return rotated;
}

function findCycles(nodes, adjacency) {
  const cycleSet = new Set();
  const cycleList = [];

  function dfs(start, current, pathItems, seenInPath) {
    const nextTargets = adjacency.get(current) || new Set();
    for (const next of nextTargets) {
      if (next === start) {
        const normalized = normalizeCycle(pathItems);
        const key = normalized.join(' -> ');
        if (!cycleSet.has(key)) {
          cycleSet.add(key);
          cycleList.push(normalized);
        }
        continue;
      }
      if (seenInPath.has(next)) continue;
      seenInPath.add(next);
      dfs(start, next, [...pathItems, next], seenInPath);
      seenInPath.delete(next);
    }
  }

  for (const node of nodes) {
    dfs(node, node, [node], new Set([node]));
  }

  return cycleList.sort((a, b) => a.join(' -> ').localeCompare(b.join(' -> ')));
}

async function main() {
  const moduleEntries = await fs.readdir(modulesDir, { withFileTypes: true });
  const modules = moduleEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const adjacency = new Map();
  for (const moduleName of modules) {
    adjacency.set(moduleName, new Set());
  }

  const files = (await walkFiles(modulesDir)).filter((filePath) => filePath.endsWith('.js'));
  for (const filePath of files) {
    const relativePath = toRelative(filePath);
    const sourceMatch = relativePath.match(/^src\/modules\/([^/]+)\//);
    if (!sourceMatch) continue;
    const sourceModule = String(sourceMatch[1] || '').trim();
    if (!sourceModule) continue;

    const sourceCode = await fs.readFile(filePath, 'utf8');
    for (const importPath of parseImports(sourceCode)) {
      const targetModule = findCrossModuleImport(sourceModule, importPath);
      if (!targetModule) continue;
      if (!adjacency.has(targetModule)) continue;
      adjacency.get(sourceModule).add(targetModule);
    }
  }

  const cycles = findCycles(modules, adjacency);
  console.log('Module cycle check summary');
  console.log(`- Modules analyzed: ${modules.length}`);
  console.log(`- Cycles detected: ${cycles.length}`);

  if (!cycles.length) {
    console.log('\nPASS: no cross-module cycles detected.');
    return;
  }

  console.log('\nDetected cycles:');
  for (const cycle of cycles) {
    console.log(`- ${cycle.join(' -> ')}`);
  }
  console.error('\nFAILED: cross-module cycle(s) detected.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: unable to run module cycle check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

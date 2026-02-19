#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const modulesDir = path.join(projectRoot, 'src', 'modules');
const outputPath = path.join(projectRoot, 'artifacts', 'modularity', 'module-deps.json');

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
  const namedReExportRegex = /^\s*export\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const starReExportRegex = /^\s*export\s+\*\s+from\s+['"]([^'"]+)['"]/gm;
  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/gm;

  for (const match of sourceCode.matchAll(fromRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  for (const match of sourceCode.matchAll(sideEffectRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  for (const match of sourceCode.matchAll(namedReExportRegex)) {
    imports.push(String(match[1] || '').trim());
  }
  for (const match of sourceCode.matchAll(starReExportRegex)) {
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

function findCycles(nodes, adjacency) {
  const cycles = new Set();

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
    return rotated.join(' -> ');
  }

  function dfs(start, current, pathItems, seenInPath) {
    const nextTargets = adjacency.get(current) || new Set();
    for (const next of nextTargets) {
      if (next === start) {
        cycles.add(normalizeCycle(pathItems));
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

  return Array.from(cycles).sort();
}

async function main() {
  const moduleEntries = await fs.readdir(modulesDir, { withFileTypes: true });
  const modules = moduleEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const edgesMap = new Map();
  const edgeOccurrences = new Map();
  const moduleFiles = new Map(modules.map((moduleName) => [moduleName, []]));

  for (const moduleName of modules) {
    edgesMap.set(moduleName, new Set());
  }

  const files = (await walkFiles(modulesDir)).filter((filePath) => filePath.endsWith('.js'));
  for (const filePath of files) {
    const relativePath = toRelative(filePath);
    const sourceMatch = relativePath.match(/^src\/modules\/([^/]+)\//);
    if (!sourceMatch) continue;
    const sourceModule = String(sourceMatch[1] || '').trim();
    if (!sourceModule) continue;

    moduleFiles.get(sourceModule)?.push(relativePath);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const imports = parseImports(sourceCode);
    for (const importPath of imports) {
      const targetModule = findCrossModuleImport(sourceModule, importPath);
      if (!targetModule) continue;
      if (!edgesMap.has(targetModule)) continue;
      edgesMap.get(sourceModule).add(targetModule);

      const key = `${sourceModule}->${targetModule}`;
      if (!edgeOccurrences.has(key)) {
        edgeOccurrences.set(key, []);
      }
      edgeOccurrences.get(key).push({
        file: relativePath,
        importPath,
      });
    }
  }

  const cycles = findCycles(modules, edgesMap);
  const edges = [];
  for (const [source, targets] of edgesMap.entries()) {
    for (const target of targets) {
      const key = `${source}->${target}`;
      edges.push({
        source,
        target,
        occurrences: edgeOccurrences.get(key) || [],
      });
    }
  }
  edges.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    nodes: modules,
    files: Object.fromEntries(
      Array.from(moduleFiles.entries()).map(([moduleName, fileList]) => [moduleName, [...fileList].sort()])
    ),
    edges,
    cycles,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Saved module dependency map: ${toRelative(outputPath)}`);
  console.log(`- Modules: ${modules.length}`);
  console.log(`- Edges: ${edges.length}`);
  console.log(`- Cycles: ${cycles.length}`);
}

main().catch((error) => {
  console.error('FAILED: unable to build module dependency map.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, 'public');
const htmlFiles = [];

function walkHtmlFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath);
      return;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  });
}

function toRelative(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function computeLineFromIndex(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

function collectViolations(filePath, content) {
  const regex = /\/forms-static\/[^"'\s>]+\.(?:css|js)(?:\?[^"'\s>]*)?/gi;
  const violations = [];

  let match;
  while ((match = regex.exec(content))) {
    const rawPath = String(match[0] || '').trim();
    if (!rawPath) continue;

    let parsed;
    try {
      parsed = new URL(rawPath, 'https://local.invalid');
    } catch {
      violations.push({
        line: computeLineFromIndex(content, match.index),
        asset: rawPath,
        reason: 'URL asset tidak valid.',
      });
      continue;
    }

    const versionTag = String(parsed.searchParams.get('v') || '').trim();
    if (versionTag) continue;

    violations.push({
      line: computeLineFromIndex(content, match.index),
      asset: rawPath,
      reason: 'Asset /forms-static wajib punya query versi `v=`.',
    });
  }

  return violations;
}

function run() {
  if (!fs.existsSync(publicDir)) {
    console.error('FAILED: folder public/ tidak ditemukan.');
    process.exit(1);
  }

  walkHtmlFiles(publicDir);

  const allViolations = [];
  htmlFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = collectViolations(filePath, content);
    violations.forEach((violation) => {
      allViolations.push({
        file: toRelative(filePath),
        ...violation,
      });
    });
  });

  if (!allViolations.length) {
    console.log('PASS: semua referensi /forms-static (*.css|*.js) di HTML sudah versioned (?v=...).');
    return;
  }

  console.error('FAILED: ditemukan referensi /forms-static tanpa query versi `v=`.');
  allViolations.forEach((item) => {
    console.error(`- ${item.file}:${item.line} -> ${item.asset} (${item.reason})`);
  });
  process.exit(1);
}

run();

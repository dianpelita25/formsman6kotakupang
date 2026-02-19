#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const registerPath = path.join(projectRoot, 'docs', 'DEBT_REGISTER_LOCKED.md');

const REQUIRED_COLUMNS = [
  'ID',
  'Judul',
  'Kategori',
  'Severity',
  'Owner',
  'Scope Files',
  'Gate Lock',
  'Exit Criteria',
  'Status',
  'Proof Commit',
  'Proof Commands',
  'Tanggal Tutup',
];

const ALLOWED_STATUSES = ['OPEN', 'IN_PROGRESS', 'READY_FOR_CLOSE', 'CLOSED'];
const CLOSED_REQUIRED_COLUMNS = ['Proof Commit', 'Proof Commands', 'Tanggal Tutup'];

function parseMarkdownRow(rowLine) {
  const trimmed = String(rowLine || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((value) => value.trim());
}

function isSeparatorRow(values) {
  return values.every((value) => /^:?-{2,}:?$/.test(value));
}

function normalizeValue(value) {
  return String(value || '').trim();
}

function hasProofValue(value) {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) return false;
  if (['-', 'tbd', 'n/a', 'na'].includes(normalized)) return false;
  return true;
}

async function main() {
  const errors = [];
  let fileContent = '';

  try {
    fileContent = await fs.readFile(registerPath, 'utf8');
  } catch (error) {
    console.error(`FAILED: tidak bisa membaca ${path.relative(projectRoot, registerPath)}.`);
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
    return;
  }

  const lines = fileContent.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((line) => /^\|\s*ID\s*\|/.test(line));
  if (headerLineIndex < 0) {
    console.error('FAILED: tabel debt register tidak ditemukan (header ID tidak ada).');
    process.exitCode = 1;
    return;
  }

  const headerValues = parseMarkdownRow(lines[headerLineIndex]);
  if (!headerValues.length) {
    console.error('FAILED: header tabel debt register tidak valid.');
    process.exitCode = 1;
    return;
  }

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headerValues.includes(column));
  if (missingColumns.length) {
    errors.push(`Kolom wajib hilang: ${missingColumns.join(', ')}`);
  }

  const separatorValues = parseMarkdownRow(lines[headerLineIndex + 1] || '');
  if (!separatorValues.length || !isSeparatorRow(separatorValues)) {
    errors.push('Baris separator tabel debt register tidak valid.');
  }

  const rows = [];
  for (let index = headerLineIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) break;
    if (!line.trim().startsWith('|')) break;

    const values = parseMarkdownRow(line);
    if (!values.length) continue;
    if (isSeparatorRow(values)) continue;

    const row = {};
    for (let columnIndex = 0; columnIndex < headerValues.length; columnIndex += 1) {
      const column = headerValues[columnIndex];
      row[column] = normalizeValue(values[columnIndex] ?? '');
    }
    rows.push(row);
  }

  if (!rows.length) {
    errors.push('Tidak ada row debt di dalam tabel.');
  }

  const seenIds = new Set();
  for (const row of rows) {
    const id = normalizeValue(row.ID);
    if (!id) {
      errors.push('Ada row tanpa ID.');
      continue;
    }
    if (!/^D\d{2,}$/.test(id)) {
      errors.push(`Format ID tidak valid: ${id}. Gunakan pola D01, D02, dst.`);
    }
    if (seenIds.has(id)) {
      errors.push(`ID duplikat terdeteksi: ${id}.`);
    }
    seenIds.add(id);

    for (const column of REQUIRED_COLUMNS) {
      const value = normalizeValue(row[column]);
      if (!value) {
        errors.push(`Debt ${id}: kolom "${column}" kosong.`);
      }
    }

    const status = normalizeValue(row.Status);
    if (!ALLOWED_STATUSES.includes(status)) {
      errors.push(
        `Debt ${id}: status "${status}" tidak sah. Gunakan salah satu: ${ALLOWED_STATUSES.join(', ')}.`
      );
    }

    if (status === 'CLOSED') {
      for (const column of CLOSED_REQUIRED_COLUMNS) {
        if (!hasProofValue(row[column])) {
          errors.push(`Debt ${id}: status CLOSED wajib isi kolom "${column}" dengan nilai proof valid.`);
        }
      }
    }
  }

  console.log('Debt register check summary');
  console.log(`- File: ${path.relative(projectRoot, registerPath)}`);
  console.log(`- Required columns: ${REQUIRED_COLUMNS.length}`);
  console.log(`- Rows parsed: ${rows.length}`);
  console.log(`- Errors: ${errors.length}`);

  if (!errors.length) {
    console.log('\nPASS: debt register valid dan siap dijadikan closure lock.');
    return;
  }

  console.log('\nErrors:');
  for (const error of errors) {
    console.log(`- ${error}`);
  }
  console.error('\nFAILED: debt register validation gagal.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAILED: unable to run debt register check.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

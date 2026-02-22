#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'node:child_process';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function resolveDeployEnv() {
  const value = getArgValue('--env');
  if (!value) return '';
  return value;
}

function requireEnvVar(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    console.error(`[DEPLOY_BLOCKED] ${name} belum terisi. Isi di .env atau shell env sebelum deploy.`);
    process.exit(1);
  }
  return value;
}

function run() {
  requireEnvVar('CLOUDFLARE_API_TOKEN');

  const deployEnv = resolveDeployEnv();
  const args = ['exec', 'wrangler', 'deploy', 'src/worker.js'];
  if (deployEnv) {
    args.push('--env', deployEnv);
  }

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

run();

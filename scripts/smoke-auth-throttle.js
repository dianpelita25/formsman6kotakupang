import 'dotenv/config';
import app from '../src/worker.js';

function failHard(message) {
  throw new Error(message);
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    failHard(`${name} belum di-set di .env`);
  }
  return value;
}

function createTestEnv(overrides = {}) {
  return {
    ...process.env,
    ...overrides,
    ASSETS: {
      async fetch() {
        return new Response('Not Found', { status: 404 });
      },
    },
  };
}

async function loginAttempt(env, email, password) {
  const response = await app.request(
    'http://localhost/forms/admin/api/login',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
    env
  );

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    status: response.status,
    json,
  };
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runScenario({ env, email, scenarioLabel }) {
  const statuses = [];

  for (let index = 1; index <= 6; index += 1) {
    const result = await loginAttempt(env, email, 'password-salah-123');
    statuses.push(result.status);
  }

  const firstFiveValid = statuses.slice(0, 5).every((status) => status === 401 || status === 429);
  expect(firstFiveValid, `${scenarioLabel}: status 1-5 tidak valid (${statuses.join(',')})`);
  expect(statuses[5] === 429, `${scenarioLabel}: status percobaan ke-6 harus 429, aktual=${statuses[5]}`);

  console.log(`[PASS] ${scenarioLabel} -> ${statuses.join(', ')}`);
}

async function run() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('SESSION_SECRET');
  getRequiredEnv('SUPERADMIN_EMAIL');
  getRequiredEnv('SUPERADMIN_PASSWORD');

  const dbEnv = createTestEnv({
    LOGIN_THROTTLE_FORCE_MEMORY: 'false',
  });
  const memoryEnv = createTestEnv({
    LOGIN_THROTTLE_FORCE_MEMORY: 'true',
  });

  await runScenario({
    env: dbEnv,
    email: `throttle-db-${Date.now()}@aiti.local`,
    scenarioLabel: 'db-hybrid scenario',
  });

  await runScenario({
    env: memoryEnv,
    email: `throttle-memory-${Date.now()}@aiti.local`,
    scenarioLabel: 'memory-fallback scenario',
  });

  console.log('PASS: smoke auth throttle lulus (db-hybrid + memory-fallback).');
}

run().catch((error) => {
  console.error('[FAIL] smoke auth throttle');
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});

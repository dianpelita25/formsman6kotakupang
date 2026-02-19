export function resolveBootstrapMode(env, options = {}) {
  if (options.forceFullBootstrap) return 'full';

  const explicitMode = String(options.mode || env?.DB_BOOTSTRAP_MODE || '')
    .trim()
    .toLowerCase();
  if (explicitMode === 'full' || explicitMode === 'check') {
    return explicitMode;
  }

  const appEnv = String(env?.APP_ENV || 'local').trim().toLowerCase();
  if (appEnv === 'production' || appEnv === 'staging') {
    return 'check';
  }
  return 'full';
}

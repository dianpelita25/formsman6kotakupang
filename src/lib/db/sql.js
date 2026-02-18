import { neon } from '@neondatabase/serverless';

export function getDatabaseUrl(env) {
  return env?.DATABASE_URL || process.env.DATABASE_URL;
}

export function getSqlClient(env) {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diset.');
  }
  return neon(databaseUrl);
}

import { neon } from '@neondatabase/serverless';

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diset di environment.');
  }

  return neon(databaseUrl);
}

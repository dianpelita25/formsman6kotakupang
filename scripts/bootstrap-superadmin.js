import 'dotenv/config';
import { ensurePlatformSchema } from '../src/lib/db/bootstrap.js';
import { createUser, findUserByEmail, grantSuperadminRole, updateUserPassword } from '../src/modules/auth/repository.js';
import { hashPassword, randomSalt, resolvePbkdf2TargetIterations } from '../src/lib/security/hash.js';

function getConfig() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL dan SUPERADMIN_PASSWORD wajib diisi.');
  }
  if (password.length < 8) {
    throw new Error('SUPERADMIN_PASSWORD minimal 8 karakter.');
  }
  return { email, password };
}

async function main() {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
  };
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset.');
  }

  await ensurePlatformSchema(env, { forceFullBootstrap: true });

  const { email, password } = getConfig();
  const targetIterations = resolvePbkdf2TargetIterations(process.env);
  const salt = randomSalt();
  const hash = await hashPassword(password, salt, targetIterations);
  let user = await findUserByEmail(env, email);
  if (!user) {
    user = await createUser(env, {
      id: crypto.randomUUID(),
      email,
      passwordHash: hash,
      passwordSalt: salt,
      passwordIterations: targetIterations,
      isActive: true,
    });
  } else {
    user = await updateUserPassword(env, {
      userId: user.id,
      passwordHash: hash,
      passwordSalt: salt,
      passwordIterations: targetIterations,
    });
  }

  if (!user) {
    throw new Error('Gagal membuat atau menemukan superadmin.');
  }

  await grantSuperadminRole(env, user.id);
  console.log(`Superadmin siap: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

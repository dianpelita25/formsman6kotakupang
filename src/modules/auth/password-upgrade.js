import { updateUserPassword } from './repository.js';
import {
  hashPassword,
  normalizePbkdf2Iterations,
  randomSalt,
  resolvePbkdf2TargetIterations,
  verifyPassword,
} from '../../lib/security/hash.js';

export async function verifyAndMaybeUpgradePassword(env, user, password, email = '') {
  const storedIterations = normalizePbkdf2Iterations(user?.password_iterations, 10000);
  const passwordValid = await verifyPassword(password, user.password_salt, user.password_hash, storedIterations);
  if (!passwordValid) {
    return { ok: false };
  }

  const targetIterations = resolvePbkdf2TargetIterations(env);
  if (storedIterations >= targetIterations) {
    return { ok: true };
  }

  try {
    const upgradedSalt = randomSalt();
    const upgradedHash = await hashPassword(password, upgradedSalt, targetIterations);
    await updateUserPassword(env, {
      userId: user.id,
      passwordHash: upgradedHash,
      passwordSalt: upgradedSalt,
      passwordIterations: targetIterations,
    });
  } catch (error) {
    console.warn(
      `[AUTH_REHASH_WARNING] userId=${user.id} email=${email} gagal rehash password ke iterasi ${targetIterations}: ${
        error?.message || error
      }`
    );
  }

  return { ok: true };
}

export async function buildPasswordCredential(env, password) {
  const passwordIterations = resolvePbkdf2TargetIterations(env);
  const passwordSalt = randomSalt();
  const passwordHash = await hashPassword(password, passwordSalt, passwordIterations);
  return {
    passwordHash,
    passwordSalt,
    passwordIterations,
  };
}

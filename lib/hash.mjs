// Salted scrypt hashing for PINs and admin passwords.
import crypto from 'node:crypto';

const KEYLEN = 64;

/** @param {string} secret */
export function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(secret), salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** @param {string} secret @param {string} stored */
export function verifySecret(secret, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(secret), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// Spend the same time as a real check when an account doesn't exist, so response
// times don't reveal which staff numbers or usernames are valid.
const DUMMY = hashSecret('not-a-real-secret');
/** @param {string} secret */
export function burnTime(secret) {
  verifySecret(secret, DUMMY);
}

/** @param {unknown} a @param {unknown} b */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

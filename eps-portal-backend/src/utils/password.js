import bcrypt from 'bcryptjs';
import { isWerkzeugHash, verifyWerkzeug } from './legacyHash.js';

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

// Accepts bcrypt (new) and Werkzeug (migrated) hashes. Legacy hashes are upgraded to bcrypt on next login.
export function checkPassword(stored, plain) {
  if (isWerkzeugHash(stored)) {
    const ok = verifyWerkzeug(stored, plain);
    return { ok, needsRehash: ok };
  }
  return { ok: bcrypt.compareSync(plain, stored), needsRehash: false };
}

// For a bulk import: a lower cost and no blocking, because hundreds are hashed in one request.
// It is only for temporary passwords, which are random and are replaced at the first sign-in.
export const hashTempPassword = (plain) => bcrypt.hash(plain, 8);

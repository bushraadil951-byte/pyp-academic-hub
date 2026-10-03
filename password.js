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

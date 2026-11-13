import crypto from 'node:crypto';

// Rules for passwords people choose themselves (change-password).
// `email` is theirs: a password that is just its first part (asha.khan for asha.khan@e-p-s.in) is refused.
export function passwordProblem(pw, email = '') {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Include at least one letter and one number.';
  const name = String(email || '').split('@')[0].toLowerCase();
  if (name && pw.toLowerCase() === name) return 'Your password cannot be the same as your email address.';
  return null;
}

// One-time temporary password shown to an admin/teacher when they add someone or reset a password. No look-alike characters (0/O, 1/l/I).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export function generateTempPassword(length = 10) {
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!passwordProblem(out)) return out;
  }
}

import crypto from 'node:crypto';

// Rules for passwords people choose themselves (reset and change-password).
export function passwordProblem(pw, username = '') {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Include at least one letter and one number.';
  if (username && pw.toLowerCase() === String(username).toLowerCase()) return 'Your password cannot be the same as your username.';
  return null;
}

// One-time temporary password shown to an admin/teacher after a reset. No look-alike characters (0/O, 1/l/I).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export function generateTempPassword(length = 10) {
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!passwordProblem(out)) return out;
  }
}

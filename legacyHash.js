// Verifies password hashes created by Flask/Werkzeug so existing users can log in after migration.
//   pbkdf2:sha256:10000$<salt>$<hex>      (what app.py writes)
//   scrypt:32768:8:1$<salt>$<hex>         (Werkzeug 3 default, used by some seeded rows)
import crypto from 'node:crypto';

const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

export function isWerkzeugHash(stored) {
  return /^(pbkdf2|scrypt):/.test(stored);
}

export function verifyWerkzeug(stored, plain) {
  const [method, salt, hex] = stored.split('$');
  if (!method || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const [kind, ...args] = method.split(':');
  try {
    if (kind === 'pbkdf2') {
      const [digest = 'sha256', iterations = '600000'] = args;
      const derived = crypto.pbkdf2Sync(plain, salt, Number(iterations), expected.length, digest);
      return safeEq(derived, expected);
    }
    if (kind === 'scrypt') {
      const [N, r, p] = args.map(Number);
      const derived = crypto.scryptSync(plain, salt, expected.length, { N, r, p, maxmem: 256 * N * r });
      return safeEq(derived, expected);
    }
  } catch { /* fall through */ }
  return false;
}

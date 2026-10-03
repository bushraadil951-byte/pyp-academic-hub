import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { checkPassword, hashPassword } from '../utils/password.js';
import { clearSession, requireAuth, setSession } from '../middleware/auth.js';
import { HttpError, str, wrap } from '../utils/helpers.js';

const router = Router();
export const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, grade: u.grade ?? null });

// 10 attempts per 15 minutes per IP; the old Flask login had no throttle.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' } });

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const username = str(req.body.username);
  const password = str(req.body.password);
  const user = username ? await User.findOne({ username }) : null;
  const check = user ? checkPassword(user.password, password) : { ok: false };
  if (!user || !check.ok) throw new HttpError(401, 'Invalid username or password.');
  if (check.needsRehash) { user.password = hashPassword(password); await user.save(); } // upgrade migrated Werkzeug hashes
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.get('/me', requireAuth(), wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Please sign in.');
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (_req, res) => { clearSession(res); res.json({}); });

export default router;

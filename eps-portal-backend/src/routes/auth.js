import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { checkPassword, hashPassword } from '../utils/password.js';
import { clearSession, cookieOpts, requireAuth, setSession } from '../middleware/auth.js';
import { checkClaims, fetchGoogleClaims, googleAuthUrl, googleEnabled, randomToken } from '../utils/googleAuth.js';
import { HttpError, str, wrap } from '../utils/helpers.js';
import { rulesOf } from '../utils/teacherAccess.js';

const router = Router();
// `mustChange` is false after a Google sign-in, even while the temporary password has not been replaced yet.
export const publicUser = (u) => ({
  id: u.id, name: u.name, role: u.role, grade: u.grade ?? null,
  viewGrades: u.role === 'teacher' ? [...new Set(rulesOf(u).map((r) => r.grade))] : [],
  email: u.email ?? null, mustChange: !!u.mustChangePassword,
});

// 10 attempts per 15 minutes per IP; the old Flask login had no throttle.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' } });

// What the sign-in page should offer.
router.get('/options', (_req, res) => res.json({ google: googleEnabled(), domain: config.google.allowedDomain }));

// People sign in with their school email, the same address their Google account uses.
router.post('/login', loginLimiter, wrap(async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = str(req.body.password);
  const user = email ? await User.findOne({ email }) : null;
  const check = user ? checkPassword(user.password, password) : { ok: false };
  if (!user || !check.ok) throw new HttpError(401, 'Invalid email or password.');
  if (check.needsRehash) { user.password = hashPassword(password); await user.save(); } // upgrade migrated Werkzeug hashes
  setSession(res, user);
  res.json({ user: publicUser(user) });   // user.mustChange === true -> the app sends them to "Set a new password"
}));

// ── Sign in with Google ─────────────────────────────────────────────────────
const GOOGLE_COOKIE = 'eps_google';
const googleCookieOpts = () => ({ ...cookieOpts(), path: '/api/auth/google' });
// Generous: a whole school can share one IP address, and each sign-in makes two requests.
const googleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' } });
const backToLogin = (res, error) => res.redirect(`${config.appUrl}/?error=${error}`);

router.get('/google/start', googleLimiter, (_req, res) => {
  if (!googleEnabled()) return backToLogin(res, 'google_off');
  const state = randomToken(); const nonce = randomToken();
  res.cookie(GOOGLE_COOKIE, JSON.stringify({ state, nonce }), { ...googleCookieOpts(), maxAge: 10 * 60 * 1000 });
  res.redirect(googleAuthUrl(state, nonce));
});

router.get('/google/callback', googleLimiter, wrap(async (req, res) => {
  let saved = {};
  try { saved = JSON.parse(req.cookies?.[GOOGLE_COOKIE] || '{}'); } catch { /* treated as a missing cookie below */ }
  res.clearCookie(GOOGLE_COOKIE, googleCookieOpts());
  const state = str(req.query.state); const code = str(req.query.code);

  if (!googleEnabled() || !saved.state || state !== saved.state) return backToLogin(res, 'google_failed');
  if (req.query.error || !code) return backToLogin(res, 'google_cancelled');

  let claims;
  try { claims = await fetchGoogleClaims(code); } catch (e) { console.error('[google]', e.message); return backToLogin(res, 'google_failed'); }
  const email = checkClaims(claims, saved.nonce);
  if (!email) return backToLogin(res, 'not_school_account');

  const user = await User.findOne({ email });        // no account is ever created here: an admin must add the person first
  if (!user) return backToLogin(res, 'not_added');

  setSession(res, user, 'google');                   // a temporary password stays valid, and must be replaced when it is used
  res.redirect(`${config.appUrl}/portal`);
}));

router.get('/me', requireAuth(), wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Please sign in.');
  res.json({ user: publicUser(user, req.user.mustChange) });
}));

router.post('/logout', (_req, res) => { clearSession(res); res.json({}); });

export default router;

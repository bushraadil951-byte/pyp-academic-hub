// Password management: forgot password (one-time code by email), change password, and admin/teacher reset.
import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { OneTimeCode } from '../models/OneTimeCode.js';
import { requireAuth, setSession } from '../middleware/auth.js';
import { checkPassword, hashPassword } from '../utils/password.js';
import { generateTempPassword, passwordProblem } from '../utils/passwordPolicy.js';
import { passwordChangedEmail, resetCodeEmail, sendMail } from '../utils/mailer.js';
import { config } from '../config.js';
import { HttpError, bad, cleanEmail, notFound, oid, str, wrap } from '../utils/helpers.js';
import { publicUser } from './auth.js';

const router = Router();

const CODE_MINUTES = 10;       // how long a code works
const MAX_ATTEMPTS = 5;        // wrong guesses before the code is dead
const RESEND_SECONDS = 60;     // minimum gap between codes for one account
const limiter = (max, error) => rateLimit({ windowMs: 15 * 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false, message: { error } });

const hashCode = (code) => crypto.createHmac('sha256', config.jwtSecret).update(code).digest('hex');
const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ── Forgot password, step 1: email a one-time code ──────────────────────────
// The answer is identical whether or not the username exists or has an email, so it cannot be used to find accounts.
const SENT = `If that username has an email address on file, a 6-digit code has been sent to it. It is valid for ${CODE_MINUTES} minutes. No email? Ask your teacher or the school office to reset your password.`;

router.post('/forgot', limiter(5, 'Too many requests. Please wait a few minutes and try again.'), wrap(async (req, res) => {
  const username = str(req.body.username);
  const user = username ? await User.findOne({ username }) : null;
  if (user?.email) {
    const recent = await OneTimeCode.exists({ user: user._id, purpose: 'reset', createdAt: { $gt: new Date(Date.now() - RESEND_SECONDS * 1000) } });
    if (!recent) {
      const code = newCode();
      await OneTimeCode.deleteMany({ user: user._id, purpose: 'reset' });   // only the newest code works
      await OneTimeCode.create({ user: user._id, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) });
      sendMail({ to: user.email, ...resetCodeEmail(code, CODE_MINUTES) });   // not awaited: same response time either way
    }
  }
  res.json({ message: SENT });
}));

// ── Forgot password, step 2: code + new password ────────────────────────────
router.post('/reset', limiter(10, 'Too many attempts. Please wait a few minutes and try again.'), wrap(async (req, res) => {
  const username = str(req.body.username);
  const code = str(req.body.code).replace(/\s/g, '');
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const invalid = new HttpError(400, 'That code is invalid or has expired. Request a new one.');

  const user = username ? await User.findOne({ username }) : null;
  if (!user || !/^\d{6}$/.test(code)) throw invalid;
  const rec = await OneTimeCode.findOne({ user: user._id, purpose: 'reset' });
  if (!rec || rec.expiresAt < new Date() || rec.attempts >= MAX_ATTEMPTS) throw invalid;
  if (!sameHash(hashCode(code), rec.codeHash)) { rec.attempts += 1; await rec.save(); throw invalid; }

  const problem = passwordProblem(newPassword, user.username);
  if (problem) throw bad(problem);                                           // the code stays valid so they can retry

  user.password = hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();                                       // signs out every older session
  await user.save();
  await OneTimeCode.deleteMany({ user: user._id });
  if (user.email) sendMail({ to: user.email, ...passwordChangedEmail() });
  res.json({ message: 'Your password has been reset. You can now sign in.' });
}));

// ── Signed-in user changes their own password (also the forced first-login change) ──
router.post('/change-password', limiter(10, 'Too many attempts. Please wait a few minutes and try again.'), requireAuth(), wrap(async (req, res) => {
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Please sign in.');
  if (!checkPassword(user.password, current).ok) throw bad('Your current password is not correct.');
  if (next === current) throw bad('Choose a password different from the current one.');
  const problem = passwordProblem(next, user.username);
  if (problem) throw bad(problem);

  if ('email' in req.body) user.email = cleanEmail(req.body.email);         // optional recovery email
  user.password = hashPassword(next);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();
  setSession(res, user);                                                     // fresh session; older ones are now invalid
  if (user.email) sendMail({ to: user.email, ...passwordChangedEmail() });
  res.json({ user: publicUser(user) });
}));

// ── Admin (any teacher or student) or teacher (students in their own grade): issue a temporary password ──
router.post('/admin-reset/:id', requireAuth(ROLES.ADMIN, ROLES.TEACHER), wrap(async (req, res) => {
  const target = await User.findById(oid(req.params.id));
  if (!target) throw notFound('User not found.');
  if (target.id === req.user.id) throw bad('Use "Change password" for your own account.');
  if (req.user.role === ROLES.TEACHER) {
    const me = await User.findById(req.user.id).select('grade');
    if (target.role !== ROLES.STUDENT || !me?.grade || target.grade !== me.grade) throw new HttpError(403, 'You can only reset passwords for students in your own grade.');
  } else if (target.role === ROLES.ADMIN) {
    throw new HttpError(403, 'Administrator passwords cannot be reset here.');
  }
  const tempPassword = generateTempPassword();
  target.password = hashPassword(tempPassword);
  target.mustChangePassword = true;                                          // they must choose their own at next sign-in
  target.passwordChangedAt = new Date();
  await target.save();
  await OneTimeCode.deleteMany({ user: target._id });
  res.json({ name: target.name, username: target.username, tempPassword });  // shown once; never stored in plain text
}));

export default router;

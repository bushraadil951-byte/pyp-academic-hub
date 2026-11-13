// Password management: change your own password (also the forced first-login change), and admin/teacher reset.
// There is no self-service reset: someone who forgets their password asks an admin, who issues a temporary one.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { requireAuth, setSession } from '../middleware/auth.js';
import { checkPassword, hashPassword } from '../utils/password.js';
import { generateTempPassword, passwordProblem } from '../utils/passwordPolicy.js';
import { passwordChangedEmail, sendMail } from '../utils/mailer.js';
import { HttpError, bad, notFound, oid, wrap } from '../utils/helpers.js';
import { publicUser } from './auth.js';

const router = Router();

const limiter = (max, error) => rateLimit({ windowMs: 15 * 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false, message: { error } });

// ── Signed-in user changes their own password (also the forced first-login change) ──
router.post('/change-password', limiter(10, 'Too many attempts. Please wait a few minutes and try again.'), requireAuth(), wrap(async (req, res) => {
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Please sign in.');
  if (!checkPassword(user.password, current).ok) throw bad('Your current password is not correct.');
  if (next === current) throw bad('Choose a password different from the current one.');
  const problem = passwordProblem(next, user.email);
  if (problem) throw bad(problem);

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
  res.json({ name: target.name, email: target.email ?? null, tempPassword });  // shown once; never stored in plain text
}));

export default router;

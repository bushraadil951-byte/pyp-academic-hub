import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/helpers.js';

const COOKIE = 'eps_token';
const cookieOpts = () => ({ httpOnly: true, secure: config.isProd || config.sameSite === 'none', sameSite: config.sameSite });

export function setSession(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, config.jwtSecret, { expiresIn: '12h' });
  res.cookie(COOKIE, token, { ...cookieOpts(), maxAge: 12 * 60 * 60 * 1000 });
}

export const clearSession = (res) => res.clearCookie(COOKIE, cookieOpts());

// Routes a user may still call while they are required to change their password.
const ALLOWED_WHILE_MUST_CHANGE = new Set(['/api/auth', '/api/account']);

// Equivalent of Flask's @login_required(role). Pass no roles to allow any signed-in user.
// Reads the user fresh from the database so that a password change or reset signs out older sessions,
// and so that "must change password" cannot be skipped by calling the API directly.
export function requireAuth(...roles) {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.[COOKIE];
      if (!token) throw new HttpError(401, 'Please sign in.');
      let payload;
      try { payload = jwt.verify(token, config.jwtSecret); } catch { throw new HttpError(401, 'Session expired. Please sign in again.'); }

      const u = await User.findById(payload.id).select('name role mustChangePassword passwordChangedAt').lean();
      if (!u) throw new HttpError(401, 'Please sign in.');
      if (u.passwordChangedAt && payload.iat * 1000 + 1000 < u.passwordChangedAt.getTime()) {
        throw new HttpError(401, 'Your password was changed. Please sign in again.');
      }
      req.user = { id: String(u._id), role: u.role, name: u.name, mustChange: !!u.mustChangePassword };

      if (req.user.mustChange && !ALLOWED_WHILE_MUST_CHANGE.has(req.baseUrl)) {
        throw new HttpError(403, 'You must change your password before continuing.', 'PASSWORD_CHANGE_REQUIRED');
      }
      if (roles.length && !roles.includes(req.user.role)) throw new HttpError(403, 'You do not have access to this page.');
      next();
    } catch (e) { next(e); }
  };
}

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/helpers.js';

const COOKIE = 'eps_token';
const cookieOpts = () => ({ httpOnly: true, secure: config.isProd || config.sameSite === 'none', sameSite: config.sameSite });

export function setSession(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, config.jwtSecret, { expiresIn: '12h' });
  res.cookie(COOKIE, token, { ...cookieOpts(), maxAge: 12 * 60 * 60 * 1000 });
}

export const clearSession = (res) => res.clearCookie(COOKIE, cookieOpts());

// Equivalent of Flask's @login_required(role). Pass no roles to allow any signed-in user.
export function requireAuth(...roles) {
  return (req, _res, next) => {
    const token = req.cookies?.[COOKIE];
    if (!token) return next(new HttpError(401, 'Please sign in.'));
    try {
      req.user = jwt.verify(token, config.jwtSecret);
    } catch {
      return next(new HttpError(401, 'Session expired. Please sign in again.'));
    }
    if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this page.'));
    next();
  };
}

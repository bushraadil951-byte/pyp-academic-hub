import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/helpers.js';

const COOKIE = 'eps_token';
const cookieOpts = () => ({ httpOnly: true, secure: config.isProd || config.sameSite === 'none', sameSite: config.sameSite });

export function setSession(res, user) {
  const token = jwt.sign({
    id: user.id,
    role: user.role,
    name: user.name,
    grade: user.grade || null,
    section: user.section || null,
    viewGrade: user.viewGrade || null,
    viewSection: user.viewSection || null,
    editSection: user.editSection || null,
  }, config.jwtSecret, { expiresIn: '12h' });
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
// Check teacher viewing permission (All grades / All sections = null / empty)
export function requireViewAccess(getGrade = (req) => req.query.grade, getSection = (req) => req.query.section) {
  return (req, _res, next) => {
    if (req.user?.role !== 'teacher') return next();
    const g = getGrade(req);
    const s = getSection(req);
    if (req.user.viewGrade && g && req.user.viewGrade !== g) {
      return next(new HttpError(403, `Access denied: You can only view ${req.user.viewGrade}.`));
    }
    if (req.user.viewSection && s && req.user.viewSection !== s) {
      return next(new HttpError(403, `Access denied: You can only view section ${req.user.viewSection}.`));
    }
    next();
  };
}

// Check teacher editing permission
export function requireEditAccess(getGrade = (req) => req.body.grade || req.query.grade, getSection = (req) => req.body.section || req.query.section) {
  return (req, _res, next) => {
    if (req.user?.role !== 'teacher') return next();
    const g = getGrade(req);
    const s = getSection(req);
    if (req.user.grade && g && req.user.grade !== g) {
      return next(new HttpError(403, `Access denied: You can only edit ${req.user.grade}.`));
    }
    if (req.user.editSection && s && req.user.editSection !== s) {
      return next(new HttpError(403, `Access denied: You can only edit section ${req.user.editSection}.`));
    }
    next();
  };
}

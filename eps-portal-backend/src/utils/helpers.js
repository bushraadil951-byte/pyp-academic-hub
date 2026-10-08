import mongoose from 'mongoose';

export { round1, safeAvg } from './math.js';

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

// Wraps async handlers so thrown errors reach the error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 404 instead of a CastError when an id isn't a valid ObjectId.
export function oid(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  return id;
}

export const str = (v) => (typeof v === 'string' ? v.trim() : '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// '' -> null (no recovery email). Throws a 400 for anything that is not an email address.
export function cleanEmail(v) {
  const e = str(v).toLowerCase();
  if (!e) return null;
  if (e.length > 254 || !EMAIL_RE.test(e)) throw bad('Enter a valid email address.');
  return e;
}

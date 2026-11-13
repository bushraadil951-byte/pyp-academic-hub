// Bulk student upload (CSV rows parsed in the browser): preview, then confirm. Replaces /admin/students/upload in app.py.
import { Router } from 'express';
import { ROLES, config } from '../config.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { hashTempPassword } from '../utils/password.js';
import { generateTempPassword } from '../utils/passwordPolicy.js';
import { usernameFromEmail } from '../utils/username.js';
import { bad, str, wrap } from '../utils/helpers.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailProblem = (email) => {
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'Email address is not valid';
  if (!email.endsWith(`@${config.google.allowedDomain}`)) return `Use an @${config.google.allowedDomain} address`;
  return '';
};

const router = Router();
router.use(requireAuth(ROLES.ADMIN));

const GRADES = ['Nursery', 'KG-1', 'KG-2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const MAX_ROWS = 500;

// "3" -> Grade 3, and "nursery", "KG 1", "kg-2" etc. -> the standard names.
const normGrade = (g) => {
  if (/^\d+$/.test(g)) return `Grade ${g}`;
  const k = g.toLowerCase().replace(/[\s_-]/g, '');
  if (k === 'nursery') return 'Nursery';
  if (k === 'kg1') return 'KG-1';
  if (k === 'kg2') return 'KG-2';
  return g;
};

// Cleans every row, makes a username from the email, and marks each ok | exists | invalid.
async function annotate(input) {
  if (!Array.isArray(input) || input.length === 0) throw bad('No rows to process.');
  if (input.length > MAX_ROWS) throw bad(`Please upload at most ${MAX_ROWS} students at a time.`);
  const existing = await User.find({}, 'username email').lean();
  const taken = new Set(existing.map((u) => u.username));
  const emails = new Set(existing.map((u) => u.email).filter(Boolean));
  const inFile = new Set();

  const rows = input.map((r) => ({
    name: str(r.name), grade: normGrade(str(r.grade)), section: (str(r.section) || 'A').toUpperCase(),
    email: str(r.email).toLowerCase(), username: '', status: 'ok', message: '',
  }));
  for (const r of rows) {
    if (!r.name || !GRADES.includes(r.grade)) { r.status = 'invalid'; r.message = !r.name ? 'Name is required' : 'Grade must be Nursery, KG-1, KG-2 or Grade 1–5'; continue; }
    if (!SECTIONS.includes(r.section)) { r.status = 'invalid'; r.message = 'Section must be A, B, C or D'; continue; }
    if (!r.email) { r.status = 'invalid'; r.message = 'School email is required'; continue; }
    const problem = emailProblem(r.email);
    if (problem) { r.status = 'invalid'; r.message = problem; continue; }
    if (emails.has(r.email)) { r.status = 'exists'; r.message = 'Someone already has this email'; continue; }
    if (inFile.has(r.email)) { r.status = 'exists'; r.message = 'Duplicate email in this file'; continue; }
    inFile.add(r.email);
    r.username = usernameFromEmail(r.email, taken);
    taken.add(r.username);
  }
  return rows;
}

const summary = (rows) => ({ ok: rows.filter((r) => r.status === 'ok').length, exists: rows.filter((r) => r.status === 'exists').length, invalid: rows.filter((r) => r.status === 'invalid').length });

router.post('/preview', wrap(async (req, res) => {
  const rows = await annotate(req.body.rows);
  res.json({ rows, summary: summary(rows) });
}));

router.post('/confirm', wrap(async (req, res) => {
  const rows = await annotate(req.body.rows);
  const good = rows.filter((r) => r.status === 'ok');
  const temps = new Map(good.map((r) => [r.email, generateTempPassword()]));
  const hashes = await Promise.all(good.map((r) => hashTempPassword(temps.get(r.email))));
  const docs = good.map((r, i) => ({
    name: r.name, username: r.username, role: ROLES.STUDENT, grade: r.grade, section: r.section, email: r.email,
    password: hashes[i], mustChangePassword: true,
  }));
  let inserted = [];
  try {
    inserted = await User.insertMany(docs, { ordered: false });
  } catch (e) {                                          // a duplicate sneaked in between preview and confirm
    inserted = e.insertedDocs || [];
    if (!e.writeErrors && e.code !== 11000) throw e;
  }
  const ok = new Set(inserted.map((u) => u.email));
  // The temporary passwords go back once, for the admin's download. They are not stored in plain text.
  const created = good.filter((r) => ok.has(r.email)).map((r) => ({ name: r.name, grade: r.grade, section: r.section, email: r.email, tempPassword: temps.get(r.email) }));
  const skipped = rows.filter((r) => !ok.has(r.email)).map((r) => ({ name: r.name, email: r.email, message: r.message || 'Someone already has this email' }));
  res.json({ added: created.length, created, skipped });
}));

// Admin accounts, for the email template.
router.get('/admins', wrap(async (_req, res) => {
  const rows = await User.find({ role: ROLES.ADMIN }, 'name username email').sort({ name: 1 }).lean();
  res.json(rows.map((u) => ({ name: u.name, username: u.username, email: u.email ?? null })));
}));

// Add or update school emails for people who already exist, including admins (matched by username).
router.post('/emails', wrap(async (req, res) => {
  const input = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (input.length === 0) throw bad('No rows to process.');
  if (input.length > 2000) throw bad('Please upload at most 2000 rows at a time.');
  const owners = new Map((await User.find({ email: { $ne: null } }, 'username email').lean()).map((u) => [u.email, u.username]));
  const ops = []; const invalid = [];
  for (const r of input) {
    const username = str(r.username); const email = str(r.email).toLowerCase();
    if (!username) continue;
    if (!email) { invalid.push({ username, message: 'Email is empty' }); continue; }
    const problem = emailProblem(email);
    if (problem) { invalid.push({ username, message: problem }); continue; }
    if (owners.has(email) && owners.get(email) !== username) { invalid.push({ username, message: `${email} already belongs to ${owners.get(email)}` }); continue; }
    owners.set(email, username);                         // also catches the same address twice in one file
    ops.push({ updateOne: { filter: { username }, update: { $set: { email } } } });
  }
  const usernames = [...new Set(ops.map((o) => o.updateOne.filter.username))];
  const found = new Set((await User.find({ username: { $in: usernames } }, 'username').lean()).map((u) => u.username));
  if (ops.length) await User.bulkWrite(ops, { ordered: false });
  res.json({ updated: found.size, notFound: usernames.filter((u) => !found.has(u)), invalid });
}));

export default router;

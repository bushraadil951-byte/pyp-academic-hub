// Bulk student upload (CSV rows parsed in the browser): preview, then confirm. Replaces /admin/students/upload in app.py.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { bad, str, wrap } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth(ROLES.ADMIN));

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const MAX_ROWS = 500;

const digits = (s) => s.replace(/[^0-9]/g, '');
const normGrade = (g) => (/^\d+$/.test(g) ? `Grade ${g}` : g);
const generateUsername = (name, grade, taken) => {
  const first = (name.split(/\s+/)[0] || 'student').toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
  const base = `${first}_g${digits(grade)}`;
  let username = base; let n = 1;
  while (taken.has(username)) { username = `${base}${n}`; n += 1; }
  return username;
};
const generatePassword = (name, grade) => {
  const first3 = name.slice(0, 3);
  return `EPS@${first3.charAt(0).toUpperCase()}${first3.slice(1).toLowerCase()}${digits(grade)}`;
};

// Cleans every row, fills in missing usernames/passwords, and marks each ok | exists | invalid.
async function annotate(input) {
  if (!Array.isArray(input) || input.length === 0) throw bad('No rows to process.');
  if (input.length > MAX_ROWS) throw bad(`Please upload at most ${MAX_ROWS} students at a time.`);
  const taken = new Set((await User.find({}, 'username').lean()).map((u) => u.username));
  const inDb = new Set(taken);

  const rows = input.map((r) => ({
    name: str(r.name), grade: normGrade(str(r.grade)), section: (str(r.section) || 'A').toUpperCase(),
    username: str(r.username), password: str(r.password), status: 'ok', message: '',
  }));
  // Reserve usernames the admin typed first, so generated ones never collide with them.
  for (const r of rows) {
    if (!r.username) continue;
    if (inDb.has(r.username)) { r.status = 'exists'; r.message = 'Username already exists'; }
    else if (taken.has(r.username)) { r.status = 'exists'; r.message = 'Duplicate username in this file'; }
    else taken.add(r.username);
  }
  for (const r of rows) {
    if (!r.name || !GRADES.includes(r.grade)) { r.status = 'invalid'; r.message = !r.name ? 'Name is required' : 'Grade must be Grade 1–5'; continue; }
    if (!SECTIONS.includes(r.section)) { r.status = 'invalid'; r.message = 'Section must be A, B, C or D'; continue; }
    if (!r.username) { r.username = generateUsername(r.name, r.grade, taken); taken.add(r.username); }
    if (!/^[A-Za-z0-9._@-]{3,50}$/.test(r.username)) { r.status = 'invalid'; r.message = 'Username: 3–50 letters, numbers or . _ @ -'; continue; }
    if (!r.password) r.password = generatePassword(r.name, r.grade);
    if (r.password.length < 6) { r.status = 'invalid'; r.message = 'Password needs at least 6 characters'; }
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
  const created = [];
  for (let i = 0; i < good.length; i += 20) {            // hash in small batches so the server stays responsive
    const chunk = good.slice(i, i + 20);
    const docs = await Promise.all(chunk.map(async (r) => ({
      name: r.name, username: r.username, role: ROLES.STUDENT, grade: r.grade, section: r.section, password: await bcrypt.hash(r.password, 10),
    })));
    try {
      const inserted = await User.insertMany(docs, { ordered: false });
      const ok = new Set(inserted.map((u) => u.username));
      for (const r of chunk) if (ok.has(r.username)) created.push({ name: r.name, grade: r.grade, section: r.section, username: r.username, password: r.password });
    } catch (e) {                                          // a duplicate sneaked in between preview and confirm
      const ok = new Set((e.insertedDocs || []).map((u) => u.username));
      for (const r of chunk) if (ok.has(r.username)) created.push({ name: r.name, grade: r.grade, section: r.section, username: r.username, password: r.password });
      if (!e.writeErrors && e.code !== 11000) throw e;
    }
  }
  const createdNames = new Set(created.map((c) => c.username));
  const skipped = rows.filter((r) => !createdNames.has(r.username) || r.status !== 'ok').map((r) => ({ name: r.name, username: r.username, message: r.message || 'Username already exists' }));
  res.json({ added: created.length, created, skipped });
}));

export default router;

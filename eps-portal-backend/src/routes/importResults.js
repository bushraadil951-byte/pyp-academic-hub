// Import mock test results from a CSV (e.g. a Google Form export): preview first, then save.
// Replaces /admin/import-results in app.py. Scores are always calculated on the server from the raw answers.
import { Router } from 'express';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { MockTest } from '../models/MockTest.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateRow } from '../utils/resultsImport.js';
import { bad, notFound, oid, str, wrap } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth(ROLES.ADMIN));
const MAX_ROWS = 1000;

// rows: [{ username, answers: { q1: 'A', q2: 'C', ... } }]
async function evaluate(testId, rows) {
  const test = await MockTest.findById(oid(testId));
  if (!test) throw notFound('Test not found.');
  if (test.questions.length === 0) throw bad('This test has no questions yet. Add questions first.');
  if (!Array.isArray(rows) || rows.length === 0) throw bad('No rows to import.');
  if (rows.length > MAX_ROWS) throw bad(`Please import at most ${MAX_ROWS} students at a time.`);

  const usernames = [...new Set(rows.map((r) => str(r.username)).filter(Boolean))];
  const users = await User.find({ username: { $in: usernames }, role: ROLES.STUDENT }).select('name username grade').lean();
  const byName = new Map(users.map((u) => [u.username, u]));
  const done = new Set((await TestResult.find({ test: test._id, student: { $in: users.map((u) => u._id) } }).select('student').lean()).map((r) => String(r.student)));

  const ready = []; const errors = []; const seen = new Set();
  for (const row of rows) {
    const username = str(row.username);
    if (!username) continue;
    const u = byName.get(username);
    if (!u) { errors.push(`'${username}' was not found as a student: skipped`); continue; }
    if (seen.has(username)) { errors.push(`${username} appears more than once in the file: the repeat was skipped`); continue; }
    seen.add(username);
    if (done.has(String(u._id))) { errors.push(`${username} already has a result for this test: skipped`); continue; }
    const ev = evaluateRow(test.questions, row.answers || {});
    const gradeMismatch = test.grade !== 'All Grades' && u.grade !== test.grade;
    ready.push({
      studentId: String(u._id), username, name: u.name, grade: u.grade,
      score: ev.score, total: ev.total, percent: ev.percent, blank: ev.blank, unreadable: ev.unreadable,
      warning: gradeMismatch ? `${u.grade} student, but this test is for ${test.grade}` : '',
      _save: { answers: ev.answers, sectionScores: ev.sectionScores },
    });
  }
  return { test, ready, errors };
}

const testInfo = (t) => ({ id: t.id, name: t.name, subject: t.subject, grade: t.grade, questions: t.questions.length });

router.post('/preview', wrap(async (req, res) => {
  const { test, ready, errors } = await evaluate(req.body.testId, req.body.rows);
  res.json({ test: testInfo(test), rows: ready.map(({ _save, ...r }) => r), errors });
}));

router.post('/confirm', wrap(async (req, res) => {
  const { test, ready, errors } = await evaluate(req.body.testId, req.body.rows);
  let added = 0;
  for (const r of ready) {
    try {
      await TestResult.create({ student: r.studentId, test: test._id, score: r.score, total: r.total, percent: r.percent, timeTaken: 0, ...r._save });
      added += 1;
    } catch (e) {
      if (e.code === 11000) { errors.push(`${r.username} already has a result for this test: skipped`); continue; }   // saved by someone else a moment ago
      throw e;
    }
  }
  res.json({ added, errors, test: testInfo(test) });
}));
export default router;

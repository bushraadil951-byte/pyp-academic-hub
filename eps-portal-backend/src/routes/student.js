import { Router } from 'express';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { MockTest } from '../models/MockTest.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { scoreAttempt } from '../utils/scoring.js';
import { HttpError, notFound, oid, safeAvg, wrap } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth(ROLES.STUDENT));

const me = async (req) => {
  const s = await User.findById(req.user.id);
  if (!s) throw new HttpError(401, 'Please sign in.');
  return s;
};
const visibleTests = (student) => MockTest.find({ status: 'active', grade: { $in: [student.grade, 'All Grades'] } }).sort({ created: -1 });
const resultRow = (r) => ({
  id: String(r._id), test: r.test?.name ?? '(deleted test)', subject: r.test?.subject ?? '', score: r.score, total: r.total, percent: r.percent, takenAt: r.takenAt,
});
const myResults = (id) => TestResult.find({ student: id }).sort({ takenAt: -1 }).populate('test', 'name subject').lean();

router.get('/dashboard', wrap(async (req, res) => {
  const student = await me(req);
  const [tests, results] = await Promise.all([visibleTests(student), myResults(student._id)]);
  res.json({
    student: { id: student.id, name: student.name, grade: student.grade, section: student.section },
    tests: tests.map((t) => ({ id: t.id, name: t.name, subject: t.subject, difficulty: t.difficulty, duration: t.duration })),
    completedTestIds: results.map((r) => String(r.test?._id ?? r.test)),
    avg: safeAvg(results.map((r) => r.percent)),
    results: results.map(resultRow),
  });
}));

router.get('/scores', wrap(async (req, res) => {
  res.json((await myResults(req.user.id)).map(resultRow));
}));

// Questions are sent WITHOUT the answer key.
router.get('/tests/:id', wrap(async (req, res) => {
  const student = await me(req);
  const test = await MockTest.findById(oid(req.params.id));
  if (!test || test.status !== 'active' || ![student.grade, 'All Grades'].includes(test.grade)) throw notFound('Test not found.');
  if (await TestResult.exists({ student: student._id, test: test._id })) throw new HttpError(409, 'You have already completed this test.');
  res.json({
    test: { id: test.id, name: test.name, duration: test.duration },
    questions: test.questions.map(({ id, section, passage, question, options, image }) => ({ id, section, passage, question, options, image })),
  });
}));

const attemptJson = (r) => ({ score: r.score, total: r.total, percent: r.percent, section_scores: r.sectionScores });

router.post('/tests/:id/submit', wrap(async (req, res) => {
  const student = await me(req);
  const test = await MockTest.findById(oid(req.params.id));
  if (!test || test.status !== 'active' || ![student.grade, 'All Grades'].includes(test.grade)) throw notFound('Test not found.');

  const existing = await TestResult.findOne({ student: student._id, test: test._id });
  if (existing) return res.json(attemptJson(existing)); // idempotent, like the Flask route

  const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const timeTaken = Math.max(0, Math.min(Number(req.body?.time_taken) || 0, 24 * 3600));
  const scored = scoreAttempt(test.questions, answers);
  try {
    const r = await TestResult.create({ student: student._id, test: test._id, answers, timeTaken, ...scored });
    res.json(attemptJson(r));
  } catch (e) {
    if (e.code === 11000) return res.json(attemptJson(await TestResult.findOne({ student: student._id, test: test._id }))); // double-submit race
    throw e;
  }
}));

router.get('/results/:id', wrap(async (req, res) => {
  const result = await TestResult.findById(oid(req.params.id)).populate('test');
  if (!result || !result.test) throw notFound('Result not found.');
  if (String(result.student) !== req.user.id) throw new HttpError(403, 'Access denied.');
  const given = result.answers || {};
  const review = result.test.questions.map((q) => {
    const g = given[String(q.id)];
    const hasAnswer = g !== undefined && g !== null;
    return {
      question: q, given: hasAnswer ? Number(g) : null, correct: q.answer,
      status: !hasAnswer ? 'unattempted' : Number(g) === q.answer ? 'correct' : 'wrong',
    };
  });
  res.json({
    test: { id: result.test.id, name: result.test.name, subject: result.test.subject },
    result: { id: result.id, score: result.score, total: result.total, percent: result.percent, takenAt: result.takenAt },
    review,
  });
}));

export default router;

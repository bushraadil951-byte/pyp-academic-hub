import { Router } from 'express';
import { ROLES, GRADES } from '../config.js';
import { User } from '../models/User.js';
import { MockTest } from '../models/MockTest.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { hashPassword } from '../utils/password.js';
import { scoreAttempt } from '../utils/scoring.js';
import { HttpError, bad, notFound, oid, safeAvg, str, wrap } from '../utils/helpers.js';

const DT_GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
const SUBJECTS = ['English', 'Mathematics', 'Science', 'Reasoning'];
const MAX_IMAGE_CHARS = 2.8e6; // ~2 MB of binary once base64-encoded

const router = Router();
router.use(requireAuth(ROLES.ADMIN));

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', wrap(async (_req, res) => {
  const [studentCount, activeTests, results] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT }),
    MockTest.countDocuments({ status: 'active' }),
    TestResult.find().sort({ takenAt: -1 }).populate('student', 'name grade').populate('test', 'name subject').lean(),
  ]);
  const live = results.filter((r) => r.student && r.test); // ignore orphans
  const avgBy = (key, values, pick) => values.map((v) => ({ [key]: v, avg: safeAvg(live.filter((r) => pick(r) === v).map((r) => r.percent)) }));
  res.json({
    studentCount,
    activeTests,
    avgScore: safeAvg(live.map((r) => r.percent)),
    submitted: live.length,
    byGrade: avgBy('grade', GRADES, (r) => r.student.grade),
    bySubject: avgBy('subject', SUBJECTS, (r) => r.test.subject),
    recent: live.slice(0, 8).map((r) => ({
      id: String(r._id), student: r.student.name, test: r.test.name, subject: r.test.subject, percent: r.percent, takenAt: r.takenAt,
    })),
  });
}));

// ── Students & teachers (same shape, one factory) ────────────────────────────
const personJson = (u) => ({ id: u.id, name: u.name, username: u.username, grade: u.grade ?? null, section: u.section ?? null });

function peopleRoutes(role) {
  const isStudent = role === ROLES.STUDENT;
  const label = isStudent ? 'Student' : 'Teacher';
  const r = Router();

  r.get('/', wrap(async (_req, res) => {
    const rows = await User.find({ role }).sort({ grade: 1, name: 1 });
    res.json(rows.map(personJson));
  }));

  r.post('/', wrap(async (req, res) => {
    const name = str(req.body.name), username = str(req.body.username), password = str(req.body.password);
    const grade = str(req.body.grade) || null;
    if (!name || !username || !password) throw bad('Name, username and password are required.');
    if (isStudent && !DT_GRADES.includes(grade)) throw bad('Choose a grade.');
    if (await User.exists({ username })) throw new HttpError(409, 'Username already exists.');
    const user = await User.create({
      name, username, role, grade, password: hashPassword(password),
      section: isStudent ? (str(req.body.section) || 'A') : null,
    });
    res.status(201).json(personJson(user));
  }));

  r.put('/:id', wrap(async (req, res) => {
    const user = await User.findOne({ _id: oid(req.params.id), role });
    if (!user) throw notFound(`${label} not found.`);
    if (str(req.body.name)) user.name = str(req.body.name);
    user.grade = str(req.body.grade) || null;
    if (isStudent) user.section = str(req.body.section) || 'A';
    if (str(req.body.password)) user.password = hashPassword(str(req.body.password));
    await user.save();
    res.json(personJson(user));
  }));

  r.delete('/:id', wrap(async (req, res) => {
    const user = await User.findOneAndDelete({ _id: oid(req.params.id), role });
    if (!user) throw notFound(`${label} not found.`);
    if (isStudent) await TestResult.deleteMany({ student: user._id }); // cascade, as in SQLAlchemy
    res.json({});
  }));
  return r;
}
router.use('/students', peopleRoutes(ROLES.STUDENT));
router.use('/teachers', peopleRoutes(ROLES.TEACHER));

// ── Tests ────────────────────────────────────────────────────────────────────
const testJson = (t) => ({
  id: t.id, name: t.name, subject: t.subject, grade: t.grade, mockNumber: t.mockNumber ?? null, difficulty: t.difficulty,
  duration: t.duration, status: t.status, questionCount: t.questions.length,
});

function testFields(b) {
  const name = str(b.name);
  if (!name) throw bad('Test name is required.');
  if (!SUBJECTS.includes(b.subject)) throw bad('Choose a valid subject.');
  if (![...GRADES, 'All Grades'].includes(b.grade)) throw bad('Choose a valid grade.');
  const duration = Number(b.duration);
  if (!Number.isFinite(duration) || duration < 1) throw bad('Duration must be at least 1 minute.');
  let mockNumber = null;                         // IBT Mock 1-5; empty = not numbered
  if (b.mockNumber !== undefined && b.mockNumber !== null && b.mockNumber !== '') {
    mockNumber = Number(b.mockNumber);
    if (!Number.isInteger(mockNumber) || mockNumber < 1 || mockNumber > 5) throw bad('Choose IBT Mock 1 to 5.');
  }
  return { name, subject: b.subject, grade: b.grade, mockNumber, difficulty: str(b.difficulty) || 'Medium', duration, status: b.status === 'active' ? 'active' : 'draft' };
}

router.get('/tests', wrap(async (_req, res) => {
  res.json((await MockTest.find().sort({ created: -1 })).map(testJson));
}));

router.post('/tests', wrap(async (req, res) => {
  res.status(201).json(testJson(await MockTest.create(testFields(req.body))));
}));

router.put('/tests/:id', wrap(async (req, res) => {
  const t = await MockTest.findById(oid(req.params.id));
  if (!t) throw notFound('Test not found.');
  Object.assign(t, testFields({ ...testJson(t), ...req.body }));
  await t.save();
  res.json(testJson(t));
}));

router.delete('/tests/:id', wrap(async (req, res) => {
  const t = await MockTest.findByIdAndDelete(oid(req.params.id));
  if (!t) throw notFound('Test not found.');
  await TestResult.deleteMany({ test: t._id });
  res.json({});
}));

router.post('/tests/:id/toggle', wrap(async (req, res) => {
  const t = await MockTest.findById(oid(req.params.id));
  if (!t) throw notFound('Test not found.');
  t.status = t.status === 'draft' ? 'active' : 'draft';
  await t.save();
  res.json(testJson(t));
}));

// Re-score every submission against the current answer key (after fixing a wrong answer).
router.post('/tests/:id/recalculate', wrap(async (req, res) => {
  const t = await MockTest.findById(oid(req.params.id));
  if (!t) throw notFound('Test not found.');
  const results = await TestResult.find({ test: t._id });
  for (const r of results) {
    Object.assign(r, (({ score, total, percent, sectionScores }) => ({ score, total, percent, sectionScores }))(scoreAttempt(t.questions, r.answers)));
    await r.save();
  }
  res.json({ updated: results.length });
}));

// ── Questions ────────────────────────────────────────────────────────────────
function parseQuestion(b) {
  const question = str(b.question);
  if (!question) throw bad('Question text is required.');
  const options = Array.isArray(b.options) ? b.options.map(str) : [];
  if (options.length !== 4 || options.some((o) => !o)) throw bad('Provide all four options.');
  const answer = Number(b.answer);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw bad('Mark one option as correct.');
  let image = null;
  if (b.image) {
    if (typeof b.image !== 'string' || !b.image.startsWith('data:image/')) throw bad('Image must be a PNG, JPG, GIF or WebP file.');
    if (b.image.length > MAX_IMAGE_CHARS) throw bad('Image too large — max 2MB.');
    image = b.image;
  }
  return { section: str(b.section) || 'General', passage: str(b.passage) || null, question, options, answer, image };
}

const loadTest = async (id) => {
  const t = await MockTest.findById(oid(id));
  if (!t) throw notFound('Test not found.');
  return t;
};

router.get('/tests/:id/questions', wrap(async (req, res) => {
  const t = await loadTest(req.params.id);
  res.json({ test: { id: t.id, name: t.name, subject: t.subject, grade: t.grade }, questions: t.questions });
}));

router.post('/tests/:id/questions', wrap(async (req, res) => {
  const t = await loadTest(req.params.id);
  const id = t.questions.reduce((m, q) => Math.max(m, q.id), 0) + 1;
  t.questions.push({ id, ...parseQuestion(req.body) });
  await t.save();
  res.status(201).json({ id });
}));

router.put('/tests/:id/questions/:qid', wrap(async (req, res) => {
  const t = await loadTest(req.params.id);
  const idx = t.questions.findIndex((q) => q.id === Number(req.params.qid));
  if (idx < 0) throw notFound('Question not found.');
  t.questions.set(idx, { id: t.questions[idx].id, ...parseQuestion(req.body) });
  await t.save();
  res.json({});
}));

router.delete('/tests/:id/questions/:qid', wrap(async (req, res) => {
  const t = await loadTest(req.params.id);
  const before = t.questions.length;
  t.questions = t.questions.filter((q) => q.id !== Number(req.params.qid));
  if (t.questions.length === before) throw notFound('Question not found.');
  await t.save();
  res.json({});
}));

export default router;

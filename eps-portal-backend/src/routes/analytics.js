// IBT (mock test) analytics for admins and teachers, including mock-wise (IBT Mock 1-5) results.
import { Router } from 'express';
import { GRADES, ROLES, SUBJECTS } from '../config.js';
import { User } from '../models/User.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { computeIbtAnalytics, MOCKS } from '../utils/ibtAnalytics.js';
import { bad, str, wrap } from '../utils/helpers.js';

const router = Router();
const SECTIONS = ['A', 'B', 'C', 'D'];

router.get('/', requireAuth(ROLES.ADMIN, ROLES.TEACHER), wrap(async (req, res) => {
  // Teachers are locked to their own grade, as in /teacher/analytics.
  const lockedGrade = req.user.role === ROLES.TEACHER ? (await User.findById(req.user.id).select('grade'))?.grade || null : null;
  const grade = lockedGrade || str(req.query.grade) || null;
  const section = str(req.query.section) || null;
  const subject = str(req.query.subject) || null;
  const mock = str(req.query.mock) || null;               // '1'..'5' or 'none' (tests without a number)
  if (grade && !GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (section && !SECTIONS.includes(section)) throw bad('Choose a valid section.');
  if (subject && !SUBJECTS.includes(subject)) throw bad('Choose a valid subject.');
  if (mock && mock !== 'none' && !MOCKS.includes(Number(mock))) throw bad('Choose a valid IBT Mock.');

  const students = await User.find({ role: ROLES.STUDENT, ...(grade ? { grade } : {}), ...(section ? { section } : {}) }).select('name grade section').lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const raw = await TestResult.find({ student: { $in: students.map((s) => s._id) } })
    .select('student test percent sectionScores').populate('test', 'name subject mockNumber').lean();

  // One flat list: every result with its student, its test's subject and its mock number.
  const results = raw
    .filter((r) => r.test && byId.has(String(r.student)))
    .map((r) => ({
      percent: r.percent, sectionScores: r.sectionScores || {}, subject: r.test.subject, mock: r.test.mockNumber ?? null,
      testName: r.test.name, student: byId.get(String(r.student)),
    }))
    .filter((r) => (!subject || r.subject === subject)
      && (!mock || (mock === 'none' ? r.mock === null : r.mock === Number(mock))));

  res.json({
    filters: { grade: grade || '', section: section || '', subject: subject || '', mock: mock || '' },
    options: { grades: lockedGrade ? [lockedGrade] : GRADES, sections: SECTIONS, subjects: SUBJECTS, mocks: MOCKS, gradeLocked: !!lockedGrade },
    ...computeIbtAnalytics({ students, results }),
  });
}));

export default router;

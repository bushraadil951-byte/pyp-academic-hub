import { Router } from 'express';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { MockTest } from '../models/MockTest.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { safeAvg, wrap } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth(ROLES.TEACHER));

// A teacher is locked to their assigned grade (current_teacher_grade() in app.py).
const teacherGrade = async (req) => (await User.findById(req.user.id).select('grade'))?.grade || null;

router.get('/dashboard', wrap(async (req, res) => {
  const grade = await teacherGrade(req);
  if (!grade) return res.json({ grade: null, studentCount: 0, activeTests: 0, avgScore: 0, submitted: 0, recent: [] });

  const students = await User.find({ role: ROLES.STUDENT, grade }).select('name');
  const ids = students.map((s) => s._id);
  const [results, activeTests] = await Promise.all([
    TestResult.find({ student: { $in: ids } }).sort({ takenAt: -1 }).populate('student', 'name').populate('test', 'name').lean(),
    MockTest.countDocuments({ status: 'active', grade: { $in: [grade, 'All Grades'] } }),
  ]);
  const live = results.filter((r) => r.student && r.test);
  res.json({
    grade,
    studentCount: students.length,
    activeTests,
    avgScore: safeAvg(live.map((r) => r.percent)),
    submitted: live.length,
    recent: live.slice(0, 6).map((r) => ({ id: String(r._id), student: r.student.name, test: r.test.name, percent: r.percent, takenAt: r.takenAt })),
  });
}));

router.get('/students', wrap(async (req, res) => {
  const grade = await teacherGrade(req);
  const students = await User.find({ role: ROLES.STUDENT, ...(grade ? { grade } : {}) }).sort({ grade: 1, name: 1 });
  const results = await TestResult.find({ student: { $in: students.map((s) => s._id) } }).select('student percent').lean();
  const byStudent = new Map();
  for (const r of results) (byStudent.get(String(r.student)) ?? byStudent.set(String(r.student), []).get(String(r.student))).push(r.percent);
  res.json(students.map((s) => {
    const p = byStudent.get(s.id) || [];
    return { id: s.id, name: s.name, grade: s.grade, section: s.section, testsTaken: p.length, avg: safeAvg(p) };
  }));
}));

export default router;

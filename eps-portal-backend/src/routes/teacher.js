import { Router } from 'express';
import { ROLES } from '../config.js';
import { User } from '../models/User.js';
import { MockTest } from '../models/MockTest.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { safeAvg, wrap } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth(ROLES.TEACHER));

// Fetch teacher's viewing and editing access points
const teacherAccess = async (req) => {
  const user = await User.findById(req.user.id).select('grade section viewGrade viewSection editSection');
  return {
    viewGrade: user?.viewGrade || null,
    viewSection: user?.viewSection || null,
    editGrade: user?.grade || null,
    editSection: user?.editSection || null,
  };
};

router.get('/dashboard', wrap(async (req, res) => {
  const access = await teacherAccess(req);

  // Student filter based on Viewing Access
  const studentQuery = { role: ROLES.STUDENT };
  if (access.viewGrade) studentQuery.grade = access.viewGrade;
  if (access.viewSection) studentQuery.section = access.viewSection;

  const students = await User.find(studentQuery).select('name grade section');
  const ids = students.map((s) => s._id);

  const testGradeFilter = access.viewGrade ? [access.viewGrade, 'All Grades'] : { $exists: true };

  const [results, activeTests] = await Promise.all([
    TestResult.find({ student: { $in: ids } }).sort({ takenAt: -1 }).populate('student', 'name').populate('test', 'name').lean(),
    MockTest.countDocuments({ status: 'active', grade: testGradeFilter }),
  ]);

  const live = results.filter((r) => r.student && r.test);
  res.json({
    access,
    grade: access.viewGrade || 'All grades',
    section: access.viewSection || 'All sections',
    studentCount: students.length,
    activeTests,
    avgScore: safeAvg(live.map((r) => r.percent)),
    submitted: live.length,
    recent: live.slice(0, 6).map((r) => ({ id: String(r._id), student: r.student.name, test: r.test.name, percent: r.percent, takenAt: r.takenAt })),
  });
}));

router.get('/students', wrap(async (req, res) => {
  const access = await teacherAccess(req);

  // Apply viewing filter for teacher
  const studentQuery = { role: ROLES.STUDENT };
  if (access.viewGrade) studentQuery.grade = access.viewGrade;
  if (access.viewSection) studentQuery.section = access.viewSection;

  const students = await User.find(studentQuery).sort({ grade: 1, section: 1, name: 1 });
  const results = await TestResult.find({ student: { $in: students.map((s) => s._id) } }).select('student percent').lean();
  const byStudent = new Map();
  for (const r of results) (byStudent.get(String(r.student)) ?? byStudent.set(String(r.student), []).get(String(r.student))).push(r.percent);

  res.json(students.map((s) => {
    const p = byStudent.get(s.id) || [];
    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      section: s.section,
      testsTaken: p.length,
      avg: safeAvg(p),
      canEdit: (!access.editGrade || access.editGrade === s.grade) && (!access.editSection || access.editSection === s.section)
    };
  }));
}));

export default router;

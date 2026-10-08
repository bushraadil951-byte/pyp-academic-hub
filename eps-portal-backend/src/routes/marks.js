// DT (Diagnostic Tests), FA and SA: marks entry, CSV bulk upload, analytics, student progress.
import { Router } from 'express';
import { ACADEMIC_YEAR, MARK_GRADES, MARK_KINDS, MARK_SECTIONS, ROLES, columnsFor } from '../config.js';
import { User } from '../models/User.js';
import { MarkSheet } from '../models/MarkSheet.js';
import { requireAuth } from '../middleware/auth.js';
import { bad, notFound, str, wrap } from '../utils/helpers.js';
import { collapseStrands, computeCrossGrade, computeGradeAnalytics, computeStudentSeries } from '../utils/marksMath.js';
import { computeStrandAnalytics, computeStudentStrands } from '../utils/strandMath.js';

const router = Router();
const staff = requireAuth(ROLES.TEACHER, ROLES.ADMIN);
const adminOnly = requireAuth(ROLES.ADMIN);

// Teacher access points helper (viewing vs editing)
// Safe teacher access helper
const getTeacherAccess = async (req) => {
  if (req.user?.role !== ROLES.TEACHER) return null;
  const u = await User.findById(req.user.id).select('grade section viewGrade viewSection editSection');
  return {
    viewGrade: u?.viewGrade || null,
    viewSection: u?.viewSection || null,
    editGrade: u?.grade || null,
    editSection: u?.editSection || null,
  };
};

const lockedGrade = async (req) => {
  if (req.user?.role !== ROLES.TEACHER) return null;
  const acc = await getTeacherAccess(req);
  return acc?.viewGrade || null;
};

const checkEditPerm = async (req, grade, section) => {
  if (req.user?.role !== ROLES.TEACHER) return;
  const acc = await getTeacherAccess(req);
  if (!acc) return;
  if (acc.editGrade && grade && acc.editGrade !== grade) {
    throw bad(`You only have permission to edit marks for ${acc.editGrade}.`);
  }
  if (acc.editSection && section && acc.editSection !== section) {
    throw bad(`You only have permission to edit marks for section ${acc.editSection}.`);
  }
};
router.param('kind', (req, _res, next, raw) => {
  const rawStr = String(raw || '');
  const matchKey = Object.keys(MARK_KINDS).find((k) => k.toLowerCase() === rawStr.toLowerCase());
  if (!matchKey || !MARK_KINDS[matchKey]) return next(notFound());
  req.kind = matchKey;
  req.cfg = MARK_KINDS[matchKey];
  next();
});

function slot(req, source) {
  const grade = source.grade;
  const section = str(source.section) || null;
  const subject = req.cfg.subjects.find((s) => s.toLowerCase() === str(source.subject).toLowerCase());
  const number = Number(source.number);
  if (!MARK_GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (section && !MARK_SECTIONS.includes(section)) throw bad('Choose a valid section.');
  if (!subject) throw bad('Choose a valid subject.');
  if (!req.cfg.numbers.includes(number)) throw bad(`Choose a valid ${req.kind} number.`);
  return { kind: req.kind, grade, section, subject, strand: null, number, academicYear: ACADEMIC_YEAR };
}

// The strands of a subject for this assessment type, or null when the subject has a single mark (Science, DT).
const strandsOf = (req, subject) => req.cfg.strands?.[subject] || null;
const strandMap = (req) => req.cfg.strands || {};

const studentsOf = (grade, section) =>
  User.find({ role: ROLES.STUDENT, grade, ...(section ? { section } : {}) }).sort({ name: 1 }).select('name username section').lean();
const asStudent = (u) => ({ id: String(u._id), name: u.name, username: u.username, section: u.section || '' });

// Sheets for this slot, one per strand (or one with strand null). A sheet for the whole grade (section null) or this
// section; the section-specific one wins. Returns { [strandOrNull]: sheetDoc }.
async function findSheets(s, strands) {
  const wanted = strands || [null];
  const found = await MarkSheet.find({ kind: s.kind, number: s.number, subject: s.subject, grade: s.grade, academicYear: s.academicYear, strand: { $in: wanted }, section: { $in: [null, s.section] } });
  const out = {};
  for (const strand of wanted) {
    const list = found.filter((x) => (x.strand ?? null) === strand);
    out[strand ?? ''] = list.find((x) => x.section) || list[0] || null;
  }
  return out;
}
const getOrCreateSheet = (s, createdBy) => MarkSheet.findOneAndUpdate(
  { kind: s.kind, number: s.number, subject: s.subject, strand: s.strand ?? null, grade: s.grade, section: s.section, academicYear: s.academicYear },
  { $setOnInsert: { ...s, strand: s.strand ?? null, createdBy } }, { upsert: true, new: true });

function applyMark(sheet, studentId, value, remarks, enteredBy) {
  const i = sheet.marks.findIndex((m) => String(m.student) === studentId);
  const entry = { student: studentId, marks: value, remarks: remarks || '', enteredBy, enteredAt: new Date() };
  if (i >= 0) sheet.marks.set(i, entry); else sheet.marks.push(entry);
}
const dropMark = (sheet, studentId) => { sheet.marks = sheet.marks.filter((m) => String(m.student) !== studentId); };
const parseValue = (v, max) => {
  if (v === '' || v === null || v === undefined) return { blank: true };
  const n = Number(String(v).trim());
  return Number.isFinite(n) && n >= 0 && n <= max ? { value: n } : { invalid: true };
};

// ── Student progress (own marks only) ───────────────────────────────────────
router.get('/student-progress/:kind', requireAuth(ROLES.STUDENT), wrap(async (req, res) => {
  const me = await User.findById(req.user.id);
  const raw = await MarkSheet.find({ kind: req.kind, grade: me.grade, academicYear: ACADEMIC_YEAR }).lean();
  const common = { studentId: me.id, studentSection: me.section, numbers: req.cfg.numbers };
  const { series, insights } = computeStudentSeries({ sheets: collapseStrands(raw), subjects: req.cfg.subjects, ...common });
  const strands = computeStudentStrands({ sheets: raw, strandsBySubject: strandMap(req), ...common });   // { subject: [{strand, points, average, status}] }
  res.json({ label: req.cfg.label, academicYear: ACADEMIC_YEAR, student: { name: me.name, grade: me.grade, section: me.section }, subjects: req.cfg.subjects, numbers: req.cfg.numbers, series, insights, strands });
}));

// ── Config and hub ──────────────────────────────────────────────────────────
router.get('/config', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  res.json({ academicYear: ACADEMIC_YEAR, kinds: Object.fromEntries(Object.entries(MARK_KINDS).map(([k, c]) => [k, { ...c, strands: c.strands || {}, columns: columnsFor(c) }])), grades: locked ? [locked] : MARK_GRADES, gradeLocked: !!locked, sections: MARK_SECTIONS, isAdmin: req.user.role === ROLES.ADMIN });
}));

router.get('/hub', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const sheets = await MarkSheet.find({ academicYear: ACADEMIC_YEAR, ...(locked ? { grade: locked } : {}) }).select('kind marks.student').lean();
  res.json(Object.entries(MARK_KINDS).map(([kind, cfg]) => {
    const mine = sheets.filter((s) => s.kind === kind);
    return { kind, label: cfg.label, totalSheets: mine.length, totalMarks: mine.reduce((n, s) => n + s.marks.length, 0) };
  }));
}));

router.get('/:kind/dashboard', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const grades = locked ? [locked] : MARK_GRADES;
  const sheets = await MarkSheet.find({ kind: req.kind, academicYear: ACADEMIC_YEAR, grade: { $in: grades } }).select('marks.student').lean();
  const counts = await Promise.all(grades.map((g) => User.countDocuments({ role: ROLES.STUDENT, grade: g })));
  res.json({
    label: req.cfg.label, academicYear: ACADEMIC_YEAR, numbers: req.cfg.numbers,
    totalSheets: sheets.length, totalMarks: sheets.reduce((n, s) => n + s.marks.length, 0), totalStudents: counts.reduce((a, b) => a + b, 0),
    grades: grades.map((g, i) => ({ grade: g, studentCount: counts[i] })),
  });
}));

// ── Entry (one subject + number + grade/section) ────────────────────────────
// Strand subjects (FA/SA English, Hindi, Urdu, Maths) are entered strand by strand: each strand has its own
// maximum marks and its own column. Other subjects (Science, all of DT) keep one mark per student.
router.put('/:kind/entry', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const s = slot(req, { ...req.body, grade: locked || req.body.grade });
  await checkEditPerm(req, s.grade, s.section);
  const strands = strandsOf(req, s.subject);
  const [students, sheets] = await Promise.all([studentsOf(s.grade, s.section), findSheets(s, strands)]);
  const slotOut = { grade: s.grade, section: s.section || '', subject: s.subject, number: s.number };

  if (!strands) {
    const sheet = sheets[''];
    const marks = {};
    for (const m of sheet?.marks || []) marks[String(m.student)] = { marks: m.marks, remarks: m.remarks || '' };
    return res.json({
      slot: slotOut, strands: null, students: students.map(asStudent),
      sheet: sheet ? { maxMarks: sheet.maxMarks, testDate: sheet.testDate, section: sheet.section } : null, marks,
    });
  }
  const strandSheets = {}; const marks = {};
  for (const strand of strands) {
    const sh = sheets[strand];
    strandSheets[strand] = sh ? { maxMarks: sh.maxMarks, testDate: sh.testDate } : null;
    for (const m of sh?.marks || []) {
      const row = (marks[String(m.student)] ??= { remarks: '', strands: {} });
      row.strands[strand] = m.marks;
      if (!row.remarks && m.remarks) row.remarks = m.remarks;
    }
  }
  const testDate = strands.map((st) => strandSheets[st]?.testDate).find(Boolean) || null;
  res.json({ slot: slotOut, strands, students: students.map(asStudent), strandSheets, testDate, marks });
}));

router.put('/:kind/entry', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const s = slot(req, { ...req.body, grade: locked || req.body.grade });
  const strands = strandsOf(req, s.subject);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const roster = new Map((await studentsOf(s.grade, s.section)).map((u) => [String(u._id), u.name]));
  const testDate = req.body.testDate ? new Date(req.body.testDate) : null;

  let removed = 0; const invalid = []; const savedStudents = new Set();
  const saveInto = async (strand, maxMarks, valueOf) => {
    const sheet = await getOrCreateSheet({ ...s, strand }, req.user.id);
    sheet.maxMarks = maxMarks;
    if (testDate && !Number.isNaN(testDate.getTime())) sheet.testDate = testDate;
    for (const row of rows) {
      const id = String(row.studentId);
      if (!roster.has(id)) continue;
      const v = parseValue(valueOf(row), maxMarks);
      if (v.blank) { const before = sheet.marks.length; dropMark(sheet, id); removed += before - sheet.marks.length; }   // blank = absent
      else if (v.invalid) invalid.push(strand ? `${roster.get(id)} (${strand})` : roster.get(id));
      else { applyMark(sheet, id, v.value, str(row.remarks), req.user.id); savedStudents.add(id); }
    }
    await sheet.save();
  };

  if (!strands) {
    const maxMarks = Number(req.body.maxMarks ?? 25);
    if (!Number.isFinite(maxMarks) || maxMarks <= 0) throw bad('Maximum marks must be more than 0.');
    await saveInto(null, maxMarks, (row) => row.marks);
  } else {
    const maxBy = req.body.maxMarks && typeof req.body.maxMarks === 'object' ? req.body.maxMarks : {};
    for (const strand of strands) {
      const maxMarks = Number(maxBy[strand] ?? 10);
      if (!Number.isFinite(maxMarks) || maxMarks <= 0) throw bad(`Maximum marks for "${strand}" must be more than 0.`);
      await saveInto(strand, maxMarks, (row) => row.strands?.[strand]);
    }
  }
  res.json({ saved: savedStudents.size, removed, invalid });
}));

// ── CSV bulk upload: one row per student, one column per subject
// (or per strand for strand subjects) ────────────────────────────────
router.put('/:kind/bulk', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);

  const base = slot(req, {
    ...req.body,
    grade: locked || req.body.grade,
    subject: req.cfg.subjects[0],
  });
  await checkEditPerm(req, base.grade, base.section);

  const rows = Array.isArray(req.body.rows)
    ? req.body.rows.slice(0, 1000)
    : [];

  const byUsername = new Map(
    (
      await studentsOf(
        base.grade,
        base.section
      )
    ).map((u) => [
      u.username,
      String(u._id)
    ])
  );

  const columns = columnsFor(req.cfg);

  const inFile = [
    ...new Set(
      rows.flatMap((r) =>
        Object.keys(r.marks || {})
      )
    ),
  ]
    .map((k) =>
      columns.find(
        (c) =>
          c.key ===
          k.trim().toLowerCase()
      )
    )
    .filter(Boolean);

  if (!inFile.length) {
    throw bad(
      `No mark columns recognised. Expected headers like: username,${columns
        .slice(0, 3)
        .map((c) => c.key)
        .join(',')}`
    );
  }

  // ------------------------------------------------------------
  // Validate maximum marks BEFORE saving anything.
  // Teacher must explicitly enter a maximum mark.
  // Maximum marks may be whole numbers or .5 increments.
  // ------------------------------------------------------------

  const maxMarksByColumn = {};

  for (const col of inFile) {
    const rawMax =
      req.body.maxMarks?.[col.key];

    if (
      rawMax === undefined ||
      rawMax === null ||
      String(rawMax).trim() === ''
    ) {
      throw bad(
        `Maximum marks for "${col.label}" must be entered.`
      );
    }

    const max = Number(rawMax);

    if (
      !Number.isFinite(max) ||
      max <= 0
    ) {
      throw bad(
        `Maximum marks for "${col.label}" must be greater than 0.`
      );
    }

    // Allow only 0.5 increments:
    // 10, 10.5, 11, 11.5, 12, etc.
    if (!Number.isInteger(max * 2)) {
      throw bad(
        `Maximum marks for "${col.label}" must be in 0.5 increments.`
      );
    }

    maxMarksByColumn[col.key] = max;
  }

  let saved = 0;
  let skipped = 0;

  const unknownUsers = new Set();

  // ------------------------------------------------------------
  // Import marks
  // ------------------------------------------------------------

  for (const col of inFile) {
    const max =
      maxMarksByColumn[col.key];

    const sheet =
      await getOrCreateSheet(
        {
          ...base,
          subject: col.subject,
          strand: col.strand,
        },
        req.user.id
      );

    sheet.maxMarks = max;

    for (const row of rows) {
      const username =
        str(row.username);

      const id =
        byUsername.get(username);

      if (!id) {
        if (username) {
          unknownUsers.add(username);
        }

        continue;
      }

      const raw =
        Object.entries(
          row.marks || {}
        ).find(
          ([k]) =>
            k.trim().toLowerCase() ===
            col.key
        )?.[1];

      const v =
        parseValue(
          raw,
          max
        );

      // Empty CSV cell = skip
      if (v.blank) {
        continue;
      }

      // Invalid or above maximum = skip
      if (v.invalid) {
        skipped += 1;
        continue;
      }

      // IMPORTANT:
      // v.value is stored exactly as a number.
      // 17.5 remains 17.5.
      applyMark(
        sheet,
        id,
        v.value,
        '',
        req.user.id
      );

      saved += 1;
    }

    await sheet.save();
  }

  res.json({
    saved,
    skipped,
    subjects: inFile.map(
      (c) => c.label
    ),
    unknownUsers: [
      ...unknownUsers,
    ],
  });
}));

// ── Analytics ───────────────────────────────────────────────────────────────
router.get('/:kind/analytics', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const grade = locked || req.query.grade || MARK_GRADES[0];
  if (!MARK_GRADES.includes(grade)) throw bad('Choose a valid grade.');
  const section = str(req.query.section) || null;
  const [students, raw] = await Promise.all([studentsOf(grade, section), MarkSheet.find({ kind: req.kind, grade, academicYear: ACADEMIC_YEAR }).lean()]);
  const list = students.map(asStudent);
  res.json({
    grade, section: section || '', academicYear: ACADEMIC_YEAR,
    ...computeGradeAnalytics({ students: list, sheets: collapseStrands(raw), subjects: req.cfg.subjects, numbers: req.cfg.numbers }),
    strandAnalytics: computeStrandAnalytics({ students: list, sheets: raw, strandsBySubject: strandMap(req), numbers: req.cfg.numbers }),
  });
}));

router.get('/:kind/cross-grade', adminOnly, wrap(async (req, res) => {
  const raw = await MarkSheet.find({ kind: req.kind, academicYear: ACADEMIC_YEAR }).lean();
  const counts = await Promise.all(MARK_GRADES.map((g) => User.countDocuments({ role: ROLES.STUDENT, grade: g })));
  const studentCounts = Object.fromEntries(MARK_GRADES.map((g, i) => [g, counts[i]]));
  res.json({ subjects: req.cfg.subjects, grades: computeCrossGrade({ grades: MARK_GRADES, studentCounts, sheets: collapseStrands(raw), subjects: req.cfg.subjects }) });
}));

export default router;

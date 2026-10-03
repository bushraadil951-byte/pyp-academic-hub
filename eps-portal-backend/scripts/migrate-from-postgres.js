// One-off import of your existing Neon/PostgreSQL data into MongoDB (IBT module only: users, mock tests, results).
//   1. Put the Neon connection string in DATABASE_URL and your Atlas string in MONGODB_URI (.env)
//   2. npm install            (installs the optional `pg` driver)
//   3. npm run migrate
// Safe to re-run: documents are matched on the old Postgres id (legacyId), so nothing is duplicated.
// Passwords are copied as-is; the API accepts Flask/Werkzeug hashes and upgrades them to bcrypt on each user's next login.
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';
import { User } from '../src/models/User.js';
import { MockTest } from '../src/models/MockTest.js';
import { TestResult } from '../src/models/TestResult.js';
import { MarkSheet } from '../src/models/MarkSheet.js';

let pg;
try { pg = (await import('pg')).default; } catch { console.error('The "pg" package is missing. Run: npm install'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL to your PostgreSQL (Neon) connection string.'); process.exit(1); }

const sql = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await sql.connect();
await connectDb();

const json = (v, fallback) => { try { return typeof v === 'string' ? JSON.parse(v || 'null') ?? fallback : v ?? fallback; } catch { return fallback; } };
const q = async (text) => (await sql.query(text)).rows;

// Users (all roles)
const users = await q('SELECT * FROM "user"');
await User.bulkWrite(users.map((u) => ({
  updateOne: {
    filter: { legacyId: u.id },
    update: { $setOnInsert: { legacyId: u.id, name: u.name, username: u.username, password: u.password, role: u.role, grade: u.grade, section: u.section, created: u.created } },
    upsert: true,
  },
})));
const userMap = new Map((await User.find({ legacyId: { $ne: null } }).select('legacyId')).map((u) => [u.legacyId, u._id]));

// Mock tests (questions JSON text -> embedded array)
const tests = await q('SELECT * FROM mock_test');
await MockTest.bulkWrite(tests.map((t) => ({
  updateOne: {
    filter: { legacyId: t.id },
    update: { $setOnInsert: {
      legacyId: t.id, name: t.name, subject: t.subject, grade: t.grade, difficulty: t.difficulty, duration: t.duration, status: t.status, created: t.created,
      questions: json(t.questions, []).map((x) => ({
        id: x.id, section: x.section || 'General', passage: x.passage || null, question: x.question,
        options: (x.options || []).slice(0, 4), answer: Number(x.answer) || 0, image: x.image || null,
      })),
    } },
    upsert: true,
  },
})));
const testMap = new Map((await MockTest.find({ legacyId: { $ne: null } }).select('legacyId')).map((t) => [t.legacyId, t._id]));

// Results: Mongo enforces one attempt per student per test, so keep the earliest (what the Flask dashboards showed)
const results = (await q('SELECT * FROM test_result ORDER BY taken_at ASC'))
  .filter((r) => userMap.has(r.student_id) && testMap.has(r.test_id));
let skipped = 0;
const ops = results.map((r) => ({
  updateOne: {
    filter: { student: userMap.get(r.student_id), test: testMap.get(r.test_id) },
    update: { $setOnInsert: {
      student: userMap.get(r.student_id), test: testMap.get(r.test_id), score: r.score, total: r.total, percent: r.percent,
      answers: json(r.answers, {}), sectionScores: json(r.section_scores, {}), timeTaken: r.time_taken, takenAt: r.taken_at,
    } },
    upsert: true,
  },
}));
if (ops.length) { const res = await TestResult.bulkWrite(ops); skipped = results.length - res.upsertedCount; }

// DT / FA / SA mark sheets: slot table + marks table -> one MarkSheet document with embedded marks.
async function migrateSheets({ kind, prefix, sheetTable, markTable, fk, numberCol }) {
  let rows, marks;
  try { rows = await q(`SELECT * FROM ${sheetTable}`); marks = await q(`SELECT * FROM ${markTable}`); }
  catch { console.log(`(skipped ${kind}: table ${sheetTable} not found)`); return 0; }
  const byId = new Map();
  for (const m of marks) {
    if (!userMap.has(m.student_id)) continue;
    (byId.get(m[fk]) ?? byId.set(m[fk], []).get(m[fk])).push({
      student: userMap.get(m.student_id), marks: m.marks_obtained, remarks: m.remarks || '',
      enteredBy: userMap.get(m.entered_by) ?? null, enteredAt: m.entered_at,
    });
  }
  const docs = rows.filter((r) => (kind === 'DT' || r.atype === kind)).map((r) => ({
    updateOne: {
      filter: { legacyKey: `${prefix}:${r.id}` },
      update: { $setOnInsert: {
        legacyKey: `${prefix}:${r.id}`, kind, number: r[numberCol], subject: r.subject, grade: r.grade, section: r.section || null,
        maxMarks: r.max_marks || 25, academicYear: r.academic_year, testDate: r.test_date, createdBy: userMap.get(r.created_by) ?? null,
        marks: byId.get(r.id) || [],
      } },
      upsert: true,
    },
  }));
  if (docs.length) await MarkSheet.bulkWrite(docs);
  return docs.length;
}
const dtSheets = await migrateSheets({ kind: 'DT', prefix: 'dt', sheetTable: 'diagnostic_test', markTable: 'dt_mark', fk: 'dt_id', numberCol: 'dt_number' });
const faSheets = await migrateSheets({ kind: 'FA', prefix: 'as', sheetTable: 'assessment', markTable: 'assessment_mark', fk: 'assessment_id', numberCol: 'number' });
const saSheets = await migrateSheets({ kind: 'SA', prefix: 'as', sheetTable: 'assessment', markTable: 'assessment_mark', fk: 'assessment_id', numberCol: 'number' });
console.log(`Mark sheets: DT ${dtSheets}, FA ${faSheets}, SA ${saSheets}`);

console.log(`Users: ${users.length}  Tests: ${tests.length}  Results: ${results.length} (${skipped} already present or duplicate attempts skipped)`);
console.log(`Orphaned results (missing student/test): ${(await q('SELECT count(*) FROM test_result'))[0].count - results.length}`);
await sql.end();
await mongoose.disconnect();

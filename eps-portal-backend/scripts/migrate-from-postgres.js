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

console.log(`Users: ${users.length}  Tests: ${tests.length}  Results: ${results.length} (${skipped} already present or duplicate attempts skipped)`);
console.log(`Orphaned results (missing student/test): ${(await q('SELECT count(*) FROM test_result'))[0].count - results.length}`);
await sql.end();
await mongoose.disconnect();

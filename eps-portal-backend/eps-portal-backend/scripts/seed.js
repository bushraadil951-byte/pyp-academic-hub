// Usage:
//   npm run seed                      -> creates one admin only (password from SEED_ADMIN_PASSWORD, or a random one printed once)
//   npm run seed -- --sample          -> also adds 2 teachers, 4 students and a sample test (development only)
//   npm run seed -- --reset           -> WIPES users, tests and results first
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { connectDb } from '../src/db.js';
import { User } from '../src/models/User.js';
import { MockTest } from '../src/models/MockTest.js';
import { TestResult } from '../src/models/TestResult.js';
import { hashPassword } from '../src/utils/password.js';

const flags = new Set(process.argv.slice(2));
await connectDb();

if (flags.has('--reset')) {
  await Promise.all([User.deleteMany({}), MockTest.deleteMany({}), TestResult.deleteMany({})]);
  console.log('Collections cleared.');
}
if (await User.exists({})) {
  console.log('Users already exist — nothing seeded. Use --reset to start over.');
  await mongoose.disconnect();
  process.exit(0);
}

const adminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
await User.create({ name: 'Bushra Khan', username: process.env.SEED_ADMIN_USERNAME || 'Organizer', role: 'Resource_Manager', password: hashPassword(adminPassword) });
console.log(`Admin created: ${process.env.SEED_ADMIN_USERNAME || 'Organizer'} / ${adminPassword}${process.env.SEED_ADMIN_PASSWORD ? '' : '   (shown once — save it)'}`);

if (flags.has('--sample')) {
  if (config.isProd) { console.log('Refusing to add sample accounts with NODE_ENV=production.'); }
  else {
    const pw = hashPassword('demo1234');
    await User.insertMany([
      { name: 'Mrs. Sharma', username: 'teacher1', role: 'teacher', grade: 'Grade 3', password: pw },
      { name: 'Mr. Verma', username: 'teacher2', role: 'teacher', grade: 'Grade 4', password: pw },
      { name: 'Aarav Sharma', username: 'aarav', role: 'student', grade: 'Grade 3', section: 'A', password: pw },
      { name: 'Priya Mehta', username: 'priya', role: 'student', grade: 'Grade 3', section: 'A', password: pw },
      { name: 'Rohan Gupta', username: 'rohan', role: 'student', grade: 'Grade 4', section: 'B', password: pw },
      { name: 'Sneha Patel', username: 'sneha', role: 'student', grade: 'Grade 4', section: 'A', password: pw },
    ]);
    await MockTest.create({
      name: 'Sample Maths Test', subject: 'Mathematics', grade: 'All Grades', difficulty: 'Easy', duration: 10, status: 'active',
      questions: [
        { id: 1, section: 'Number Operations', question: 'What is 7 × 8?', options: ['54', '56', '64', '48'], answer: 1 },
        { id: 2, section: 'Geometry', question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], answer: 1 },
      ],
    });
    console.log('Sample teachers, students (password: demo1234) and a test added.');
  }
}
await mongoose.disconnect();

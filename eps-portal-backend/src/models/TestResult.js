import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true, index: true },
  score: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  percent: { type: Number, default: 0 },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },         // { "<questionId>": optionIndex }
  sectionScores: { type: mongoose.Schema.Types.Mixed, default: {} },   // { "<section>": {correct,total} }
  timeTaken: { type: Number, default: 0 },
  takenAt: { type: Date, default: Date.now },
}, { minimize: false });

// One attempt per student per test, enforced by the database (Flask only checked in code).
testResultSchema.index({ student: 1, test: 1 }, { unique: true });

export const TestResult = mongoose.model('TestResult', testResultSchema);

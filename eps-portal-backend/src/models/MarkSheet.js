import mongoose from 'mongoose';

// One document = one DT/FA/SA "slot", e.g. DT3 · Maths · Grade 4 · Section B · 2026-27.
// Replaces four SQL tables: diagnostic_test, dt_mark, assessment, assessment_mark.
const markSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  marks: { type: Number, required: true, min: 0 },
  remarks: { type: String, default: '' },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  enteredAt: { type: Date, default: Date.now },
}, { _id: false });

const markSheetSchema = new mongoose.Schema({
  kind: { type: String, enum: ['DT', 'FA', 'SA'], required: true },
  number: { type: Number, required: true },
  subject: { type: String, required: true },
  grade: { type: String, required: true },
  section: { type: String, default: null },            // null = whole grade
  maxMarks: { type: Number, default: 25, min: 1 },
  academicYear: { type: String, required: true },
  testDate: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  marks: { type: [markSchema], default: [] },
  legacyKey: { type: String, index: true, sparse: true }, // 'dt:12' / 'as:7' = old PostgreSQL row (migration only)
}, { timestamps: { createdAt: 'created', updatedAt: false } });

markSheetSchema.index({ kind: 1, number: 1, subject: 1, grade: 1, section: 1, academicYear: 1 }, { unique: true });
markSheetSchema.index({ 'marks.student': 1 });

export const MarkSheet = mongoose.model('MarkSheet', markSheetSchema);

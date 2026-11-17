import mongoose from 'mongoose';

// One document = one class's attendance for one school day. Only absences are stored: everyone else was present.
// A day counts as a school day for a class only once a document exists for it.
const absenceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: Number, enum: [0.5, 1], required: true },   // 1 = absent, 0.5 = half-day absent
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },   // YYYY-MM-DD (school-local day)
  grade: { type: String, required: true },
  section: { type: String, required: true },
  absences: { type: [absenceSchema], default: [] },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created', updatedAt: 'updated' } });

attendanceSchema.index({ date: 1, grade: 1, section: 1 }, { unique: true });
attendanceSchema.index({ grade: 1, section: 1, date: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);

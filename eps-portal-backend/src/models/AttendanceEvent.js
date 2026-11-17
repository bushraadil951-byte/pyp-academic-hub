import mongoose from 'mongoose';

// A note on a school day: holiday, PTM, meeting, event... `countAttendance` says whether that day counts as a school day.
// grade null = whole school; section null = every section of the grade.
export const EVENT_TYPES = ['Holiday', 'PTM', 'Meeting', 'Event', 'Exam', 'Other'];

const attendanceEventSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  grade: { type: String, default: null },
  section: { type: String, default: null },
  type: { type: String, enum: EVENT_TYPES, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  note: { type: String, default: '', trim: true, maxlength: 500 },
  countAttendance: { type: Boolean, default: true },   // false = this day is left out of everyone's attendance %
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created', updatedAt: false } });

attendanceEventSchema.index({ date: 1 });
attendanceEventSchema.index({ grade: 1, section: 1, date: 1 });

export const AttendanceEvent = mongoose.model('AttendanceEvent', attendanceEventSchema);

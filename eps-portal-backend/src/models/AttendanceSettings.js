import mongoose from 'mongoose';

// School-wide attendance settings, one document (key 'terms'): which months make up Semester I and Semester II.
// Months are 'YYYY-MM'. The whole year is Semester I + Semester II.
const attendanceSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  sem1Start: { type: String, match: /^\d{4}-\d{2}$/ },
  sem1End: { type: String, match: /^\d{4}-\d{2}$/ },
  sem2Start: { type: String, match: /^\d{4}-\d{2}$/ },
  sem2End: { type: String, match: /^\d{4}-\d{2}$/ },
});

export const AttendanceSettings = mongoose.model('AttendanceSettings', attendanceSettingsSchema);

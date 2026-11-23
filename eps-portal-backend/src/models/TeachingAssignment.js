import mongoose from 'mongoose';

// One row = one teacher teaches one subject in one class (grade + section) for the academic year.
// subject 'ALL' means the teacher is the HOME ROOM teacher of that class: they teach every subject that no
// other teacher has been given in that class.
const teachingAssignmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grade: { type: String, required: true },
  section: { type: String, required: true },
  subject: { type: String, required: true },
  academicYear: { type: String, required: true },
}, { timestamps: { createdAt: 'created', updatedAt: false } });

// A subject in a class has one teacher, and a class has one home room teacher.
teachingAssignmentSchema.index({ academicYear: 1, grade: 1, section: 1, subject: 1 }, { unique: true });

export const TeachingAssignment = mongoose.model('TeachingAssignment', teachingAssignmentSchema);

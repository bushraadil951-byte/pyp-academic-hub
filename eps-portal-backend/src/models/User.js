import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  username: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
  password: { type: String, required: true },          // bcrypt hash (or a legacy Werkzeug hash after migration)
  role: { type: String, required: true, enum: ['Resource_Manager', 'teacher', 'student'], index: true },
  grade: { type: String, default: null },
  section: { type: String, default: null },
  viewGrade: { type: String, default: null },
  viewSection: { type: String, default: null },
  editSection: { type: String, default: null },
  legacyId: { type: Number, index: true, sparse: true }, // id from the old PostgreSQL table (migration only)
}, { timestamps: { createdAt: 'created', updatedAt: false } });

export const User = mongoose.model('User', userSchema);

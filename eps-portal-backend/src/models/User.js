import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  username: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
  password: { type: String, required: true },          // bcrypt hash (or a legacy Werkzeug hash after migration)
  role: { type: String, required: true, enum: ['Resource_Manager', 'teacher', 'student'], index: true },
  grade: { type: String, default: null },
  section: { type: String, default: null },
  email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 }, // recovery address (a parent's, for students); NOT unique: siblings can share one
  mustChangePassword: { type: Boolean, default: false },   // true after an admin sets/resets the password
  passwordChangedAt: { type: Date, default: null },        // sessions issued before this are rejected
  legacyId: { type: Number, index: true, sparse: true }, // id from the old PostgreSQL table (migration only)
}, { timestamps: { createdAt: 'created', updatedAt: false } });

export const User = mongoose.model('User', userSchema);

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
  editGrade: { type: String },                    // null = no edit access, 'ALL' = every grade, or one grade
  viewSections: { type: [String], default: [] },  // empty = every section
  editSections: { type: [String], default: [] },
  email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 }, // the person's own school address: it links them to their Google account
  mustChangePassword: { type: Boolean, default: false },   // true after an admin sets/resets the password
  passwordChangedAt: { type: Date, default: null },        // sessions issued before this are rejected
  legacyId: { type: Number, index: true, sparse: true }, // id from the old PostgreSQL table (migration only)
}, { timestamps: { createdAt: 'created', updatedAt: false } });

// One address, one account: Google sign-in finds the person by email. Accounts with no email yet are left out.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

export const User = mongoose.model('User', userSchema);

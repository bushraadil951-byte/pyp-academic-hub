import mongoose from 'mongoose';

// A single-use 6-digit code (password reset). Only a keyed hash of the code is stored, never the code itself.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['reset'], default: 'reset' },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

// MongoDB deletes expired documents automatically (checked about once a minute).
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OneTimeCode = mongoose.model('OneTimeCode', schema);

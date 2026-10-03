import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;
const rating = { type: Number, required: true, min: 1, max: 4 };
const ts = { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } };

// IB Learner Profile: one rating per student / rater / UOI / attribute.
const lpSchema = new mongoose.Schema({
  student: { type: ObjectId, ref: 'User', required: true, index: true },
  rater: { type: ObjectId, ref: 'User', default: null },
  raterType: { type: String, enum: ['teacher', 'student'], required: true },
  term: { type: String, required: true },
  attribute: { type: String, required: true },
  rating,
  evidence: { type: String, default: '' },
}, ts);
lpSchema.index({ student: 1, raterType: 1, term: 1, attribute: 1 }, { unique: true });
export const LpRating = mongoose.model('LpRating', lpSchema);

// ATL skills. Teacher ratings and student self-ratings live together, split by raterType
// (they were two SQL tables: atl_rating and atl_self_rating).
const atlSchema = new mongoose.Schema({
  student: { type: ObjectId, ref: 'User', required: true, index: true },
  rater: { type: ObjectId, ref: 'User', default: null },
  raterType: { type: String, enum: ['teacher', 'student'], required: true },
  term: { type: String, required: true },
  skill: { type: String, required: true },
  descriptor: { type: String, required: true },
  rating,
}, ts);
atlSchema.index({ student: 1, raterType: 1, term: 1, skill: 1, descriptor: 1 }, { unique: true });
export const AtlRating = mongoose.model('AtlRating', atlSchema);

// A student's written reflection on a Learner Profile attribute for a UOI.
const reflectionSchema = new mongoose.Schema({
  student: { type: ObjectId, ref: 'User', required: true, index: true },
  term: { type: String, required: true },
  attribute: { type: String, required: true },
  reflection: { type: String, required: true, maxlength: 4000 },
}, ts);
reflectionSchema.index({ student: 1, term: 1, attribute: 1 }, { unique: true });
export const Reflection = mongoose.model('Reflection', reflectionSchema);

// ISP (Islamic Studies Programme) character attributes. Not tied to a term (same as the Flask app).
const ispSchema = new mongoose.Schema({
  student: { type: ObjectId, ref: 'User', required: true, index: true },
  rater: { type: ObjectId, ref: 'User', default: null },
  raterType: { type: String, enum: ['teacher', 'student'], required: true },
  attribute: { type: String, required: true },
  rating,
  reflection: { type: String, default: '', maxlength: 4000 },
}, ts);
ispSchema.index({ student: 1, raterType: 1, attribute: 1 }, { unique: true });
export const IspRating = mongoose.model('IspRating', ispSchema);

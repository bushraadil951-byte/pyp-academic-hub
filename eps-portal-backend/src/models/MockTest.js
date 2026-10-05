import mongoose from 'mongoose';

// Questions are embedded: the Flask app already stored them as a JSON blob on the test row.
const questionSchema = new mongoose.Schema({
  id: { type: Number, required: true },                 // id inside this test (1, 2, 3 ...)
  section: { type: String, default: 'General' },
  passage: { type: String, default: null },
  question: { type: String, required: true },
  options: { type: [String], validate: (v) => v.length === 4 },
  answer: { type: Number, min: 0, max: 3, required: true },
  image: { type: String, default: null },               // data: URL, max 2 MB (enforced in the route)
}, { _id: false });

const mockTestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  subject: { type: String, required: true },
  grade: { type: String, required: true },              // 'Grade 3' | 'Grade 4' | 'Grade 5' | 'All Grades'
  mockNumber: { type: Number, min: 1, max: 5, default: null },   // 'IBT Mock 1' ... 'IBT Mock 5' (null = not numbered yet)
  difficulty: { type: String, default: 'Medium' },
  duration: { type: Number, default: 40, min: 1 },
  status: { type: String, enum: ['draft', 'active'], default: 'draft' },
  questions: { type: [questionSchema], default: [] },
  legacyId: { type: Number, index: true, sparse: true },
}, { timestamps: { createdAt: 'created', updatedAt: false } });

export const MockTest = mongoose.model('MockTest', mockTestSchema);

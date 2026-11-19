import mongoose from 'mongoose';

// One record = one physical copy, with its own accession number.
const libraryBookSchema = new mongoose.Schema({
  accession: { type: String, required: true, unique: true, trim: true, maxlength: 30 },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  author: { type: String, default: '', trim: true, maxlength: 150 },
  isbn: { type: String, default: '', trim: true, maxlength: 30 },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'LibrarySection', required: true, index: true },
  status: { type: String, enum: ['available', 'issued'], default: 'available', index: true },
}, { timestamps: { createdAt: 'created', updatedAt: false } });

export const LibraryBook = mongoose.model('LibraryBook', libraryBookSchema);

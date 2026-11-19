import mongoose from 'mongoose';

// A shelf or category in the school library, for example "Story books" or "Science".
const librarySectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
}, { timestamps: { createdAt: 'created', updatedAt: false } });

// Names are unique ignoring upper/lower case.
librarySectionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const LibrarySection = mongoose.model('LibrarySection', librarySectionSchema);

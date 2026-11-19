import mongoose from 'mongoose';

// One issue of one book to one person. Names and titles are copied in, so the history stays readable
// even after a book is removed from the library or a person's account is deleted.
const libraryLoanSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  bookTitle: { type: String, required: true },
  accession: { type: String, required: true },
  sectionName: { type: String, default: '' },
  borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  borrowerName: { type: String, required: true },
  borrowerRole: { type: String, enum: ['student', 'teacher'], required: true },
  borrowerClass: { type: String, default: '' },          // "Grade 3 A" for a student, empty for a teacher
  issuedOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  dueOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  returnedOn: { type: String, default: null },
  open: { type: Boolean, default: true },                // true while the book is still out
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created', updatedAt: false } });

// A book can be out on loan only once at a time.
libraryLoanSchema.index({ book: 1 }, { unique: true, partialFilterExpression: { open: true } });
libraryLoanSchema.index({ open: 1, dueOn: 1 });
libraryLoanSchema.index({ borrower: 1, open: 1 });

export const LibraryLoan = mongoose.model('LibraryLoan', libraryLoanSchema);

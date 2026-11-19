// School library: only the librarian can issue and return books and manage books and sections.
// The administrator can only create the librarian's account (and reset its password through /api/account/admin-reset).
import { Router } from 'express';
import { config, ROLES } from '../config.js';
import { User } from '../models/User.js';
import { LibrarySection } from '../models/LibrarySection.js';
import { LibraryBook } from '../models/LibraryBook.js';
import { LibraryLoan } from '../models/LibraryLoan.js';
import { requireAuth } from '../middleware/auth.js';
import { hashPassword } from '../utils/password.js';
import { generateTempPassword } from '../utils/passwordPolicy.js';
import { usernameFromEmail } from '../utils/username.js';
import { HttpError, bad, notFound, oid, schoolEmail, str, wrap } from '../utils/helpers.js';

const router = Router();
const lib = requireAuth(ROLES.LIBRARIAN);
const admin = requireAuth(ROLES.ADMIN);
const DEFAULT_LOAN_DAYS = 14;

const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isDupe = (e) => e?.code === 11000;

// ── Librarian account (administrator only) ───────────────────────────────────
router.get('/account', admin, wrap(async (_req, res) => {
  const u = await User.findOne({ role: ROLES.LIBRARIAN }).lean();
  res.json(u ? { exists: true, id: String(u._id), name: u.name, email: u.email || '' } : { exists: false });
}));

router.post('/account', admin, wrap(async (req, res) => {
  if (await User.exists({ role: ROLES.LIBRARIAN })) throw new HttpError(409, 'A librarian account already exists.');
  const name = str(req.body.name) || 'Librarian';
  const email = schoolEmail(req.body.email) || `librarian@${config.google.allowedDomain}`;
  if (await User.exists({ email })) throw new HttpError(409, 'Someone already has that email address.');
  const tempPassword = generateTempPassword();
  const taken = new Set((await User.find({}, 'username').lean()).map((u) => u.username));
  const user = await User.create({
    name, email, role: ROLES.LIBRARIAN, grade: null, section: null,
    username: usernameFromEmail(email, taken),
    password: hashPassword(tempPassword),
    mustChangePassword: true,                      // she chooses her own the first time she signs in with it
  });
  res.status(201).json({ exists: true, id: String(user._id), name: user.name, email: user.email, tempPassword });   // shown once
}));

// ── Overview ─────────────────────────────────────────────────────────────────
router.get('/overview', lib, wrap(async (_req, res) => {
  const today = todayIST();
  const [books, issued, overdue, sections] = await Promise.all([
    LibraryBook.countDocuments(),
    LibraryLoan.countDocuments({ open: true }),
    LibraryLoan.countDocuments({ open: true, dueOn: { $lt: today } }),
    LibrarySection.countDocuments(),
  ]);
  res.json({ books, issued, available: books - issued, overdue, sections, today, defaultDays: DEFAULT_LOAN_DAYS, defaultDue: addDays(today, DEFAULT_LOAN_DAYS) });
}));

// ── Sections ─────────────────────────────────────────────────────────────────
router.get('/sections', lib, wrap(async (_req, res) => {
  const [sections, counts] = await Promise.all([
    LibrarySection.find().collation({ locale: 'en' }).sort({ name: 1 }).lean(),
    LibraryBook.aggregate([{ $group: { _id: '$section', n: { $sum: 1 } } }]),
  ]);
  const n = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(sections.map((s) => ({ id: String(s._id), name: s.name, books: n.get(String(s._id)) || 0 })));
}));

router.post('/sections', lib, wrap(async (req, res) => {
  const name = str(req.body.name);
  if (!name) throw bad('Enter a section name.');
  if (name.length > 60) throw bad('The section name is too long.');
  try {
    const s = await LibrarySection.create({ name });
    res.status(201).json({ id: String(s._id), name: s.name, books: 0 });
  } catch (e) { throw isDupe(e) ? new HttpError(409, 'There is already a section with that name.') : e; }
}));

router.put('/sections/:id', lib, wrap(async (req, res) => {
  const name = str(req.body.name);
  if (!name) throw bad('Enter a section name.');
  if (name.length > 60) throw bad('The section name is too long.');
  try {
    const s = await LibrarySection.findByIdAndUpdate(oid(req.params.id), { $set: { name } }, { new: true });
    if (!s) throw notFound('Section not found.');
    res.json({ id: String(s._id), name: s.name });
  } catch (e) { throw isDupe(e) ? new HttpError(409, 'There is already a section with that name.') : e; }
}));

router.delete('/sections/:id', lib, wrap(async (req, res) => {
  const id = oid(req.params.id);
  if (await LibraryBook.exists({ section: id })) throw new HttpError(409, 'This section still has books. Move or remove them first.');
  const s = await LibrarySection.findByIdAndDelete(id);
  if (!s) throw notFound('Section not found.');
  res.json({ removed: true });
}));

// ── Books ────────────────────────────────────────────────────────────────────
async function nextAccession() {
  const last = await LibraryBook.find({ accession: /^LB-\d+$/ }).collation({ locale: 'en', numericOrdering: true }).sort({ accession: -1 }).limit(1).lean();
  const n = last[0] ? Number(last[0].accession.slice(3)) + 1 : 1;
  return `LB-${String(n).padStart(4, '0')}`;
}

const bookFields = async (body) => {
  const title = str(body.title);
  if (!title) throw bad('Enter the book title.');
  if (title.length > 200 || str(body.author).length > 150 || str(body.isbn).length > 30) throw bad('The title, author or ISBN is too long.');
  const section = await LibrarySection.findById(oid(body.section)).lean();
  if (!section) throw bad('Choose a section for the book.');
  return { title, author: str(body.author), isbn: str(body.isbn), section: section._id };
};

router.get('/books', lib, wrap(async (req, res) => {
  const q = str(req.query.q), status = str(req.query.status), sectionId = str(req.query.section);
  const filter = {};
  if (sectionId) filter.section = oid(sectionId);
  if (['available', 'issued'].includes(status)) filter.status = status;
  if (q) { const re = new RegExp(esc(q), 'i'); filter.$or = [{ title: re }, { author: re }, { accession: re }, { isbn: re }]; }
  const [books, total] = await Promise.all([
    LibraryBook.find(filter).collation({ locale: 'en' }).sort({ title: 1 }).limit(300).populate('section', 'name').lean(),
    LibraryBook.countDocuments(filter),
  ]);
  const loans = await LibraryLoan.find({ open: true, book: { $in: books.map((b) => b._id) } }).lean();
  const loanOf = new Map(loans.map((l) => [String(l.book), l]));
  const today = todayIST();
  res.json({
    total,
    books: books.map((b) => {
      const l = loanOf.get(String(b._id));
      return {
        id: String(b._id), accession: b.accession, title: b.title, author: b.author || '', isbn: b.isbn || '',
        sectionId: b.section ? String(b.section._id) : '', section: b.section?.name || '', status: b.status,
        loan: l ? { borrowerName: l.borrowerName, borrowerClass: l.borrowerClass, dueOn: l.dueOn, overdue: l.dueOn < today } : null,
      };
    }),
  });
}));

// body: { title, author, isbn, section, accession (optional), copies (optional, 1-50) }
router.post('/books', lib, wrap(async (req, res) => {
  const fields = await bookFields(req.body);
  const given = str(req.body.accession);
  const copies = Math.min(Math.max(parseInt(req.body.copies, 10) || 1, 1), 50);
  if (given && copies > 1) throw bad('Leave the accession number empty when adding several copies.');
  const added = [];
  for (let i = 0; i < copies; i += 1) {
    for (let attempt = 0; ; attempt += 1) {
      const accession = given || await nextAccession();
      try { added.push(await LibraryBook.create({ ...fields, accession })); break; }
      catch (e) {
        if (!isDupe(e)) throw e;
        if (given) throw new HttpError(409, 'That accession number is already used by another book.');
        if (attempt >= 5) throw e;
      }
    }
  }
  res.status(201).json({ added: added.length, accessions: added.map((b) => b.accession) });
}));

router.put('/books/:id', lib, wrap(async (req, res) => {
  const fields = await bookFields(req.body);
  const accession = str(req.body.accession);
  if (!accession) throw bad('Enter the accession number.');
  try {
    const b = await LibraryBook.findByIdAndUpdate(oid(req.params.id), { $set: { ...fields, accession } }, { new: true });
    if (!b) throw notFound('Book not found.');
    await LibraryLoan.updateMany({ book: b._id, open: true }, { $set: { bookTitle: b.title, accession: b.accession } });
    res.json({ id: String(b._id) });
  } catch (e) { throw isDupe(e) ? new HttpError(409, 'That accession number is already used by another book.') : e; }
}));

// A book that is out on loan cannot be removed. Its past loans stay in the history.
router.delete('/books/:id', lib, wrap(async (req, res) => {
  const b = await LibraryBook.findById(oid(req.params.id));
  if (!b) throw notFound('Book not found.');
  if (b.status === 'issued' || await LibraryLoan.exists({ book: b._id, open: true })) throw new HttpError(409, 'This book is issued. Return it before removing it.');
  await b.deleteOne();
  res.json({ removed: true });
}));

// ── Borrowers (students and teachers) ────────────────────────────────────────
router.get('/borrowers', lib, wrap(async (req, res) => {
  const q = str(req.query.q);
  if (q.length < 2) return res.json([]);
  const re = new RegExp(esc(q), 'i');
  const people = await User.find({ role: { $in: [ROLES.STUDENT, ROLES.TEACHER] }, $or: [{ name: re }, { email: re }, { username: re }] })
    .collation({ locale: 'en' }).sort({ name: 1 }).limit(15).select('name email role grade section').lean();
  const out = await LibraryLoan.aggregate([{ $match: { open: true, borrower: { $in: people.map((p) => p._id) } } }, { $group: { _id: '$borrower', n: { $sum: 1 } } }]);
  const n = new Map(out.map((o) => [String(o._id), o.n]));
  return res.json(people.map((p) => ({
    id: String(p._id), name: p.name, email: p.email || '', type: p.role,
    className: p.role === ROLES.STUDENT ? `${p.grade || ''} ${p.section || ''}`.trim() : 'Teacher',
    booksOut: n.get(String(p._id)) || 0,
  })));
}));

// ── Issue and return ─────────────────────────────────────────────────────────
const loanJson = (l, today) => ({
  id: String(l._id), bookId: String(l.book), title: l.bookTitle, accession: l.accession, section: l.sectionName || '',
  borrower: { id: String(l.borrower), name: l.borrowerName, type: l.borrowerRole, className: l.borrowerClass || '' },
  issuedOn: l.issuedOn, dueOn: l.dueOn, returnedOn: l.returnedOn, open: l.open,
  overdue: l.open && l.dueOn < today,
  daysOverdue: l.open && l.dueOn < today ? Math.round((Date.parse(today) - Date.parse(l.dueOn)) / 86400000) : 0,
});

// body: { bookId, borrowerId, dueOn (optional, default 14 days) }
router.post('/issue', lib, wrap(async (req, res) => {
  const today = todayIST();
  const dueOn = str(req.body.dueOn) || addDays(today, DEFAULT_LOAN_DAYS);
  if (!validDate(dueOn)) throw bad('Choose a valid due date.');
  if (dueOn < today) throw bad('The due date cannot be in the past.');
  const borrower = await User.findOne({ _id: oid(req.body.borrowerId), role: { $in: [ROLES.STUDENT, ROLES.TEACHER] } }).select('name role grade section').lean();
  if (!borrower) throw notFound('Choose a student or teacher.');

  // Take the book first, in one step, so two people can never be given the same copy.
  const bookId = oid(req.body.bookId);
  const book = await LibraryBook.findOneAndUpdate({ _id: bookId, status: 'available' }, { $set: { status: 'issued' } }, { new: true }).populate('section', 'name');
  if (!book) throw (await LibraryBook.exists({ _id: bookId })) ? new HttpError(409, 'That book is already issued.') : notFound('Book not found.');

  try {
    const loan = await LibraryLoan.create({
      book: book._id, bookTitle: book.title, accession: book.accession, sectionName: book.section?.name || '',
      borrower: borrower._id, borrowerName: borrower.name, borrowerRole: borrower.role,
      borrowerClass: borrower.role === ROLES.STUDENT ? `${borrower.grade || ''} ${borrower.section || ''}`.trim() : '',
      issuedOn: today, dueOn, issuedBy: req.user.id,
    });
    res.status(201).json(loanJson(loan, today));
  } catch (e) {
    await LibraryBook.updateOne({ _id: book._id }, { $set: { status: 'available' } });
    throw e;
  }
}));

// body: { loanId }
router.post('/return', lib, wrap(async (req, res) => {
  const today = todayIST();
  const loan = await LibraryLoan.findOneAndUpdate({ _id: oid(req.body.loanId), open: true }, { $set: { open: false, returnedOn: today } }, { new: true });
  if (!loan) throw notFound('That book is not out on loan.');
  await LibraryBook.updateOne({ _id: loan.book }, { $set: { status: 'available' } });
  res.json(loanJson(loan, today));
}));

// status: open (default) | overdue | returned | all
router.get('/loans', lib, wrap(async (req, res) => {
  const status = str(req.query.status) || 'open', q = str(req.query.q), today = todayIST();
  const filter = status === 'overdue' ? { open: true, dueOn: { $lt: today } } : status === 'returned' ? { open: false } : status === 'all' ? {} : { open: true };
  if (q) { const re = new RegExp(esc(q), 'i'); filter.$or = [{ bookTitle: re }, { accession: re }, { borrowerName: re }, { borrowerClass: re }]; }
  const sort = filter.open === true ? { dueOn: 1 } : { created: -1 };
  const [loans, total] = await Promise.all([LibraryLoan.find(filter).sort(sort).limit(300).lean(), LibraryLoan.countDocuments(filter)]);
  res.json({ total, loans: loans.map((l) => loanJson(l, today)) });
}));

export default router;

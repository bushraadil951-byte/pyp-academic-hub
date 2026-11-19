import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Field, Loading, Modal, Stat, fmtDate } from '../../components/ui.jsx';

const useDebounced = (v, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

// Librarian only: issue and return books, manage books and sections, and see the history.
export default function Library() {
  const { data: ov, error, reload } = useFetch('/library/overview');
  const [tab, setTab] = useState('issue');
  const [tick, setTick] = useState(0);                 // bumped after every change so lists refresh
  const changed = () => { reload(); setTick((t) => t + 1); };

  if (error) return <div className="alert alert-error">{error.message}</div>;
  if (!ov) return <Loading />;
  const TABS = [['issue', 'Issue & return'], ['books', 'Books'], ['sections', 'Sections'], ['history', 'History']];

  return (
    <>
      <div className="stat-grid">
        <Stat icon="📚" bg="#eef2ff" value={ov.books} label="Books in library" />
        <Stat icon="✅" bg="#ecfdf5" value={ov.available} label="Available" />
        <Stat icon="📖" bg="#fffbeb" value={ov.issued} label="Issued" />
        <Stat icon="⏰" bg="#fef2f2" value={ov.overdue} label="Overdue" />
      </div>
      <div className="tab-bar">
        {TABS.map(([k, label]) => <button key={k} type="button" className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'issue' && <IssueReturn ov={ov} tick={tick} changed={changed} />}
      {tab === 'books' && <Books tick={tick} changed={changed} />}
      {tab === 'sections' && <Sections tick={tick} changed={changed} />}
      {tab === 'history' && <div className="card"><div className="card-title">Loan history</div><Loans initial="all" tick={tick} changed={changed} /></div>}
    </>
  );
}

// ── Issue and return ─────────────────────────────────────────────────────────
function IssueReturn({ ov, tick, changed }) {
  const flash = useFlash();
  const [bookQ, setBookQ] = useState('');
  const [borrowerQ, setBorrowerQ] = useState('');
  const [bookRes, setBookRes] = useState([]);
  const [borrowerRes, setBorrowerRes] = useState([]);
  const [book, setBook] = useState(null);
  const [borrower, setBorrower] = useState(null);
  const [due, setDue] = useState(ov.defaultDue);
  const [busy, setBusy] = useState(false);
  const bq = useDebounced(bookQ), pq = useDebounced(borrowerQ);

  useEffect(() => {
    if (!bq.trim()) { setBookRes([]); return undefined; }
    let live = true;
    api.get(`/library/books?${new URLSearchParams({ q: bq, status: 'available' })}`).then((d) => live && setBookRes(d.books.slice(0, 8))).catch(() => {});
    return () => { live = false; };
  }, [bq, tick]);
  useEffect(() => {
    if (pq.trim().length < 2) { setBorrowerRes([]); return undefined; }
    let live = true;
    api.get(`/library/borrowers?${new URLSearchParams({ q: pq })}`).then((d) => live && setBorrowerRes(d)).catch(() => {});
    return () => { live = false; };
  }, [pq, tick]);

  const issue = async () => {
    setBusy(true);
    try {
      await api.post('/library/issue', { bookId: book.id, borrowerId: borrower.id, dueOn: due });
      flash(`“${book.title}” issued to ${borrower.name}, due ${fmtDate(due)}.`);
      setBook(null); setBorrower(null); setBookQ(''); setBorrowerQ(''); setDue(ov.defaultDue); changed();
    } catch (e) { flash(e.message, 'error'); } finally { setBusy(false); }
  };

  const pick = (item, onClick, title, sub, right) => (
    <button key={item.id} type="button" onClick={onClick} className="btn btn-secondary btn-sm" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', textAlign: 'left', marginBottom: 6 }}>
      <span><strong>{title}</strong><div className="sec-sub">{sub}</div></span>{right}
    </button>
  );

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Issue a book</div>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div>
            <Field label="1. Book (title, author or accession number)">
              {book ? (
                <div className="alert alert-success" style={{ margin: 0 }}>
                  <strong>{book.title}</strong> · {book.accession}
                  <button type="button" className="btn btn-secondary btn-xs" style={{ marginLeft: 8 }} onClick={() => setBook(null)}>Change</button>
                </div>
              ) : (
                <>
                  <input className="form-input" placeholder="Search available books…" value={bookQ} onChange={(e) => setBookQ(e.target.value)} />
                  <div style={{ marginTop: 8 }}>
                    {bookQ.trim() && bookRes.length === 0 && <div className="sec-sub">No available book matches.</div>}
                    {bookRes.map((b) => pick(b, () => setBook(b), b.title, `${b.author || 'Unknown author'} · ${b.section}`, <Badge tone="gray">{b.accession}</Badge>))}
                  </div>
                </>)}
            </Field>
          </div>
          <div>
            <Field label="2. Borrower (student or teacher)">
              {borrower ? (
                <div className="alert alert-success" style={{ margin: 0 }}>
                  <strong>{borrower.name}</strong> · {borrower.className}
                  {borrower.booksOut > 0 && <span> · has {borrower.booksOut} book(s) out</span>}
                  <button type="button" className="btn btn-secondary btn-xs" style={{ marginLeft: 8 }} onClick={() => setBorrower(null)}>Change</button>
                </div>
              ) : (
                <>
                  <input className="form-input" placeholder="Search by name or email…" value={borrowerQ} onChange={(e) => setBorrowerQ(e.target.value)} />
                  <div style={{ marginTop: 8 }}>
                    {borrowerQ.trim().length >= 2 && borrowerRes.length === 0 && <div className="sec-sub">No student or teacher matches.</div>}
                    {borrowerRes.map((p) => pick(p, () => setBorrower(p), p.name, p.email || p.className, <Badge tone={p.type === 'teacher' ? 'blue' : 'gray'}>{p.className}</Badge>))}
                  </div>
                </>)}
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          <Field label={`3. Due date (default ${ov.defaultDays} days)`}>
            <input type="date" className="form-input" value={due} min={ov.today} onChange={(e) => e.target.value && setDue(e.target.value)} />
          </Field>
          <button type="button" className="btn btn-primary" disabled={!book || !borrower || busy} onClick={issue}>{busy ? 'Issuing…' : 'Issue book'}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Books out</div>
        <Loans initial="open" tick={tick} changed={changed} canReturn />
      </div>
    </>
  );
}

// A table of loans with a status filter and search. Used for "Books out" (with Return) and for the history.
function Loans({ initial, tick, changed, canReturn = false }) {
  const flash = useFlash();
  const [status, setStatus] = useState(initial);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    api.get(`/library/loans?${new URLSearchParams({ status, q: dq })}`).then((r) => { if (live) { setD(r); setError(null); } }).catch((e) => live && setError(e));
    return () => { live = false; };
  }, [status, dq, tick]);

  const giveBack = async (l) => {
    try { await api.post('/library/return', { loanId: l.id }); flash(`“${l.title}” returned by ${l.borrower.name}.`); changed(); }
    catch (e) { flash(e.message, 'error'); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search book, accession or borrower…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="open">Out now</option><option value="overdue">Overdue</option><option value="returned">Returned</option><option value="all">All</option>
        </select>
      </div>
      {error ? <div className="alert alert-error">{error.message}</div> : !d ? <Loading /> : d.loans.length === 0 ? <Empty>No loans to show.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Book</th><th>Borrower</th><th>Issued</th><th>Due</th><th>Status</th>{canReturn && <th />}</tr></thead>
          <tbody>{d.loans.map((l) => (
            <tr key={l.id}>
              <td><strong>{l.title}</strong><div className="sec-sub">{l.accession}{l.section ? ` · ${l.section}` : ''}</div></td>
              <td>{l.borrower.name}<div className="sec-sub">{l.borrower.className || 'Teacher'}</div></td>
              <td>{fmtDate(l.issuedOn)}</td><td>{fmtDate(l.dueOn)}</td>
              <td>{!l.open ? <Badge tone="green">Returned {fmtDate(l.returnedOn)}</Badge> : l.overdue ? <Badge tone="red">Overdue {l.daysOverdue} day{l.daysOverdue === 1 ? '' : 's'}</Badge> : <Badge tone="amber">Out</Badge>}</td>
              {canReturn && <td>{l.open && <button type="button" className="btn btn-primary btn-sm" onClick={() => giveBack(l)}>Return</button>}</td>}
            </tr>))}
          </tbody>
        </table></div>)}
      {d && d.total > d.loans.length && <div className="sec-sub" style={{ marginTop: 8 }}>Showing the first {d.loans.length} of {d.total}. Use the search to narrow it down.</div>}
    </>
  );
}

// ── Books ────────────────────────────────────────────────────────────────────
const blankBook = (section = '') => ({ title: '', author: '', isbn: '', section, accession: '', copies: 1 });

function Books({ tick, changed }) {
  const flash = useFlash();
  const { data: sections } = useFetch('/library/sections');
  const [q, setQ] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDebounced(q);
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);       // null = closed; { id?, ...fields }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.get(`/library/books?${new URLSearchParams({ q: dq, section, status })}`).then((r) => live && setD(r)).catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [dq, section, status, tick, flash]);

  if (!sections) return <Loading />;

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (form.id) { await api.put(`/library/books/${form.id}`, form); flash('Book updated.'); }
      else {
        const r = await api.post('/library/books', form);
        flash(r.added === 1 ? `Book added (${r.accessions[0]}).` : `${r.added} copies added (${r.accessions[0]} to ${r.accessions[r.accessions.length - 1]}).`);
      }
      setForm(null); changed();
    } catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (b) => {
    if (!window.confirm(`Remove “${b.title}” (${b.accession}) from the library?`)) return;
    try { await api.del(`/library/books/${b.id}`); flash('Book removed.'); changed(); } catch (err) { flash(err.message, 'error'); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="card">
      <div className="sec-header">
        <div className="sec-title">Books</div>
        <button type="button" className="btn btn-primary" disabled={sections.length === 0} onClick={() => setForm(blankBook(section || sections[0]?.id))}>+ Add book</button>
      </div>
      {sections.length === 0 && <div className="alert alert-error" style={{ marginBottom: 12 }}>Add a section first (Sections tab), then you can add books to it.</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search title, author, accession or ISBN…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-input" style={{ width: 'auto' }} value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section">
          <option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option><option value="available">Available</option><option value="issued">Issued</option>
        </select>
      </div>
      {!d ? <Loading /> : d.books.length === 0 ? <Empty>No books found.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Accession</th><th>Title</th><th>Author</th><th>Section</th><th>Status</th><th /></tr></thead>
          <tbody>{d.books.map((b) => (
            <tr key={b.id}>
              <td><code>{b.accession}</code></td>
              <td style={{ fontWeight: 500 }}>{b.title}{b.isbn && <div className="sec-sub">ISBN {b.isbn}</div>}</td>
              <td>{b.author || '—'}</td><td>{b.section}</td>
              <td>{b.status === 'available' ? <Badge tone="green">Available</Badge> : <Badge tone={b.loan?.overdue ? 'red' : 'amber'}>Issued</Badge>}
                {b.loan && <div className="sec-sub">{b.loan.borrowerName} · due {fmtDate(b.loan.dueOn)}</div>}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => setForm({ id: b.id, title: b.title, author: b.author, isbn: b.isbn, section: b.sectionId, accession: b.accession, copies: 1 })}>Edit</button>{' '}
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => remove(b)}>Remove</button>
              </td>
            </tr>))}
          </tbody>
        </table></div>)}
      {d && d.total > d.books.length && <div className="sec-sub" style={{ marginTop: 8 }}>Showing the first {d.books.length} of {d.total}. Use the search or filters to narrow it down.</div>}

      {form && (
        <Modal title={form.id ? 'Edit book' : 'Add book'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-group"><label className="form-label">Title</label><input className="form-input" required maxLength={200} value={form.title} onChange={set('title')} /></div>
            <div className="form-group"><label className="form-label">Author</label><input className="form-input" maxLength={150} value={form.author} onChange={set('author')} /></div>
            <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              <div className="form-group"><label className="form-label">Section</label>
                <select className="form-input" required value={form.section} onChange={set('section')}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">ISBN (optional)</label><input className="form-input" maxLength={30} value={form.isbn} onChange={set('isbn')} /></div>
              <div className="form-group"><label className="form-label">{form.id ? 'Accession number' : 'Accession number (optional)'}</label>
                <input className="form-input" required={!!form.id} maxLength={30} placeholder={form.id ? '' : 'Leave empty to number it automatically'} value={form.accession} onChange={set('accession')} /></div>
              {!form.id && <div className="form-group"><label className="form-label">Copies</label>
                <input className="form-input" type="number" min="1" max="50" value={form.copies} onChange={set('copies')} /></div>}
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Add book'}</button>
          </form>
        </Modal>)}
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────
function Sections({ tick, changed }) {
  const flash = useFlash();
  const { data, reload } = useFetch('/library/sections');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (tick) reload(); }, [tick, reload]);
  if (!data) return <Loading />;

  const add = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/library/sections', { name }); setName(''); flash('Section added.'); reload(); changed(); }
    catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };
  const rename = async (s) => {
    const next = window.prompt('New name for this section:', s.name);
    if (next === null || !next.trim() || next.trim() === s.name) return;
    try { await api.put(`/library/sections/${s.id}`, { name: next }); flash('Section renamed.'); reload(); changed(); } catch (err) { flash(err.message, 'error'); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Remove the section “${s.name}”?`)) return;
    try { await api.del(`/library/sections/${s.id}`); flash('Section removed.'); reload(); changed(); } catch (err) { flash(err.message, 'error'); }
  };

  return (
    <div className="card">
      <div className="card-title">Sections</div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ maxWidth: 320 }} required maxLength={60} placeholder="New section, for example Story books" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>Add section</button>
      </form>
      {data.length === 0 ? <Empty>No sections yet. Add one to start adding books.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Section</th><th>Books</th><th /></tr></thead>
          <tbody>{data.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.books}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => rename(s)}>Rename</button>{' '}
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => remove(s)}>Remove</button>
              </td>
            </tr>))}
          </tbody>
        </table></div>)}
    </div>
  );
}

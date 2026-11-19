import { useState } from 'react';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Loading } from '../../components/ui.jsx';

// Administrator: create the librarian's login and reset her password. The library itself is only for the librarian.
export default function LibrarianAccount() {
  const flash = useFlash();
  const { data, error, loading, reload } = useFetch('/library/account');
  const [form, setForm] = useState({ name: 'Librarian', email: 'librarian@e-p-s.in' });
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(null);     // { email, tempPassword } shown once

  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('/library/account', form);
      setShown({ email: r.email, tempPassword: r.tempPassword });
      flash('Librarian account created.'); reload();
    } catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm('Issue a new temporary password for the librarian? Her current password will stop working.')) return;
    setBusy(true);
    try {
      const r = await api.post(`/account/admin-reset/${data.id}`);
      setShown({ email: r.email || data.email, tempPassword: r.tempPassword });
    } catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      {shown && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <strong>Temporary password for {shown.email}:</strong> <code style={{ fontSize: '1rem' }}>{shown.tempPassword}</code>
          <div className="sec-sub">Copy it now. It is shown only once. She will choose her own password the first time she signs in.</div>
        </div>)}
      <div className="card">
        <div className="card-title">Librarian account</div>
        <p className="sec-sub" style={{ marginBottom: 14 }}>The librarian signs in with her school email and sees only the Library: issuing and returning books, books and sections. Nobody else can open the Library, including administrators.</p>
        {data.exists ? (
          <>
            <div style={{ marginBottom: 12 }}><strong>{data.name}</strong><div className="sec-sub">{data.email}</div></div>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={reset}>Reset password</button>
          </>
        ) : (
          <form onSubmit={create}>
            <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              <div className="form-group"><label className="form-label">Name</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Email</label>
                <input className="form-input" type="email" required pattern="[A-Za-z0-9._%+\-]+@e-p-s\.in" placeholder="Enter official email id (@e-p-s.in)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create librarian account'}</button>
          </form>)}
      </div>
    </>
  );
}

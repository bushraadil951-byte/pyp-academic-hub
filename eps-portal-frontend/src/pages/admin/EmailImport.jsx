import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { downloadCsv, parseCsv, toRecords } from '../../csv.js';
import { useFlash } from '../../flash.jsx';

// Fill in recovery emails for existing students and teachers in one go (needed before they can use "Forgot password").
export default function EmailImport() {
  const flash = useFlash();
  const [rows, setRows] = useState(null);
  const [file, setFile] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const template = async () => {
    try {
      const [students, teachers] = await Promise.all([api.get('/admin/students'), api.get('/admin/teachers')]);
      const list = [...teachers.map((p) => ({ ...p, kind: 'Teacher' })), ...students.map((p) => ({ ...p, kind: 'Student' }))];
      downloadCsv('emails_template.csv', [['username', 'email', 'name', 'type', 'grade'], ...list.map((p) => [p.username, p.email || '', p.name, p.kind, p.grade || ''])]);
    } catch (e) { flash(e.message, 'error'); }
  };

  const onFile = async (e) => {
    const f = e.target.files[0];
    setResult(null); setRows(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) return flash('Please choose a .csv file.', 'error');
    const { keys, records } = toRecords(parseCsv(await f.text()));
    if (!keys.includes('username') || !keys.includes('email')) return flash('The file needs "username" and "email" columns.', 'error');
    const list = records.filter((r) => r.username && r.email);
    if (!list.length) return flash('No rows with both a username and an email were found.', 'error');
    setFile(f.name); setRows(list.map((r) => ({ username: r.username, email: r.email })));
  };

  const send = async () => {
    setBusy(true);
    try { const r = await api.post('/admin/student-upload/emails', { rows }); setResult(r); setRows(null); flash(`${r.updated} email address(es) saved.`); }
    catch (e) { flash(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">Import recovery emails</div><div className="sec-sub">People with an email on file can reset their own password with a one-time code. For students, use a parent or guardian address.</div></div>
        <Link to="/admin/students" className="btn btn-secondary btn-sm">Back to students</Link>
      </div>
      <div className="card" style={{ maxWidth: 760 }}>
        <ol className="sec-sub" style={{ paddingLeft: 18, marginBottom: 14, lineHeight: 1.8 }}>
          <li>Download the template. It lists every student and teacher with their username.</li>
          <li>Fill in the <strong>email</strong> column and save the file as CSV.</li>
          <li>Upload it here. Matching is by username; other columns are ignored.</li>
        </ol>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={template}>Download template</button>
          <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="Emails CSV file" />
        </div>
        {rows && (
          <div style={{ marginTop: 14 }}>
            <div className="alert alert-success">{file}: {rows.length} row(s) ready.</div>
            <button className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Saving…' : `Save ${rows.length} email${rows.length === 1 ? '' : 's'}`}</button>
          </div>
        )}
        {result && (
          <div style={{ marginTop: 14 }}>
            <div className="alert alert-success">{result.updated} email address(es) saved.</div>
            {result.notFound.length > 0 && <div className="alert alert-error">No account with these usernames: {result.notFound.slice(0, 20).join(', ')}{result.notFound.length > 20 ? '…' : ''}</div>}
            {result.invalid.length > 0 && <div className="alert alert-error">Skipped: {result.invalid.slice(0, 10).map((x) => `${x.username} (${x.message})`).join('; ')}{result.invalid.length > 10 ? '…' : ''}</div>}
          </div>
        )}
      </div>
    </>
  );
}

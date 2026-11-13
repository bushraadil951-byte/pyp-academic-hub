import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { downloadCsv, parseCsv, toRecords } from '../../csv.js';
import { useFlash } from '../../flash.jsx';
import { Badge, Empty } from '../../components/ui.jsx';

const TONE = { ok: 'green', exists: 'amber', invalid: 'red' };
const LABEL = { ok: 'Ready', exists: 'Duplicate', invalid: 'Fix needed' };

export default function StudentUpload() {
  const flash = useFlash();
  const [rows, setRows] = useState(null);       // annotated preview rows
  const [file, setFile] = useState('');
  const [result, setResult] = useState(null);   // confirm response
  const [busy, setBusy] = useState(false);

  const template = () => downloadCsv('students_template.csv', [
    ['name', 'grade', 'section', 'email'],
    ['Student One', 'Grade 3', 'A', 'student.one@e-p-s.in'],
    ['Student Two', 'Nursery', 'B', 'student.two@e-p-s.in']]);

  const check = async (list) => {
    setBusy(true);
    try { const r = await api.post('/admin/student-upload/preview', { rows: list }); setRows(r.rows); }
    catch (e) { flash(e.message, 'error'); } finally { setBusy(false); }
  };

  const onFile = async (e) => {
    const f = e.target.files[0];
    setResult(null); setRows(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) return flash('Please choose a .csv file.', 'error');
    const { keys, records } = toRecords(parseCsv(await f.text()));
    if (!keys.includes('name') || !keys.includes('grade') || !keys.includes('email')) return flash('The file needs "name", "grade" and "email" columns.', 'error');
    const list = records.filter((r) => r.name && r.grade);
    if (!list.length) return flash('No student rows found in the file.', 'error');
    setFile(f.name);
    await check(list);
  };

  // The temporary passwords exist only in this response: the file can be saved while this page is open, and never again.
  const savePasswords = (created) => downloadCsv(`new_students_passwords_${new Date().toISOString().slice(0, 10)}.csv`, [
    ['name', 'grade', 'section', 'email', 'temporary password'],
    ...created.map((s) => [s.name, s.grade, s.section, s.email, s.tempPassword])]);

  const edit = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/student-upload/confirm', { rows });
      setResult(r); setRows(null);
      if (r.created.length) savePasswords(r.created);
      flash(`${r.added} student(s) added${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}.`);
    } catch (e) { flash(e.message, 'error'); } finally { setBusy(false); }
  };

  const counts = rows ? { ok: rows.filter((r) => r.status === 'ok').length, bad: rows.filter((r) => r.status !== 'ok').length } : null;

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">Bulk upload students</div><div className="sec-sub">Upload a CSV, review it, then confirm. Each student gets a temporary password.</div></div>
        <Link to="/admin/students" className="btn btn-secondary btn-sm">Back to students</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="sec-sub" style={{ marginBottom: 10 }}>
          Columns: <code>name, grade, section, email</code>. <strong>name</strong>, <strong>grade</strong> and <strong>email</strong> are required. Grade can be <code>Nursery</code>, <code>KG-1</code>, <code>KG-2</code> or <code>Grade 1</code> to <code>Grade 5</code> (a plain number such as <code>3</code> also works). <strong>email</strong> is the student's own school address, which they sign in with (up to 500 students per file).
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={template}>Download template</button>
          <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="Students CSV file" />
        </div>
      </div>

      {rows && (
        <div className="card">
          <div className="sec-header">
            <div><div className="sec-title">Preview · {file}</div><div className="sec-sub">{counts.ok} ready{counts.bad ? ` · ${counts.bad} need attention (they will be skipped)` : ''}. Fix any email, then re-check.</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" disabled={busy} onClick={() => check(rows)}>Re-check</button>
              <button className="btn btn-primary" disabled={busy || counts.ok === 0} onClick={confirm}>{busy ? 'Working…' : `Add ${counts.ok} student${counts.ok === 1 ? '' : 's'}`}</button>
            </div>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Grade</th><th>Sec</th><th>School email</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.grade}</td><td>{r.section}</td>
                <td><input className="form-input" type="email" aria-label={`Email for ${r.name}`} value={r.email || ''} onChange={(e) => edit(i, { email: e.target.value })} /></td>
                <td><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>{r.message && <div className="sec-sub">{r.message}</div>}</td>
                <td><button className="btn btn-danger btn-xs" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`}>✕</button></td>
              </tr>))}
            </tbody>
          </table></div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="alert alert-success">{result.added} student(s) added.</div>
          {result.created.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="sec-sub" style={{ marginBottom: 8 }}>
                Their temporary passwords were downloaded as a CSV file. Keep it private, give each student theirs, then delete the file.
                The passwords cannot be shown again once you leave this page. Each student chooses their own at first sign-in.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => savePasswords(result.created)}>Download passwords again</button>
            </div>
          )}
          {result.skipped.length > 0 && (<><div className="card-title">Skipped</div>{result.skipped.map((s, i) => <div key={i} className="sec-sub">{s.name} ({s.email || 'no email'}): {s.message}</div>)}</>)}
          {result.added === 0 && result.skipped.length === 0 && <Empty>Nothing was added.</Empty>}
        </div>
      )}
    </>
  );
}

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
    ['name', 'username', 'password', 'grade', 'section'], ['Ahmed Khan', 'ahmed_01', 'ahm@01', 'Grade 3', 'A'], ['Sara Ali', '', '', 'Grade 4', 'B']]);

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
    if (!keys.includes('name') || !keys.includes('grade')) return flash('The file needs "name" and "grade" columns.', 'error');
    const list = records.filter((r) => r.name && r.grade);
    if (!list.length) return flash('No student rows found in the file.', 'error');
    setFile(f.name);
    await check(list);
  };

  const edit = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/student-upload/confirm', { rows });
      setResult(r); setRows(null);
      flash(`${r.added} student(s) added${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}.`);
    } catch (e) { flash(e.message, 'error'); } finally { setBusy(false); }
  };

  const counts = rows ? { ok: rows.filter((r) => r.status === 'ok').length, bad: rows.filter((r) => r.status !== 'ok').length } : null;

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">Bulk upload students</div><div className="sec-sub">Upload a CSV, review the generated usernames and passwords, then confirm.</div></div>
        <Link to="/admin/students" className="btn btn-secondary btn-sm">Back to students</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="sec-sub" style={{ marginBottom: 10 }}>
          Columns: <code>name, username, password, grade, section</code>. Only <strong>name</strong> and <strong>grade</strong> are required.
          Empty usernames become <code>firstname_g3</code>; empty passwords become <code>EPS@Ahm3</code>-style defaults (up to 500 students per file).
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={template}>Download template</button>
          <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="Students CSV file" />
        </div>
      </div>

      {rows && (
        <div className="card">
          <div className="sec-header">
            <div><div className="sec-title">Preview · {file}</div><div className="sec-sub">{counts.ok} ready{counts.bad ? ` · ${counts.bad} need attention (they will be skipped)` : ''}. Edit any username or password, then re-check.</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" disabled={busy} onClick={() => check(rows)}>Re-check</button>
              <button className="btn btn-primary" disabled={busy || counts.ok === 0} onClick={confirm}>{busy ? 'Working…' : `Add ${counts.ok} student${counts.ok === 1 ? '' : 's'}`}</button>
            </div>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Grade</th><th>Sec</th><th>Username</th><th>Password</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.grade}</td><td>{r.section}</td>
                <td><input className="form-input" aria-label={`Username for ${r.name}`} value={r.username} onChange={(e) => edit(i, { username: e.target.value })} /></td>
                <td><input className="form-input" aria-label={`Password for ${r.name}`} value={r.password} onChange={(e) => edit(i, { password: e.target.value })} /></td>
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
            <button className="btn btn-secondary" onClick={() => downloadCsv('new_student_logins.csv', [['Name', 'Grade', 'Section', 'Username', 'Password'], ...result.created.map((c) => [c.name, c.grade, c.section, c.username, c.password])])}>
              Download logins for these students
            </button>)}
          <div className="sec-sub" style={{ margin: '8px 0' }}>Passwords are shown only now. Download the file and share it safely, then ask students to keep their password private.</div>
          {result.skipped.length > 0 && (<><div className="card-title">Skipped</div>{result.skipped.map((s, i) => <div key={i} className="sec-sub">{s.name} ({s.username || 'no username'}): {s.message}</div>)}</>)}
          {result.added === 0 && result.skipped.length === 0 && <Empty>Nothing was added.</Empty>}
        </div>
      )}
    </>
  );
}

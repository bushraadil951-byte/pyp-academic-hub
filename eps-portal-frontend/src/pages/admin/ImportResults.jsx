import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { downloadCsv, parseCsv, toRecords } from '../../csv.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Loading, Percent } from '../../components/ui.jsx';

// Import results of a mock test from a CSV (for example a Google Form export). Same flow as the old Flask page:
// choose the test, upload the file, check the preview, then confirm. Scores are calculated on the server.
export default function ImportResults() {
  const flash = useFlash();
  const [sp] = useSearchParams();
  const { data: tests, loading } = useFetch('/admin/tests');
  const [testId, setTestId] = useState(sp.get('testId') || '');
  const [file, setFile] = useState('');
  const [rows, setRows] = useState(null);        // parsed CSV rows [{ username, answers }]
  const [preview, setPreview] = useState(null);  // { test, rows, errors }
  const [done, setDone] = useState(null);        // confirm response
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (tests?.length && !testId) setTestId(tests[0].id); }, [tests, testId]);
  if (loading || !tests) return <Loading />;

  const test = tests.find((t) => t.id === testId);
  const reset = () => { setRows(null); setPreview(null); setDone(null); setFile(''); };

  const template = async () => {
    try {
      const students = await api.get('/admin/students');
      const mine = students.filter((s) => test.grade === 'All Grades' || s.grade === test.grade);
      const heads = ['username', ...Array.from({ length: test.questionCount }, (_, i) => `q${i + 1}`)];
      downloadCsv(`results_template_${test.name.replace(/[^a-z0-9]+/gi, '_')}.csv`, [heads, ...mine.map((s) => [s.username, ...heads.slice(1).map(() => '')])]);
    } catch (e) { flash(e.message, 'error'); }
  };

  const onFile = async (e) => {
    const f = e.target.files[0];
    setPreview(null); setDone(null); setRows(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) return flash('Please upload a valid .csv file.', 'error');
    const { keys, records } = toRecords(parseCsv(await f.text()));
    if (!keys.includes('username')) return flash('The file needs a "username" column.', 'error');
    const qKeys = keys.filter((k) => /^q\d+$/.test(k));
    if (!qKeys.length) return flash('The file needs answer columns named q1, q2, q3 ...', 'error');
    const list = records.filter((r) => r.username).map((r) => ({ username: r.username, answers: Object.fromEntries(qKeys.map((k) => [k, r[k]])) }));
    if (!list.length) return flash('No student rows found in the file.', 'error');
    setFile(f.name); setRows(list);
    setBusy(true);
    try { setPreview(await api.post('/admin/import-results/preview', { testId, rows: list })); }
    catch (err) { flash(err.message, 'error'); setRows(null); } finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try { const r = await api.post('/admin/import-results/confirm', { testId, rows }); setDone(r); setPreview(null); setRows(null); flash(`${r.added} student result(s) imported successfully!`); }
    catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #6366f1' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '.95rem' }}>📤 Import Google Form Results</h3>
        <p className="sec-sub" style={{ marginBottom: 12 }}>
          Upload a CSV file with student usernames and their answers (A/B/C/D) for each question. The system calculates the scores and saves the results as if the students had taken the test on the portal.
          Answers may also be the text of the chosen option, as exported by Google Forms.
        </p>
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, fontSize: '.8rem', fontFamily: 'monospace' }}>
          username,q1,q2,q3,q4,q5<br />ayesha_01,A,B,C,B,A<br />aynoor_02,A,A,C,B,B
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {tests.length === 0 ? <Empty>No tests yet. Create a test and add its questions first.</Empty> : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Select test</label>
              <select className="form-input" style={{ minWidth: 260 }} value={testId} onChange={(e) => { setTestId(e.target.value); reset(); }}>
                {tests.map((t) => <option key={t.id} value={t.id}>{t.mockNumber ? `IBT Mock ${t.mockNumber} · ` : ''}{t.name} ({t.grade})</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: '.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>CSV file</label>
              <input type="file" accept=".csv,text/csv" onChange={onFile} key={testId + (done ? 'd' : '')} aria-label="Results CSV file" />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!test || test.questionCount === 0} onClick={template}>⬇ Download CSV template</button>
          </div>
        )}
        {test && test.questionCount === 0 && <div className="alert alert-error" style={{ marginTop: 12 }}>This test has no questions yet. <Link to={`/admin/tests/${test.id}/questions`}>Add questions</Link> before importing results.</div>}
        {test && test.questionCount > 0 && <div className="sec-sub" style={{ marginTop: 10 }}>{test.name} has {test.questionCount} questions, so the file needs columns q1 to q{test.questionCount}. The template lists the students of {test.grade === 'All Grades' ? 'every grade' : test.grade}.</div>}
      </div>

      {preview && preview.errors.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <strong>⚠ Skipped rows:</strong>
          {preview.errors.map((e, i) => <div key={i} style={{ fontSize: '.78rem' }}>• {e}</div>)}
        </div>)}

      {preview && (
        <div className="card">
          <div className="sec-header">
            <div><div className="sec-title">👁 Preview · {preview.rows.length} student{preview.rows.length === 1 ? '' : 's'}</div><div className="sec-sub">{file} · {preview.test.name} · review before saving</div></div>
          </div>
          {preview.rows.length === 0 ? <Empty>Nothing to import: every row was skipped.</Empty> : (
            <div className="table-wrap" style={{ marginBottom: 16 }}><table>
              <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Score</th><th>Percentage</th><th>Notes</th></tr></thead>
              <tbody>{preview.rows.map((r, i) => (
                <tr key={r.username}>
                  <td>{i + 1}</td><td style={{ fontWeight: 600 }}>{r.name}</td><td><code>{r.username}</code></td>
                  <td>{r.score} / {r.total}</td><td><Percent value={r.percent} /></td>
                  <td style={{ fontSize: '.75rem', color: 'var(--ink3)' }}>
                    {r.blank > 0 && <div>{r.blank} blank</div>}
                    {r.unreadable > 0 && <div style={{ color: 'var(--red)' }}>{r.unreadable} unreadable (counted as blank)</div>}
                    {r.warning && <div style={{ color: 'var(--amber)' }}>{r.warning}</div>}
                  </td>
                </tr>))}
              </tbody>
            </table></div>)}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" disabled={busy || preview.rows.length === 0} onClick={confirm}>{busy ? 'Saving…' : `✅ Confirm & Save ${preview.rows.length} Result${preview.rows.length === 1 ? '' : 's'}`}</button>
            <button className="btn btn-secondary" onClick={reset}>✖ Cancel</button>
          </div>
        </div>)}

      {done && (
        <div className="card">
          <div className="alert alert-success">{done.added} student result(s) imported for {done.test.name}.</div>
          {done.errors.length > 0 && <div className="alert alert-error">{done.errors.map((e, i) => <div key={i} style={{ fontSize: '.78rem' }}>• {e}</div>)}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/analytics" className="btn btn-primary">View analytics</Link>
            <button className="btn btn-secondary" onClick={reset}>Import another file</button>
          </div>
        </div>)}
    </>
  );
}

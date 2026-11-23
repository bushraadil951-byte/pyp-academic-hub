import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading } from '../../components/ui.jsx';
import { downloadCsv } from '../../csv.js';

const BAND_TONE = { EE: 'green', ME: 'blue', BME: 'red' };
const num = (v) => (v == null ? '—' : `${v}%`);

// Consolidates a teacher's rows by subject (e.g. Maths across 1A, 2A and 3A).
function bySubject(rows, settings) {
  const m = new Map();
  for (const r of rows) { if (r.combined == null) continue; const k = r.subject; if (!m.has(k)) m.set(k, { subject: k, classes: [], vals: [] }); const e = m.get(k); e.classes.push(`${r.grade} ${r.section}`); e.vals.push(r.combined); }
  return [...m.values()].map((e) => {
    const avg = Math.round((e.vals.reduce((a, b) => a + b, 0) / e.vals.length) * 10) / 10;
    return { subject: e.subject, classes: e.classes, avg, band: avg >= settings.exceeding ? 'EE' : avg >= settings.meeting ? 'ME' : 'BME' };
  });
}

function Band({ band, labels }) {
  if (!band) return <span className="sec-sub">—</span>;
  return <Badge tone={BAND_TONE[band]}>{labels?.[band] || band}</Badge>;
}

// ── Overview + one teacher's sheet ──────────────────────────────────────────
function TeacherSheet({ id, onBack }) {
  const { data: d, loading, error } = useFetch(`/appraisal/teacher/${id}`);
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const L = d.labels;
  const subjects = bySubject(d.rows, d.settings);
  const download = () => downloadCsv(`appraisal-${d.teacher.name.replace(/\s+/g, '-')}.csv`, [
    ['Teacher', 'Grade', 'Section', 'Subject', 'Role', 'Students', 'SA %', 'DT %', 'IBT %', 'Student Achievement %', 'Teacher Performance Descriptor', 'Missing'],
    ...d.rows.map((r) => [d.teacher.name, r.grade, r.section, r.subject, r.homeRoom ? 'Home room' : 'Subject teacher', r.students, r.by?.SA?.avg ?? '', r.by?.DT?.avg ?? '', r.by?.IBT?.avg ?? '', r.combined ?? '', r.band ? L[r.band] : '', (r.missing || []).join(' ')]),
    [], ['Overall', '', '', '', '', '', '', '', '', d.overall ?? '', d.band ? L[d.band] : '', ''],
  ]);
  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">{d.teacher.name}</div><div className="sec-sub">{d.teacher.email} · {d.academicYear}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onBack}>← All teachers</button>
          <button className="btn btn-secondary" onClick={download} disabled={!d.rows.length}>Download CSV</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      {d.rows.length === 0 ? <Empty>No classes assigned yet. Add them in the “Teaching assignments” tab.</Empty> : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Overall</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div><div className="sec-sub">Student Achievement</div><span style={{ fontSize: '2rem', fontWeight: 700 }}>{num(d.overall)}</span></div>
              <div><div className="sec-sub">Teacher Performance Descriptor</div><Band band={d.band} labels={L} /></div>
            </div>
            <div className="sec-sub">Student Achievement is the average of every class and subject this teacher teaches, counted equally ({d.counted} with results). The descriptor is derived from it. It is one input to the appraisal, not a full measure of professional effectiveness.</div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Each subject, across all their classes</div>
            <div className="table-wrap"><table>
              <thead><tr><th>Subject</th><th>Classes</th><th>Student Achievement</th><th>Teacher Performance Descriptor</th></tr></thead>
              <tbody>{subjects.map((x) => <tr key={x.subject}><td>{x.subject}</td><td>{x.classes.join(', ')}</td><td><strong>{num(x.avg)}</strong></td><td><Band band={x.band} labels={L} /></td></tr>)}</tbody>
            </table></div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Each section</div>
            <div className="table-wrap"><table>
              <thead><tr><th>Class</th><th>Student Achievement</th><th>Teacher Performance Descriptor</th></tr></thead>
              <tbody>{d.sections.map((s) => <tr key={`${s.grade}${s.section}`}><td>{s.grade} {s.section}</td><td>{num(s.average ?? s.avg)}</td><td><Band band={s.band} labels={L} /></td></tr>)}</tbody>
            </table></div>
          </div>
          <div className="card">
            <div className="card-title">Subject by subject</div>
            <div className="table-wrap"><table>
              <thead><tr><th>Class</th><th>Subject</th><th>Role</th><th>Students</th><th>SA</th><th>DT</th><th>IBT</th><th>Student Achievement</th><th>Teacher Performance Descriptor</th></tr></thead>
              <tbody>{d.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.grade} {r.section}</td><td>{r.subject}</td><td>{r.homeRoom ? 'Home room' : 'Subject'}</td><td>{r.students}</td>
                  <td>{num(r.by?.SA?.avg)}</td><td>{num(r.by?.DT?.avg)}</td><td>{num(r.by?.IBT?.avg)}</td>
                  <td><strong>{num(r.combined)}</strong>{r.missing?.length ? <div className="sec-sub">no {r.missing.join(', ')} yet</div> : null}</td>
                  <td><Band band={r.band} labels={L} /></td>
                </tr>))}</tbody>
            </table></div>
          </div>
        </>)}
    </>
  );
}

function Reports() {
  const { data: d, loading, error } = useFetch('/appraisal/reports');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const L = d.labels;
  const table = (title, head, body) => (
    <div className="card" style={{ marginBottom: 16 }}><div className="card-title">{title}</div>
      <div className="table-wrap"><table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{body}</tbody></table></div></div>);
  return (
    <>
      {table('By grade', ['Grade', 'Class-subjects', 'Student Achievement', 'Descriptor'], d.grades.map((g) => <tr key={g.grade}><td>{g.grade}</td><td>{g.count}</td><td><strong>{num(g.avg)}</strong></td><td><Band band={g.band} labels={L} /></td></tr>))}
      {table('By subject', ['Subject', 'Class-subjects', 'Student Achievement', 'Descriptor'], d.subjects.map((g) => <tr key={g.subject}><td>{g.subject}</td><td>{g.count}</td><td><strong>{num(g.avg)}</strong></td><td><Band band={g.band} labels={L} /></td></tr>))}
      {table('By section and subject', ['Class', 'Subject', 'Teacher', 'Role', 'SA', 'DT', 'IBT', 'Student Achievement', 'Descriptor'], d.classes.map((r, i) => <tr key={i}><td>{r.grade} {r.section}</td><td>{r.subject}</td><td>{r.teacher}</td><td>{r.role}</td><td>{num(r.by?.SA?.avg)}</td><td>{num(r.by?.DT?.avg)}</td><td>{num(r.by?.IBT?.avg)}</td><td><strong>{num(r.combined)}</strong></td><td><Band band={r.band} labels={L} /></td></tr>))}
    </>
  );
}

function Overview() {
  const { data: d, loading, error } = useFetch('/appraisal/overview');
  const [open, setOpen] = useState(null);
  if (open) return <TeacherSheet id={open} onBack={() => setOpen(null)} />;
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const L = d.labels;
  const rated = d.teachers.filter((t) => t.overall != null);
  const school = rated.length ? Math.round((rated.reduce((a, t) => a + t.overall, 0) / rated.length) * 10) / 10 : null;
  return (
    <>
      <p className="sec-sub" style={{ marginBottom: 12 }}>
        {d.academicYear}. Early Years uses SA; Grades 1–2 use SA + DT; Grades 3–5 use SA + DT + IBT. {L.EE}: {d.settings.exceeding}% and above · {L.ME}: {d.settings.meeting}% and above · {L.BME}: below {d.settings.meeting}%.
        {school != null && <> Average across rated teachers: <strong>{school}%</strong>.</>}
      </p>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Teacher</th><th>Classes</th><th>Student Achievement</th><th>Teacher Performance Descriptor</th><th /></tr></thead>
        <tbody>
          {d.teachers.map((t) => (
            <tr key={t.id}>
              <td>{t.name}<div className="sec-sub">{t.email}</div></td>
              <td>{t.assigned ? t.sections.map((s) => `${s.grade} ${s.section}`).join(', ') : <span className="sec-sub">Not assigned</span>}</td>
              <td><strong>{num(t.overall)}</strong></td>
              <td><Band band={t.band} labels={L} /></td>
              <td><button className="btn btn-secondary" onClick={() => setOpen(t.id)}>View sheet</button></td>
            </tr>))}
          {!d.teachers.length && <tr><td colSpan={5}><Empty>No teachers yet.</Empty></td></tr>}
        </tbody>
      </table></div></div>
    </>
  );
}

// ── Teaching assignments ────────────────────────────────────────────────────
function Assignments() {
  const flash = useFlash();
  const { data: d, loading, error, reload } = useFetch('/appraisal/assignments');
  const [tid, setTid] = useState('');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const teacher = d?.teachers.find((t) => t.id === tid);
  useEffect(() => { setRows(teacher ? teacher.assignments.map((a) => ({ ...a })) : []); }, [tid, d]); // eslint-disable-line
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;

  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    if (rows.some((r) => !r.grade || !r.section || !r.subject)) return flash('Choose a grade, section and subject for every row.', 'error');
    setSaving(true);
    try { const r = await api.put(`/appraisal/assignments/${tid}`, { assignments: rows }); flash(`Saved ${r.saved} class${r.saved === 1 ? '' : 'es'} for ${teacher.name}.`); reload(); }
    catch (e) { flash(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <>
      <p className="sec-sub" style={{ marginBottom: 12 }}>
        Subject teachers: add one row per grade, section and subject. Home room teachers: choose “All subjects (Home room teacher)” — they are counted for every subject in that class that no other teacher has been given.
      </p>
      <div className="card" style={{ marginBottom: 16 }}>
        <select className="form-input" style={{ maxWidth: 360 }} value={tid} onChange={(e) => setTid(e.target.value)} aria-label="Teacher">
          <option value="">Choose a teacher…</option>
          {d.teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.assignments.length})</option>)}
        </select>
      </div>
      {teacher && (
        <div className="card">
          <div className="card-title">{teacher.name} teaches</div>
          {rows.length === 0 && <Empty>Nothing assigned yet.</Empty>}
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select className="form-input" style={{ width: 130 }} value={r.grade} onChange={(e) => set(i, 'grade', e.target.value)} aria-label="Grade">
                <option value="">Grade</option>{d.grades.map((g) => <option key={g}>{g}</option>)}
              </select>
              <select className="form-input" style={{ width: 100 }} value={r.section} onChange={(e) => set(i, 'section', e.target.value)} aria-label="Section">
                <option value="">Section</option>{d.sections.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="form-input" style={{ width: 220 }} value={r.subject} onChange={(e) => set(i, 'subject', e.target.value)} aria-label="Subject">
                <option value="">Subject</option>
                <option value={d.homeRoom}>All subjects (Home room teacher)</option>
                {d.subjects.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
            </div>))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setRows((rs) => [...rs, { grade: rs.at(-1)?.grade || '', section: rs.at(-1)?.section || '', subject: '' }])}>+ Add row</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>)}
    </>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
function Settings() {
  const flash = useFlash();
  const { data: d, loading, error, reload } = useFetch('/appraisal/settings');
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (d) setF({ SA: d.weights.SA, DT: d.weights.DT, IBT: d.weights.IBT, meeting: d.meeting, exceeding: d.exceeding }); }, [d]);
  if (loading || !f) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const save = async () => {
    setSaving(true);
    try { await api.put('/appraisal/settings', { weights: { SA: f.SA, DT: f.DT, IBT: f.IBT }, meeting: f.meeting, exceeding: f.exceeding }); flash('Settings saved.'); reload(); }
    catch (e) { flash(e.message, 'error'); } finally { setSaving(false); }
  };
  const input = (k, label) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div className="sec-sub">{label}</div>
      <input className="form-input" type="number" min="0" max="100" style={{ width: 120 }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="card-title">How the score is built</div>
      <p className="sec-sub" style={{ marginBottom: 12 }}>Weights apply to Grades 3–5. Where a grade does not use an assessment, or its results are not in yet, the remaining weights are rescaled so they still add up.</p>
      {input('SA', 'SA weight')}{input('DT', 'DT weight')}{input('IBT', 'IBT weight')}
      <div className="card-title" style={{ marginTop: 14 }}>Descriptors</div>
      {input('meeting', 'Meeting Expectations from (%)')}{input('exceeding', 'Exceeding Expectation from (%)')}
      <p className="sec-sub" style={{ marginBottom: 10 }}>Below the Meeting figure is Below Meeting Expectations (BME).</p>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
    </div>
  );
}

export default function Appraisal() {
  const [tab, setTab] = useState('overview');
  const tabs = [['overview', 'Appraisal'], ['reports', 'Reports'], ['assign', 'Teaching assignments'], ['settings', 'Settings']];
  return (
    <>
      <div className="sec-header"><div><div className="sec-title">Teacher appraisal</div><div className="sec-sub">Based on student results. Visible to administrators only.</div></div></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map(([k, n]) => <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'reports' && <Reports />}
      {tab === 'assign' && <Assignments />}
      {tab === 'settings' && <Settings />}
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent } from '../../components/ui.jsx';

const CHOICES = [[0, 'Present'], [0.5, 'Half day'], [1, 'Absent']];

// Staff page: mark a class's attendance for a day, and see the monthly report.
export default function Attendance() {
  const { data: cfg, error } = useFetch('/attendance/config');
  const [tab, setTab] = useState('mark');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  if (error) return <div className="alert alert-error">{error.message}</div>;
  if (!cfg) return <Loading />;
  if (cfg.grades.length === 0) return <div className="card"><Empty>You have no classes assigned yet. Ask an administrator to give you access.</Empty></div>;
  const g = cfg.gradeLocked ? cfg.grades[0] : grade || cfg.grades[0];
  const sec = cfg.sectionLocked ? cfg.sections[0] : section;

  return (
    <>
      <div className="tab-bar">
        <button type="button" className={`tab-btn ${tab === 'mark' ? 'active' : ''}`} onClick={() => setTab('mark')}>Mark attendance</button>
        <button type="button" className={`tab-btn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>Monthly report</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-input" value={g} disabled={cfg.gradeLocked} onChange={(e) => setGrade(e.target.value)}>
              {cfg.grades.map((x) => <option key={x}>{x}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Section</label>
            <select className="form-input" value={sec} disabled={cfg.sectionLocked} onChange={(e) => setSection(e.target.value)}>
              {tab === 'report' && !cfg.sectionLocked ? <option value="">All sections</option> : !sec && <option value="">Choose…</option>}
              {cfg.sections.map((x) => <option key={x}>{x}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Minimum attendance</label>
            <div style={{ paddingTop: 8, fontWeight: 600 }}>{cfg.minPercent}% each month</div></div>
        </div>
      </div>
      {tab === 'mark' ? <MarkDay cfg={cfg} grade={g} section={sec} /> : <Report cfg={cfg} grade={g} section={sec} />}
    </>
  );
}

function MarkDay({ cfg, grade, section }) {
  const flash = useFlash();
  const [date, setDate] = useState(cfg.today);
  const [sheet, setSheet] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!section || !date) { setSheet(null); return undefined; }
    let live = true; setSheet(null);
    api.get(`/attendance/sheet?${new URLSearchParams({ grade, section, date })}`)
      .then((d) => { if (live) { setSheet(d); setValues(Object.fromEntries(d.students.map((s) => [s.id, s.value]))); } })
      .catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [grade, section, date, flash]);
  useEffect(() => load(), [load]);

  if (!section) return <div className="card"><Empty>Choose a section to mark attendance.</Empty></div>;
  if (!sheet) return <Loading />;
  const count = (v) => Object.values(values).filter((x) => x === v).length;

  const save = async () => {
    setSaving(true);
    try {
      const absences = Object.fromEntries(Object.entries(values).filter(([, v]) => v > 0));
      const r = await api.put('/attendance/sheet', { date, grade, section, absences });
      flash(`Attendance saved for ${grade} ${section}: ${r.absent} absent or half day out of ${r.students}.`);
      load();
    } catch (e) { flash(e.message, 'error'); } finally { setSaving(false); }
  };
  const noSchool = async () => {
    if (!window.confirm(`Remove ${date} for ${grade} ${section}? It will not count as a school day.`)) return;
    try { await api.del(`/attendance/sheet?${new URLSearchParams({ grade, section, date })}`); flash('That day was removed.'); load(); }
    catch (e) { flash(e.message, 'error'); }
  };

  return (
    <div className="card">
      <div className="sec-header">
        <div>
          <div className="sec-title">{grade} · Section {section}</div>
          <div className="sec-sub">{sheet.taken ? 'Attendance saved for this day. You can change it.' : 'Not marked yet. Everyone starts as present.'}</div>
        </div>
        <input type="date" className="form-input" style={{ width: 170 }} value={date} max={cfg.today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
      </div>
      {!sheet.canEdit && <div className="alert alert-error" style={{ marginBottom: 12 }}>You can view this class but not change its attendance.</div>}
      {sheet.students.length === 0 ? <Empty>No students in this class.</Empty> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Badge tone="green">Present {count(0)}</Badge><Badge tone="amber">Half day {count(0.5)}</Badge><Badge tone="red">Absent {count(1)}</Badge>
            {sheet.canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setValues(Object.fromEntries(sheet.students.map((s) => [s.id, 0])))}>Mark all present</button>}
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th style={{ width: 50 }}>#</th><th>Student</th><th>Attendance</th></tr></thead>
            <tbody>{sheet.students.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td><td style={{ fontWeight: 500 }}>{s.name}</td>
                <td>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {CHOICES.map(([v, label]) => (
                      <label key={v} style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: sheet.canEdit ? 'pointer' : 'default' }}>
                        <input type="radio" name={`att-${s.id}`} disabled={!sheet.canEdit} checked={values[s.id] === v} onChange={() => setValues((x) => ({ ...x, [s.id]: v }))} />{label}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>))}
            </tbody>
          </table></div>
          {sheet.canEdit && (
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save attendance'}</button>
              {sheet.taken && <button type="button" className="btn btn-secondary" onClick={noSchool}>No school this day</button>}
            </div>)}
        </>
      )}
    </div>
  );
}

function Report({ cfg, grade, section }) {
  const [month, setMonth] = useState(cfg.today.slice(0, 7));
  const { data: d, loading, error } = useFetch(`/attendance/report?${new URLSearchParams({ grade, section, month })}`);
  return (
    <div className="card">
      <div className="sec-header">
        <div><div className="sec-title">{grade}{section ? ` · Section ${section}` : ''}</div>
          <div className="sec-sub">Attendance % = (school days − absences) ÷ school days. A half day counts as 0.5.</div></div>
        <input type="month" className="form-input" style={{ width: 170 }} value={month} max={cfg.today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
      </div>
      {error ? <div className="alert alert-error">{error.message}</div> : loading || !d ? <Loading /> : d.students.length === 0 ? <Empty>No students found.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Section</th><th>School days</th><th>Absent days</th><th>Attendance</th><th /></tr></thead>
          <tbody>{d.students.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.section}</td><td>{s.workingDays}</td><td>{s.absentDays}</td>
              <td>{s.percent === null ? '—' : <Percent value={s.percent} />}</td>
              <td>{s.belowMinimum && <Badge tone="red">Below {d.minPercent}%</Badge>}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

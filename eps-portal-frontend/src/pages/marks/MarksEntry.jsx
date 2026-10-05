import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Field, Loading } from '../../components/ui.jsx';
import { KindTabs, Pct, useKind } from './shared.jsx';

const DEFAULT_STRAND_MAX = 10;

// Enter marks for one subject + assessment number + grade/section.
// Strand subjects (FA/SA English, Hindi, Urdu, Maths) have one column per strand, each with its own maximum.
// Other subjects (Science, all of DT) have a single marks column.
export default function MarksEntry() {
  const flash = useFlash();
  const { data: cfg } = useFetch('/marks/config');
  const { kind, kc } = useKind(cfg);
  const [sp, setSp] = useSearchParams();
  const [entry, setEntry] = useState(null);
  const [rows, setRows] = useState({});          // { studentId: { marks, remarks, strands: { strand: value } } }
  const [maxMarks, setMax] = useState(25);       // single-mark subjects
  const [maxBy, setMaxBy] = useState({});        // strand subjects: { strand: max }
  const [testDate, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const grade = cfg ? (cfg.gradeLocked ? cfg.grades[0] : sp.get('grade') || cfg.grades[0]) : '';
  const section = sp.get('section') || '';
  const subject = sp.get('subject') || kc?.subjects[0] || '';
  const number = Number(sp.get('number') || kc?.numbers[0] || 1);
  const setFilter = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };

  useEffect(() => {
    if (!cfg || !kc) return undefined;
    let live = true;
    setEntry(null);
    api.get(`/marks/${kind}/entry?${new URLSearchParams({ grade, section, subject, number })}`).then((d) => {
      if (!live) return;
      setEntry(d);
      if (d.strands) {
        setMaxBy(Object.fromEntries(d.strands.map((st) => [st, d.strandSheets[st]?.maxMarks ?? DEFAULT_STRAND_MAX])));
        setRows(Object.fromEntries(d.students.map((s) => [s.id, {
          remarks: d.marks[s.id]?.remarks ?? '',
          strands: Object.fromEntries(d.strands.map((st) => [st, d.marks[s.id]?.strands?.[st] ?? ''])),
        }])));
        setDate(d.testDate ? d.testDate.slice(0, 10) : '');
      } else {
        setRows(Object.fromEntries(d.students.map((s) => [s.id, { marks: d.marks[s.id]?.marks ?? '', remarks: d.marks[s.id]?.remarks ?? '' }])));
        setMax(d.sheet?.maxMarks ?? 25);
        setDate(d.sheet?.testDate ? d.sheet.testDate.slice(0, 10) : '');
      }
    }).catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [cfg, kc, kind, grade, section, subject, number, flash]);

  if (!cfg) return <Loading />;
  if (!kc) return <div className="alert alert-error">Unknown assessment type.</div>;

  const strands = entry?.strands || null;
  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const setStrand = (id, strand, v) => setRows((r) => ({ ...r, [id]: { ...r[id], strands: { ...r[id].strands, [strand]: v } } }));
  const over = (v, max) => v !== '' && Number(v) > Number(max);
  const filled = Object.values(rows).filter((r) => (strands ? Object.values(r.strands || {}).some((v) => v !== '') : r.marks !== '')).length;

  // total across the strands that have a mark: "27 / 40 · 67.5%"
  const total = (r) => {
    const got = strands.filter((st) => r.strands[st] !== '');
    if (!got.length) return null;
    const m = got.reduce((t, st) => t + Number(r.strands[st]), 0);
    const mx = got.reduce((t, st) => t + Number(maxBy[st] || 0), 0);
    return { m, mx, pct: mx > 0 ? Math.round((m / mx) * 1000) / 10 : null };
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = strands
        ? { grade, section, subject, number, testDate: testDate || null, maxMarks: Object.fromEntries(strands.map((st) => [st, Number(maxBy[st])])),
            rows: Object.entries(rows).map(([studentId, v]) => ({ studentId, remarks: v.remarks, strands: v.strands })) }
        : { grade, section, subject, number, maxMarks: Number(maxMarks), testDate: testDate || null,
            rows: Object.entries(rows).map(([studentId, v]) => ({ studentId, marks: v.marks, remarks: v.remarks })) };
      const r = await api.put(`/marks/${kind}/entry`, body);
      flash(`Marks saved for ${r.saved} student(s) — ${subject} ${kind}${number}, ${grade}${section ? ` ${section}` : ''}`);
      if (r.invalid.length) flash(`Not saved (outside 0 to the maximum): ${r.invalid.join(', ')}`, 'error');
    } catch (err) { flash(err.message, 'error'); } finally { setSaving(false); }
  };

  const select = (label, value, onChange, options, disabled) => (
    <Field label={label}>
      <select className="form-input" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </Field>
  );

  return (
    <>
      <KindTabs kind={kind} isAdmin={cfg.isAdmin} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {select('Grade', grade, (v) => setFilter('grade', v), cfg.grades.map((g) => [g, g]), cfg.gradeLocked)}
          {select('Section', section, (v) => setFilter('section', v), [['', 'All sections'], ...cfg.sections.map((s) => [s, s])])}
          {select('Subject', subject, (v) => setFilter('subject', v), kc.subjects.map((s) => [s, s]))}
          {select(`${kind} number`, number, (v) => setFilter('number', v), kc.numbers.map((n) => [n, `${kind}${n}`]))}
        </div>
      </div>

      {!entry ? <Loading /> : (
        <form className="card" onSubmit={save}>
          <div className="sec-header">
            <div>
              <div className="sec-title">{subject} · {kind}{number}{strands ? ' · by strand' : ''}</div>
              <div className="sec-sub">{filled} of {entry.students.length} students have marks · leave a cell blank for absent</div>
            </div>
            <Link className="btn btn-secondary btn-sm" to={`/marks/${kind}/upload?grade=${encodeURIComponent(grade)}&section=${section}&number=${number}`}>Upload CSV instead</Link>
          </div>

          <div className="form-row" style={{ maxWidth: 420, marginBottom: 14 }}>
            {!strands && <Field label="Maximum marks"><input className="form-input" type="number" min="1" step="any" required value={maxMarks} onChange={(e) => setMax(e.target.value)} /></Field>}
            <Field label="Test date"><input className="form-input" type="date" value={testDate} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>

          {entry.students.length === 0 ? <Empty>No students in {grade}{section ? ` section ${section}` : ''}.</Empty> : strands ? (
            <div className="table-wrap"><table>
              <thead>
                <tr><th>#</th><th>Student</th><th>Sec</th>
                  {strands.map((st) => <th key={st} style={{ minWidth: 120 }}>{st}</th>)}
                  <th>Total</th><th>Remarks</th></tr>
                <tr style={{ background: 'var(--surface2)' }}>
                  <td colSpan={3} style={{ textAlign: 'right', fontSize: '.75rem', color: 'var(--ink3)' }}>Maximum marks →</td>
                  {strands.map((st) => (
                    <td key={st}><input className="form-input" type="number" min="1" step="any" required aria-label={`Maximum marks for ${st}`}
                      value={maxBy[st] ?? ''} onChange={(e) => setMaxBy({ ...maxBy, [st]: e.target.value })} /></td>))}
                  <td colSpan={2} />
                </tr>
              </thead>
              <tbody>{entry.students.map((s, i) => {
                const t = total(rows[s.id] || { strands: {} });
                return (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{s.name}<div style={{ color: 'var(--ink3)', fontSize: '.72rem' }}>{s.username}</div></td>
                    <td>{s.section || '—'}</td>
                    {strands.map((st) => (
                      <td key={st}><input className="form-input" type="number" min="0" max={maxBy[st]} step="any" aria-label={`${st} marks for ${s.name}`}
                        style={over(rows[s.id]?.strands?.[st], maxBy[st]) ? { borderColor: 'var(--red)' } : undefined}
                        value={rows[s.id]?.strands?.[st] ?? ''} onChange={(e) => setStrand(s.id, st, e.target.value)} /></td>))}
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>{t ? <>{t.m}/{t.mx} <Pct v={t.pct} /></> : '—'}</td>
                    <td><input className="form-input" aria-label={`Remarks for ${s.name}`} value={rows[s.id]?.remarks ?? ''} onChange={(e) => setRow(s.id, { remarks: e.target.value })} /></td>
                  </tr>);
              })}</tbody>
            </table></div>
          ) : (
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Student</th><th>Section</th><th style={{ width: 130 }}>Marks / {maxMarks}</th><th>Remarks</th></tr></thead>
              <tbody>{entry.students.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{s.name}<div style={{ color: 'var(--ink3)', fontSize: '.72rem' }}>{s.username}</div></td>
                  <td>{s.section || '—'}</td>
                  <td><input className="form-input" type="number" min="0" max={maxMarks} step="any" aria-label={`Marks for ${s.name}`}
                    style={over(rows[s.id]?.marks, maxMarks) ? { borderColor: 'var(--red)' } : undefined}
                    value={rows[s.id]?.marks ?? ''} onChange={(e) => setRow(s.id, { marks: e.target.value })} /></td>
                  <td><input className="form-input" aria-label={`Remarks for ${s.name}`} value={rows[s.id]?.remarks ?? ''} onChange={(e) => setRow(s.id, { remarks: e.target.value })} /></td>
                </tr>))}
              </tbody>
            </table></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-primary" disabled={saving || entry.students.length === 0}>{saving ? 'Saving…' : 'Save marks'}</button>
          </div>
        </form>
      )}
    </>
  );
}

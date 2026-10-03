import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Field, Loading } from '../../components/ui.jsx';
import { KindTabs, PALETTE, Pct, useKind } from './shared.jsx';

export default function MarksAnalytics() {
  const flash = useFlash();
  const { data: cfg } = useFetch('/marks/config');
  const { kind, kc } = useKind(cfg);
  const [sp, setSp] = useSearchParams();
  const [d, setD] = useState(null);
  const grade = cfg ? (cfg.gradeLocked ? cfg.grades[0] : sp.get('grade') || cfg.grades[0]) : '';
  const section = sp.get('section') || '';
  const setFilter = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };

  useEffect(() => {
    if (!cfg || !kc) return undefined;
    let live = true; setD(null);
    api.get(`/marks/${kind}/analytics?${new URLSearchParams({ grade, section })}`).then((x) => live && setD(x)).catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [cfg, kc, kind, grade, section, flash]);

  if (!cfg) return <Loading />;
  if (!kc) return <div className="alert alert-error">Unknown assessment type.</div>;

  const ranked = d ? [...d.students].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1)) : [];
  const trend = d ? d.numbers.map((n, i) => ({ name: `${kind}${n}`, ...Object.fromEntries(d.subjects.map((s) => [s, d.classAvg[s][i]])) })) : [];

  return (
    <>
      <KindTabs kind={kind} isAdmin={cfg.isAdmin} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ maxWidth: 520 }}>
          <Field label="Grade"><select className="form-input" value={grade} disabled={cfg.gradeLocked} onChange={(e) => setFilter('grade', e.target.value)}>{cfg.grades.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Section"><select className="form-input" value={section} onChange={(e) => setFilter('section', e.target.value)}><option value="">All sections</option>{cfg.sections.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
      </div>
      {!d ? <Loading /> : d.classOverall === null ? <div className="card"><Empty>No {kind} marks entered yet for {grade}{section ? ` ${section}` : ''}.</Empty></div> : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-value"><Pct v={d.classOverall} /></div><div className="stat-label">Class overall</div></div>
            {d.subjects.map((s) => <div className="stat-card" key={s}><div className="stat-value"><Pct v={d.subjectOverall[s]} /></div><div className="stat-label">{s}</div></div>)}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Class average by {kind}</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => (v === null ? '—' : `${v}%`)} /><Legend />
                {d.subjects.map((s, i) => <Line key={s} type="monotone" dataKey={s} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} connectNulls dot />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title">Student ranking · {d.students.length} students</div>
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Student</th><th>Sec</th>{d.subjects.map((s) => <th key={s}>{s}</th>)}<th>Overall</th></tr></thead>
              <tbody>{ranked.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td><td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.section || '—'}</td>
                  {d.subjects.map((sub) => <td key={sub}><Pct v={s.subjects[sub].avg} /></td>)}
                  <td><Pct v={s.overall} /></td>
                </tr>))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}

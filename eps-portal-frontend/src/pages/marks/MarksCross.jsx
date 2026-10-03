import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Loading } from '../../components/ui.jsx';
import { KindTabs, PALETTE, Pct, useKind } from './shared.jsx';

export default function MarksCross() {
  const { data: cfg } = useFetch('/marks/config');
  const { kind } = useKind(cfg);
  const { data: d, loading, error } = useFetch(`/marks/${kind.toLowerCase()}/cross-grade`);
  if (loading || !cfg) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const chart = d.subjects.map((s) => ({ subject: s, ...Object.fromEntries(d.grades.map((g) => [g.grade, g.subjectAvgs[s]])) }));
  const any = d.grades.some((g) => g.overallAvg !== null);
  return (
    <>
      <KindTabs kind={kind} isAdmin={cfg.isAdmin} />
      {!any ? <div className="card"><Empty>No {kind} marks entered yet.</Empty></div> : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Subject average by grade</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => (v === null ? '—' : `${v}%`)} /><Legend />
                {d.grades.map((g, i) => <Bar key={g.grade} dataKey={g.grade} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="table-wrap"><table>
              <thead><tr><th>Grade</th><th>Students</th>{d.subjects.map((s) => <th key={s}>{s}</th>)}<th>Overall</th></tr></thead>
              <tbody>{d.grades.map((g) => (
                <tr key={g.grade}><td style={{ fontWeight: 500 }}>{g.grade}</td><td>{g.studentCount}</td>
                  {d.subjects.map((s) => <td key={s}><Pct v={g.subjectAvgs[s]} /></td>)}<td><Pct v={g.overallAvg} /></td></tr>))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}

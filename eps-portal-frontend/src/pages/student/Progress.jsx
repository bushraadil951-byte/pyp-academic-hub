import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading } from '../../components/ui.jsx';
import { Pct } from '../marks/shared.jsx';

const TONE = { Strong: 'green', Developing: 'amber', 'Needs focus': 'red', 'Not started': 'gray' };

export default function StudentProgress() {
  const kind = (useParams().kind || 'DT').toUpperCase();
  const { data: d, loading, error } = useFetch(`/marks/student-progress/${kind.toLowerCase()}`);
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const started = d.insights.some((i) => i.completed > 0);
  const weak = d.insights.filter((i) => i.average !== null && i.average < 80).map((i) => i.subject);
  const weakStrands = Object.entries(d.strands || {}).flatMap(([sub, list]) => list.filter((x) => x.average !== null && x.average < 60).map((x) => `${sub}: ${x.strand}`));
  return (
    <>
      <div className="sec-header"><div><div className="sec-title">My {d.label}</div><div className="sec-sub">{d.student.grade}{d.student.section ? ` · ${d.student.section}` : ''} · {d.academicYear}</div></div></div>
      {!started ? <div className="card"><Empty>No marks have been entered for you yet. They will appear here once your teacher records them.</Empty></div> : (
        <>
          {weak.length > 0 && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              Focus areas: <strong>{weak.join(', ')}</strong>. <Link to="/student">Practise with a mock test →</Link>
            </div>
          )}
          {weakStrands.length > 0 && <div className="alert alert-error" style={{ marginBottom: 16 }}>Strands to work on (below 60%): <strong>{weakStrands.join(' · ')}</strong></div>}
          <div className="grid-2">
            {d.insights.map((ins) => {
              const points = d.series[ins.subject].map((p) => ({ name: `${kind}${p.number}`, me: p.pct, cls: p.classAvgPct }));
              return (
                <div className="card" key={ins.subject}>
                  <div className="sec-header">
                    <div><div className="sec-title">{ins.subject}</div>
                      <div className="sec-sub">{ins.completed} done · latest <Pct v={ins.latest} />{ins.trend !== null && <> · trend {ins.trend > 0 ? '+' : ''}{ins.trend}</>}</div></div>
                    <Badge tone={TONE[ins.status]}>{ins.status}</Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={points}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} width={42} /><Tooltip formatter={(v) => (v === null ? '—' : `${v}%`)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="me" name="Me" stroke="#6366f1" strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="cls" name="Class avg" stroke="#94a3b8" strokeDasharray="4 3" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                  {d.strands?.[ins.subject]?.some((x) => x.completed > 0) && (
                    <div style={{ marginTop: 12 }}>
                      <div className="sec-sub" style={{ fontWeight: 600, marginBottom: 6 }}>By strand</div>
                      {d.strands[ins.subject].map((x) => (
                        <div key={x.strand} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8rem' }}>
                            <span>{x.strand}</span><span><Pct v={x.average} /> <Badge tone={TONE[x.status]}>{x.status}</Badge></span>
                          </div>
                          <div className="progress" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${x.average || 0}%`, background: x.average === null ? 'transparent' : x.average >= 80 ? 'var(--green)' : x.average >= 60 ? 'var(--amber)' : 'var(--red)' }} /></div>
                        </div>))}
                    </div>)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

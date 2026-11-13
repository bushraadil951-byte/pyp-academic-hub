import { Fragment, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Stat } from '../../components/ui.jsx';
import { PALETTE, Pct } from '../marks/shared.jsx';

const tip = (v) => (v === null || v === undefined ? '—' : `${v}%`);

const Chart = ({ data, xKey, bars }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
      <Tooltip formatter={tip} />{bars.length > 1 && <Legend />}
      {bars.map((b, i) => <Bar key={b} dataKey={b} name={b === 'avg' ? 'Average' : b} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />)}
    </BarChart>
  </ResponsiveContainer>
);

const Strands = ({ list }) => (list.length === 0 ? <div className="sec-sub">No data yet.</div> : list.map((x) => (
  <div key={x.section} style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}><span>{x.section}</span><Pct v={x.avg} /></div>
    <div className="progress" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${x.avg}%`, background: x.avg >= 80 ? 'var(--green)' : x.avg >= 60 ? 'var(--amber)' : 'var(--red)' }} /></div>
  </div>)));

// A percentage cell with a soft red background when the score is below 60%, so weak mocks stand out in the tables.
const Cell = ({ v }) => (
  <td style={v !== null && v !== undefined && v < 60 ? { background: '#fef2f2' } : undefined}>{v === null || v === undefined ? <span style={{ color: 'var(--ink3)' }}>—</span> : <Pct v={v} />}</td>
);

// IBT (mock test) analytics. Admins pick any grade; teachers are locked to their own by the server.
export default function IbtAnalytics() {
  const [f, setF] = useState({ grade: '', section: '', subject: '', mock: '' });
  const [view, setView] = useState('mock');        // student table: 'mock' | 'subject'
  const [open, setOpen] = useState(null);          // expanded student id
  const { data: d, loading, error } = useFetch(`/analytics?${new URLSearchParams(f)}`);
  if (loading && !d) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const t = d.totals;
  const mocks = d.options.mocks;
  const numbered = d.byMock.filter((m) => m.mock !== null);
  const lowest = d.byMock.find((m) => m.mock === d.lowestMock);
  const mockName = (n) => (n === null ? 'Not numbered' : `IBT Mock ${n}`);
  const cols = view === 'mock' ? mocks.length + 2 : d.options.subjects.length + 1;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-input" value={d.options.gradeLocked ? d.options.grades[0] : f.grade} disabled={d.options.gradeLocked} onChange={set('grade')}>
              {!d.options.gradeLocked && <option value="">All grades</option>}{d.options.grades.map((g) => <option key={g}>{g}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Section</label>
            <select className="form-input" value={f.section} onChange={set('section')}><option value="">All sections</option>{d.options.sections.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Subject</label>
            <select className="form-input" value={f.subject} onChange={set('subject')}><option value="">All subjects</option>{d.options.subjects.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="form-label">IBT Mock</label>
            <select className="form-input" value={f.mock} onChange={set('mock')}><option value="">All mocks</option>{mocks.map((n) => <option key={n} value={n}>IBT Mock {n}</option>)}<option value="none">Not numbered</option></select></div>
        </div>
      </div>

      {t.results === 0 ? <div className="card"><Empty>No mock test results match these filters yet.</Empty></div> : (
        <>
          <div className="stat-grid">
            <Stat icon="📊" bg="#eef2ff" value={`${t.overallAvg}%`} label="Overall average" />
            <Stat icon="🏆" bg="#ecfdf5" value={t.above80} label="Results at 80% or more" />
            <Stat icon="⚠️" bg="#fef2f2" value={t.below60} label="Results below 60%" />
            <Stat icon="✅" bg="#fffbeb" value={t.results} label={`Results · ${t.students} students`} />
          </div>

          {/* ── Mock-wise ── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="sec-header">
              <div><div className="sec-title">Mock-wise performance</div>
                <div className="sec-sub">{lowest ? <>Lowest-scoring mock: <strong>{lowest.label}</strong> ({lowest.avg}%). Red cells are below 60%.</> : 'Average score in each IBT Mock. Red cells are below 60%.'}</div></div>
            </div>
            <div className="grid-2" style={{ gridTemplateColumns: 'minmax(260px,1fr) 2fr', alignItems: 'start' }}>
              <Chart data={d.byMock.map((m) => ({ mock: m.mock === null ? 'No no.' : `Mock ${m.mock}`, avg: m.avg }))} xKey="mock" bars={['avg']} />
              <div className="table-wrap"><table>
                <thead><tr><th>Mock</th><th>Students</th><th>Results</th><th>Below 60%</th>{d.options.subjects.map((s) => <th key={s}>{s}</th>)}<th>Average</th></tr></thead>
                <tbody>{d.byMock.filter((m) => m.count > 0 || m.mock !== null).map((m) => (
                  <tr key={m.label}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{m.label} {m.mock !== null && m.mock === d.lowestMock && <Badge tone="red">Lowest</Badge>}</td>
                    <td>{m.count ? m.students : '—'}</td><td>{m.count || '—'}</td><td>{m.count ? m.below60 : '—'}</td>
                    {d.options.subjects.map((s) => <Cell key={s} v={m.subjectAvgs[s]} />)}
                    <Cell v={m.avg} />
                  </tr>))}
                </tbody>
              </table></div>
            </div>
            {numbered.every((m) => m.count === 0) && <div className="alert alert-error" style={{ marginTop: 12 }}>None of these tests has an IBT Mock number yet. Open Mock Tests → Edit Settings and choose IBT Mock 1–5 for each test.</div>}
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card"><div className="card-title">Average by grade</div><Chart data={d.byGrade} xKey="grade" bars={['avg']} /></div>
            <div className="card"><div className="card-title">Average by subject</div><Chart data={d.bySubject} xKey="subject" bars={['avg']} /></div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Grade × subject</div>
            <Chart data={d.gradeSubject} xKey="grade" bars={d.options.subjects} />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card"><div className="card-title">Strongest and weakest sections</div><Strands list={d.sectionAvgs} /></div>
            <div className="card">
              <div className="card-title">Sections by subject</div>
              {d.options.subjects.filter((s) => d.subjectStrands[s].length).map((s) => (
                <div key={s} style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: 4 }}>{s}</div><Strands list={d.subjectStrands[s]} /></div>))}
            </div>
          </div>

          {/* ── Student table ── */}
          <div className="card">
            <div className="sec-header">
              <div><div className="sec-title">Students · {d.studentRows.length}</div><div className="sec-sub">Click a student to see every test they took.</div></div>
              <div className="tab-bar" style={{ margin: 0 }}>
                <button className={`tab-btn ${view === 'mock' ? 'active' : ''}`} onClick={() => setView('mock')}>By mock</button>
                <button className={`tab-btn ${view === 'subject' ? 'active' : ''}`} onClick={() => setView('subject')}>By subject</button>
              </div>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Student</th><th>Grade</th><th>Sec</th><th>Tests</th>
                {view === 'mock' ? (<>{mocks.map((n) => <th key={n}>Mock {n}</th>)}<th>Weakest mock</th></>) : d.options.subjects.map((s) => <th key={s}>{s}</th>)}
                <th>Overall</th></tr></thead>
              <tbody>{d.studentRows.map((s, i) => (
                <Fragment key={s.id}>
                  <tr onClick={() => setOpen(open === s.id ? null : s.id)} style={{ cursor: 'pointer' }}>
                    <td>{i + 1}</td><td style={{ fontWeight: 500 }}>{open === s.id ? '▾' : '▸'} {s.name}</td><td>{s.grade}</td><td>{s.section || '—'}</td><td>{s.testsTaken}</td>
                    {view === 'mock' ? (<>
                      {mocks.map((n) => <Cell key={n} v={s.mockAvgs[n]} />)}
                      <td>{s.weakestMock ? <span style={{ fontWeight: 600 }}>Mock {s.weakestMock.mock} <span style={{ color: 'var(--ink3)', fontWeight: 400 }}>({s.weakestMock.avg}%)</span></span> : <span style={{ color: 'var(--ink3)' }}>—</span>}</td>
                    </>) : d.options.subjects.map((sub) => <td key={sub}>{s.subjectAvgs[sub] ? <Pct v={s.subjectAvgs[sub]} /> : '—'}</td>)}
                    <td>{s.testsTaken ? <Pct v={s.overallAvg} /> : '—'}</td>
                  </tr>
                  {open === s.id && (
                    <tr><td colSpan={cols + 5} style={{ background: 'var(--surface2)' }}>
                      {s.results.length === 0 ? <span className="sec-sub">No tests taken yet.</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 0' }}>
                          {s.results.map((r, k) => (
                            <span key={k} style={{ background: '#fff', border: `1px solid ${r.percent < 60 ? '#fecaca' : 'var(--border, #e2e8f0)'}`, borderRadius: 8, padding: '4px 10px', fontSize: '.78rem' }}>
                              <strong>{mockName(r.mock)}</strong> · {r.subject} · {r.test} · <Pct v={r.percent} />
                            </span>))}
                        </div>)}
                    </td></tr>)}
                </Fragment>))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}

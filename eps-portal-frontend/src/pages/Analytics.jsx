import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Loading, Stat } from '../../components/ui.jsx';
import { PALETTE, Pct } from '../marks/shared.jsx';

const Chart = ({ data, xKey, bars }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
      <Tooltip formatter={(v) => `${v}%`} />{bars.length > 1 && <Legend />}
      {bars.map((b, i) => <Bar key={b} dataKey={b} name={b === 'avg' ? 'Average' : b} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />)}
    </BarChart>
  </ResponsiveContainer>
);

const Strands = ({ list }) => (list.length === 0 ? <div className="sec-sub">No data yet.</div> : list.map((x) => (
  <div key={x.section} style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}><span>{x.section}</span><Pct v={x.avg} /></div>
    <div className="progress" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${x.avg}%`, background: x.avg >= 80 ? 'var(--green)' : x.avg >= 60 ? 'var(--amber)' : 'var(--red)' }} /></div>
  </div>)));

// IBT (mock test) analytics. Admins pick any grade; teachers are locked to their own by the server.
export default function IbtAnalytics() {
  const [f, setF] = useState({ grade: '', section: '', subject: '' });
  const { data: d, loading, error } = useFetch(`/analytics?${new URLSearchParams(f)}`);
  if (loading && !d) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const t = d.totals;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-input" value={d.options.gradeLocked ? d.options.grades[0] : f.grade} disabled={d.options.gradeLocked} onChange={set('grade')}>
              {!d.options.gradeLocked && <option value="">All grades</option>}{d.options.grades.map((g) => <option key={g}>{g}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Section</label>
            <select className="form-input" value={f.section} onChange={set('section')}><option value="">All sections</option>{d.options.sections.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Subject</label>
            <select className="form-input" value={f.subject} onChange={set('subject')}><option value="">All subjects</option>{d.options.subjects.map((s) => <option key={s}>{s}</option>)}</select></div>
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

          <div className="card">
            <div className="card-title">Student ranking · {d.studentRows.length} students</div>
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Student</th><th>Grade</th><th>Sec</th><th>Tests</th>{d.options.subjects.map((s) => <th key={s}>{s}</th>)}<th>Overall</th></tr></thead>
              <tbody>{d.studentRows.map((s, i) => (
                <tr key={s.id}><td>{i + 1}</td><td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.grade}</td><td>{s.section || '—'}</td><td>{s.testsTaken}</td>
                  {d.options.subjects.map((sub) => <td key={sub}>{s.subjectAvgs[sub] ? <Pct v={s.subjectAvgs[sub]} /> : '—'}</td>)}
                  <td>{s.testsTaken ? <Pct v={s.overallAvg} /> : '—'}</td></tr>))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}

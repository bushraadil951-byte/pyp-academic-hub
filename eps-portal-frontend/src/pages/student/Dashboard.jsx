import { Link } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent, Stat, fmtDate } from '../../components/ui.jsx';

export default function StudentDashboard() {
  const { data: d, loading, error } = useFetch('/student/dashboard');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const done = new Set(d.completedTestIds);
  const todo = d.tests.filter((t) => !done.has(t.id));
  return (
    <>
      <div className="stat-grid">
        <Stat icon="📝" bg="#eef2ff" value={todo.length} label="Tests to take" />
        <Stat icon="✅" bg="#ecfdf5" value={d.results.length} label="Tests completed" />
        <Stat icon="📊" bg="#fffbeb" value={`${d.avg}%`} label="My average" />
        <Stat icon="🎓" bg="#f5f3ff" value={d.student.grade} label="Grade" />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Available tests</div>
        {todo.length === 0 ? <Empty>You’re all caught up. New tests appear here when your teacher activates them.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Test</th><th>Subject</th><th>Difficulty</th><th>Duration</th><th /></tr></thead>
            <tbody>{todo.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.name}</td><td><Badge>{t.subject}</Badge></td><td>{t.difficulty}</td><td>{t.duration} min</td>
                <td style={{ textAlign: 'right' }}><Link className="btn btn-primary btn-sm" to={`/student/test/${t.id}`}>Start test</Link></td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
      <div className="card">
        <div className="sec-header"><div className="sec-title">Recent results</div><Link to="/student/scores" className="btn btn-secondary btn-sm">All scores</Link></div>
        {d.results.length === 0 ? <Empty>No results yet.</Empty> : d.results.slice(0, 5).map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--surface2)' }}>
            <span>{r.test} <span style={{ color: 'var(--ink3)' }}>· {fmtDate(r.takenAt)}</span></span><Percent value={r.percent} />
          </div>))}
      </div>
    </>
  );
}

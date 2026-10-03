import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent, Stat, fmtDate } from '../../components/ui.jsx';

function ScoreChart({ rows, labelKey }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v) => `${v}%`} />
        <Bar dataKey="avg" name="Average" fill="#6366f1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboard() {
  const { data, loading, error } = useFetch('/admin/dashboard');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const d = data;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Link to="/portal" className="btn btn-secondary btn-sm">🏠 Portal Home</Link>
      </div>
      <div className="stat-grid">
        <Stat icon="👨‍🎓" bg="#eef2ff" value={d.studentCount} label="Total Students" />
        <Stat icon="📝" bg="#ecfdf5" value={d.activeTests} label="Active Tests" />
        <Stat icon="📊" bg="#fffbeb" value={`${d.avgScore}%`} label="Class Average" />
        <Stat icon="✅" bg="#f5f3ff" value={d.submitted} label="Tests Submitted" />
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card"><div className="card-title">Score by Grade</div><ScoreChart rows={d.byGrade} labelKey="grade" /></div>
        <div className="card"><div className="card-title">Score by Subject</div><ScoreChart rows={d.bySubject} labelKey="subject" /></div>
      </div>
      <div className="card">
        <div className="sec-header">
          <div className="sec-title">Recent Submissions</div>
        </div>
        {d.recent.length === 0 ? <Empty>No submissions yet. Results appear here once students finish a test.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th>Test</th><th>Subject</th><th>Score</th><th>Date</th></tr></thead>
            <tbody>{d.recent.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.student}</td>
                <td style={{ color: 'var(--ink3)' }}>{r.test}</td>
                <td><Badge>{r.subject}</Badge></td>
                <td><Percent value={r.percent} /></td>
                <td>{fmtDate(r.takenAt)}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

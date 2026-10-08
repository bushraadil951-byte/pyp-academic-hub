import { Link } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent, Stat, fmtDate } from '../../components/ui.jsx';

export default function TeacherDashboard() {
  const { data: d, loading, error } = useFetch('/teacher/dashboard');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  if (d.grade === null && d.studentCount === 0) return <div className="card"><Empty>No access assigned to your account yet. Ask an administrator to assign one.</Empty></div>;
  return (
    <>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone="purple">👁️ Viewing: {d.grade}{d.section && d.section !== 'All sections' ? ` - Sec ${d.section}` : ''}</Badge>
          <Badge tone="blue">✏️ Editing: {d.access?.editGrade || 'All grades'}{d.access?.editSection ? ` - Sec ${d.access.editSection}` : ''}</Badge>
        </div>
        <Link to="/portal" className="btn btn-secondary btn-sm">🏠 Portal Home</Link>
      </div>
      <div className="stat-grid">
        <Stat icon="👨‍🎓" bg="#eef2ff" value={d.studentCount} label="My Students" />
        <Stat icon="📝" bg="#ecfdf5" value={d.activeTests} label="Active Tests" />
        <Stat icon="📊" bg="#fffbeb" value={`${d.avgScore}%`} label="Class Average" />
        <Stat icon="✅" bg="#f5f3ff" value={d.submitted} label="Tests Submitted" />
      </div>
      <div className="card">
        <div className="sec-header"><div className="sec-title">Recent Submissions</div><Link to="/teacher/students" className="btn btn-secondary btn-sm">All students</Link></div>
        {d.recent.length === 0 ? <Empty>No submissions from your class yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th>Test</th><th>Score</th><th>Date</th></tr></thead>
            <tbody>{d.recent.map((r) => (
              <tr key={r.id}><td style={{ fontWeight: 500 }}>{r.student}</td><td style={{ color: 'var(--ink3)' }}>{r.test}</td><td><Percent value={r.percent} /></td><td>{fmtDate(r.takenAt)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

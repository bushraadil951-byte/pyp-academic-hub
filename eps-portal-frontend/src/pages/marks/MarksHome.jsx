import { Link } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Loading, Stat } from '../../components/ui.jsx';
import { KindTabs, useKind } from './shared.jsx';

export default function MarksHome() {
  const { data: cfg } = useFetch('/marks/config');
  const { kind } = useKind(cfg);
  const { data: d, loading, error } = useFetch(`/marks/${kind.toLowerCase()}/dashboard`);
  if (loading || !cfg) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  return (
    <>
      <KindTabs kind={kind} isAdmin={cfg.isAdmin} />
      <div className="sec-header"><div><div className="sec-title">{d.label}</div><div className="sec-sub">Academic year {d.academicYear}{cfg.gradeLocked ? ` · ${cfg.grades[0]}` : ''}</div></div>
        <Link to="/marks" className="btn btn-secondary btn-sm">All assessment types</Link></div>
      <div className="stat-grid">
        <Stat icon="🗂️" bg="#eef2ff" value={d.totalSheets} label="Mark sheets" />
        <Stat icon="✍️" bg="#ecfdf5" value={d.totalMarks} label="Marks entered" />
        <Stat icon="👨‍🎓" bg="#fffbeb" value={d.totalStudents} label="Students" />
      </div>
      <div className="card">
        <div className="card-title">Students by grade</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Grade</th><th>Students</th><th /></tr></thead>
          <tbody>{d.grades.map((g) => (
            <tr key={g.grade}><td style={{ fontWeight: 500 }}>{g.grade}</td><td>{g.studentCount}</td>
              <td style={{ textAlign: 'right' }}>
                <Link className="btn btn-secondary btn-xs" to={`/marks/${kind}/entry?grade=${encodeURIComponent(g.grade)}`}>Enter marks</Link>{' '}
                <Link className="btn btn-secondary btn-xs" to={`/marks/${kind}/analytics?grade=${encodeURIComponent(g.grade)}`}>Analytics</Link>
              </td></tr>))}
          </tbody>
        </table></div>
        <div className="sec-sub" style={{ marginTop: 10 }}>{kind} numbers: {d.numbers.map((n) => `${kind}${n}`).join(', ')}</div>
      </div>
    </>
  );
}

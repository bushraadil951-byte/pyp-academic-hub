import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Loading, Stat } from '../../components/ui.jsx';
import { IB_TABS, ScoreBar, Tabs, useProfileConfig } from './shared.jsx';

export default function IbDashboard() {
  const { data: cfg } = useProfileConfig();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const { data: d, loading, error } = useFetch(`/profile/ib/dashboard?${new URLSearchParams({ grade, section })}`);
  if (!cfg || loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  return (
    <>
      <Tabs items={IB_TABS} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ maxWidth: 520 }}>
          {!cfg.gradeLocked && <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-input" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">All grades</option>{cfg.grades.map((g) => <option key={g}>{g}</option>)}</select></div>}
          <div className="form-group"><label className="form-label">Section</label>
            <select className="form-input" value={section} onChange={(e) => setSection(e.target.value)}><option value="">All sections</option>{cfg.sections.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
      </div>
      <div className="stat-grid">
        <Stat icon="👨‍🎓" bg="#eef2ff" value={d.students.length} label="Students" />
        <Stat icon="🌱" bg="#ecfdf5" value={d.totalLp} label="Learner Profile ratings" />
        <Stat icon="🧭" bg="#fffbeb" value={d.totalAtl} label="ATL ratings" />
      </div>
      <div className="grid-2" style={{ marginBottom: 16, gridTemplateColumns: 'minmax(280px,1fr) 2fr' }}>
        <div className="card">
          <div className="card-title">Class average by attribute (teacher ratings, 1–4)</div>
          {cfg.learnerProfile.map((a) => (
            <div key={a.attribute} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}><span>{a.emoji} {a.attribute}</span><strong>{d.lpAvgs[a.attribute] || '—'}</strong></div>
              <ScoreBar value={d.lpAvgs[a.attribute]} />
            </div>))}
        </div>
        <div className="card">
          <div className="card-title">Students</div>
          {d.students.length === 0 ? <Empty>No students match.</Empty> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Student</th><th>Grade</th><th>Sec</th><th>LP</th><th>ATL</th><th /></tr></thead>
              <tbody>{d.students.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.grade}</td><td>{s.section || '—'}</td><td>{s.lpCount}</td><td>{s.atlCount}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn btn-secondary btn-xs" to={`/ib/learner-profile?studentId=${s.id}`}>Rate LP</Link>{' '}
                    <Link className="btn btn-secondary btn-xs" to={`/ib/atl?studentId=${s.id}`}>Rate ATL</Link>{' '}
                    <Link className="btn btn-primary btn-xs" to={`/ib/report/${s.id}`}>Report</Link>
                  </td>
                </tr>))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}

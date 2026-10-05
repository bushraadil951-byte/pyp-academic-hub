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
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%' }}>
        <Stat icon="👨‍🎓" bg="#eef2ff" value={d.students.length} label="Students" />
        <Stat icon="🌱" bg="#ecfdf5" value={d.totalLp} label="Learner Profile ratings" />
        <Stat icon="🧭" bg="#fffbeb" value={d.totalAtl} label="ATL ratings" />
      </div>
{/* Learner Profile - Class Averages Cards */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span>🌱</span> Learner Profile — Class Averages (All UOIs)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          {cfg.learnerProfile.map((a) => {
            const avg = d.lpAvgs[a.attribute];
            return (
              <div
                key={a.attribute}
                style={{
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ fontSize: '1.25rem' }}>{a.emoji}</div>
                <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#1e293b' }}>{a.attribute}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: avg ? '#d97706' : '#94a3b8' }}>
                  {avg ? avg : '—'}{' '}
                  <span style={{ fontSize: '.85rem', fontWeight: 400, color: '#94a3b8' }}>/ 4</span>
                </div>
                <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>
                  {avg ? (avg >= 3 ? 'Proficient' : avg >= 2 ? 'Developing' : 'Emerging') : 'No data'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Students List Table */}
      <div className="card" style={{ marginBottom: 16 }}>
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

    </>
  );
}

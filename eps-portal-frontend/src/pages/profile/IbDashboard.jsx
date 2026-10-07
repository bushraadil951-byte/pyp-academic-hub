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
{/* Learner Profile - Modern Colorful Hover Zoom Cards */}
{/* ISP Profile - Modern Colorful Hover Zoom Cards (Students list se pehle) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: '1.2rem' }}>🌟</span> Class average by attribute (1–4)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 14 }}>
          {cfg.ispProfile.map((a, idx) => {
            const avg = d.ispAvgs[a.attribute];

            const palette = [
              { border: '#ec4899', bg: '#fdf2f8', iconBg: '#fce7f3', badge: '#be185d' }, // Honesty / Pink
              { border: '#f59e0b', bg: '#fffbeb', iconBg: '#fef3c7', badge: '#b45309' }, // Courage / Amber
              { border: '#10b981', bg: '#ecfdf5', iconBg: '#d1fae5', badge: '#047857' }, // Gratitude / Emerald
              { border: '#3b82f6', bg: '#eff6ff', iconBg: '#dbeafe', badge: '#1d4ed8' }, // Justice / Blue
              { border: '#8b5cf6', bg: '#f5f3ff', iconBg: '#ede9fe', badge: '#6d28d9' }, // Forgiveness / Violet
              { border: '#14b8a6', bg: '#f0fdfa', iconBg: '#ccfbf1', badge: '#0f766e' }, // Humility / Teal
              { border: '#ef4444', bg: '#fef2f2', iconBg: '#fee2e2', badge: '#b91c1c' }, // Compassion / Red
              { border: '#f97316', bg: '#fff7ed', iconBg: '#ffedd5', badge: '#c2410c' }, // Generosity / Orange
              { border: '#06b6d4', bg: '#ecfeff', iconBg: '#cffafe', badge: '#0e7490' }, // Cyan
              { border: '#6366f1', bg: '#eef2ff', iconBg: '#e0e7ff', badge: '#4338ca' }, // Indigo
            ];
            const theme = palette[idx % palette.length];

            return (
              <div
                key={a.attribute}
                style={{
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 14,
                  padding: '16px 14px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.04) translateY(-3px)';
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.boxShadow = `0 10px 20px -5px ${theme.border}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1) translateY(0)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: theme.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}
                >
                  {a.emoji}
                </div>

                <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#1e293b' }}>
                  {a.attribute}
                </div>

                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: avg ? theme.badge : '#94a3b8' }}>
                  {avg ? avg : '—'}{' '}
                  <span style={{ fontSize: '.8rem', fontWeight: 400, color: '#94a3b8' }}>/ 4</span>
                </div>

                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '.72rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 20,
                      background: avg ? theme.bg : '#f1f5f9',
                      color: avg ? theme.badge : '#64748b',
                      border: `1px solid ${avg ? theme.border + '33' : '#e2e8f0'}`,
                    }}
                  >
                    {avg ? (avg >= 3 ? 'Proficient' : avg >= 2 ? 'Developing' : 'Emerging') : 'No data'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Students List Table */}
      <div className="card">
        <div className="card-title">Students</div>
        {d.students.length === 0 ? <Empty>No students match.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th>Grade</th><th>Sec</th><th>Rated</th><th>Average</th><th /></tr></thead>
            <tbody>{d.students.map((s) => (
              <tr key={s.id}><td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.grade}</td><td>{s.section || '—'}</td>
                <td>{s.rated}/{cfg.ispProfile.length}</td><td>{s.avg || '—'}</td>
                <td style={{ textAlign: 'right' }}><Link className="btn btn-primary btn-xs" to={`/isp/rate?studentId=${s.id}`}>Rate</Link></td></tr>))}
            </tbody>
          </table></div>
        )}
      </div>

    </>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';

// Shared /profile/config (terms, scales, constants). Cached per mount; it is small.
export const useProfileConfig = () => useFetch('/profile/config');

export const levelLabel = (cfg, v) => (v ? cfg.ratingScale[String(v)] : '—');
export const levelColor = (cfg, v) => (v ? cfg.ratingColors[String(v)] : '#cbd5e1');

// Four-button rating picker: 1 Beginning · 2 Developing · 3 Achieved · 4 Exceeding. Click the active one again to clear.
export function RatingPicker({ cfg, value, onChange, disabled, name }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4].map((n) => {
        const on = Number(value) === n;
        const c = cfg.ratingColors[String(n)];
        return (
          <button key={n} type="button" role="radio" aria-checked={on} disabled={disabled}
            onClick={() => onChange(on ? '' : n)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: '.75rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
              border: `1.5px solid ${on ? c : 'var(--border, #e2e8f0)'}`, background: on ? c : 'transparent', color: on ? '#fff' : 'var(--ink2, #475569)',
            }}>
            {n} · {cfg.ratingScale[String(n)]}
          </button>
        );
      })}
    </div>
  );
}

// Small coloured pill showing a rating
export function RatingPill({ cfg, value, prefix }) {
  if (!value) return <span style={{ color: 'var(--ink3)' }}>—</span>;
  return <span className="badge" style={{ background: `${levelColor(cfg, value)}22`, color: levelColor(cfg, value), fontWeight: 700 }}>{prefix}{Math.round(value * 10) / 10} {Number.isInteger(value) ? cfg.ratingScale[String(value)] : ''}</span>;
}

export function ScoreBar({ value, color = '#6366f1' }) {
  return <div className="progress" style={{ height: 8 }}><div className="progress-fill" style={{ width: `${Math.min(100, ((value || 0) / 4) * 100)}%`, background: color }} /></div>;
}

export function Tabs({ items }) {
  const { pathname } = useLocation();
  return (
    <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
      {items.map(([to, label]) => (
        <Link key={to} to={to} className={`tab-btn ${pathname === to.split('?')[0] ? 'active' : ''}`} style={{ textDecoration: 'none' }}>{label}</Link>
      ))}
    </div>
  );
}

export const IB_TABS = [['/ib', 'Overview'], ['/ib/learner-profile', 'Learner Profile'], ['/ib/atl', 'ATL skills']];
export const ISP_TABS = [['/isp', 'Overview'], ['/isp/rate', 'Rate students']];

// Grade/section/student pickers used by every staff rating page.
export function StudentPicker({ cfg, grade, setGrade, section, setSection, students, studentId, setStudentId, extra }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="form-group"><label className="form-label">Grade</label>
          <select className="form-input" value={grade} disabled={cfg.gradeLocked} onChange={(e) => { setGrade(e.target.value); setStudentId(''); }}>
            {cfg.grades.map((g) => <option key={g}>{g}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Section</label>
          <select className="form-input" value={section} onChange={(e) => { setSection(e.target.value); setStudentId(''); }}>
            <option value="">All sections</option>{cfg.sections.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Student</label>
          <select className="form-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Choose a student…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.section ? ` (${s.section})` : ''}</option>)}
          </select></div>
        {extra}
      </div>
    </div>
  );
}

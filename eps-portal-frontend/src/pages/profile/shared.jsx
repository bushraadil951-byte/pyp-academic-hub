import { Link, useLocation, useParams } from 'react-router-dom';
import { pctColor } from '../../components/ui.jsx';

export const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

export const Pct = ({ v }) => (v === null || v === undefined
  ? <span style={{ color: 'var(--ink3)' }}>—</span>
  : <span style={{ fontWeight: 700, color: pctColor(v) }}>{v}%</span>);

// Reads :kind from the URL ('dt' | 'DT' → 'DT') and the matching entry of /marks/config.
export function useKind(cfg) {
  const { kind: raw } = useParams();
  const kind = (raw || '').toUpperCase();
  return { kind, kc: cfg?.kinds?.[kind] };
}

// Marks pages work for both Primary (/marks/...) and EY (/ey/...).
export function useLevel() {
  const { pathname } = useLocation();
  const ey = pathname.toLowerCase().startsWith('/ey');
  return {
    ey,
    base: ey ? '/ey' : '/marks',
    cfgUrl: ey ? '/marks/config?level=ey' : '/marks/config',
  };
}

export function KindTabs({ kind, isAdmin }) {
  const { ey, base } = useLevel();
  const { pathname } = useLocation();
  const links = [
    ['', 'Overview'],
    ['/entry', 'Enter marks'],
    ['/upload', 'Upload CSV'],
    ['/analytics', 'Grade analytics'],
    ...(isAdmin && !ey ? [['/cross-grade', 'Cross-grade']] : []),
  ];
  return (
    <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
      {links.map(([path, label]) => (
        <Link
          key={path}
          to={`${base}/${kind}${path}`}
          className={`tab-btn ${pathname.replace(/\/$/, '').toLowerCase() === `${base}/${kind}${path}`.toLowerCase() ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

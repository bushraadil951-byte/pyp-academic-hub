import { Link } from 'react-router-dom';

const TILES = [
  { to: '/ey/FA', icon: '📋', name: 'FA — Formative Assessments', desc: 'Enter and review FA marks for Nursery, KG-1 and KG-2.' },
  { to: '/ey/SA', icon: '📋', name: 'SA — Summative Assessments', desc: 'Enter and review SA marks for Nursery, KG-1 and KG-2.' },
  { to: '/aptitude?level=ey', icon: '🎯', name: 'EY Aptitude', desc: 'Aptitude strands calculated from FA and SA (50% each).' },
];

export default function EyHub() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {TILES.map((t) => (
        <Link key={t.to} to={t.to} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '1.6rem' }}>{t.icon}</div>
          <div className="sec-title" style={{ marginTop: 8 }}>{t.name}</div>
          <div className="sec-sub">{t.desc}</div>
        </Link>
      ))}
    </div>
  );
}

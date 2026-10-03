import { Link, useParams } from 'react-router-dom';

const NAMES = {
  dt: 'DT — Diagnostic Tests', isp: 'ISP Profile Development', assessments: 'FA & SA — Formative & Summative',
  ib: 'IB Profile Development', aptitude: 'Aptitude Analytics',
};

// Placeholder for modules that still need porting from the Flask templates (see README → Migration status).
export default function ComingSoon() {
  const { key } = useParams();
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-title">{NAMES[key] || 'This module'} isn’t ported yet</div>
      <p style={{ color: 'var(--ink3)', marginBottom: 14 }}>
        This module still runs on the Flask app. Its React page and Node API route are the next items in the migration list.
      </p>
      <Link to="/portal" className="btn btn-secondary btn-sm">Back to portal home</Link>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Loading } from '../../components/ui.jsx';

const ICON = { DT: '📊', FA: '📋', SA: '🧾' };

export default function MarksHub() {
  const { data, loading, error } = useFetch('/marks/hub');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  return (
    <>
      <div className="sec-header"><div><div className="sec-title">Marks & Assessments</div><div className="sec-sub">Choose an assessment type to enter marks or view analytics.</div></div></div>
      <div className="stat-grid">
        {data.map((k) => (
          <Link key={k.kind} to={`/marks/${k.kind}`} className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon" style={{ background: '#eef2ff' }}>{ICON[k.kind]}</div>
            <div className="stat-value">{k.kind}</div>
            <div className="stat-label">{k.label}</div>
            <div className="sec-sub" style={{ marginTop: 8 }}>{k.totalSheets} sheets · {k.totalMarks} marks entered</div>
          </Link>
        ))}
      </div>
    </>
  );
}

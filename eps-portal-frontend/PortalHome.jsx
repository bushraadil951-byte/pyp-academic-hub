import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ACADEMIC_YEAR, PORTAL_MODULES, ROLE_LABELS } from '../constants.js';
import './portal.css';

export default function PortalHome() {
  const { user } = useAuth();
  const modules = PORTAL_MODULES[user.role] || [];
  return (
    <div className="portal-wrap">
      <section className="portal-hero">
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="eyebrow-dot" />EASTERN PUBLIC SCHOOL</div>
          <h1>Welcome to the <span>PYP Academic Hub</span></h1>
          <p className="hero-description">A central space for assessment, student development, academic tracking, and learning progress.</p>
          <div className="hero-user">
            <div className="hero-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="hero-user-name">Welcome, {user.name}</div>
              <div className="hero-user-role">{ROLE_LABELS[user.role]} &nbsp;•&nbsp; {ACADEMIC_YEAR}</div>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-circle circle-one" /><div className="visual-circle circle-two" />
          <div className="visual-card"><div className="visual-icon">🎓</div><div className="visual-title">PYP</div><div className="visual-subtitle">Academic Hub</div></div>
        </div>
      </section>

      <div className="modules-heading">
        <div>
          <div className="section-eyebrow">YOUR WORKSPACE</div>
          <h2>Academic Modules</h2>
          <p>Select a module to continue.</p>
        </div>
        <div className="academic-badge"><span>●</span>{ACADEMIC_YEAR}</div>
      </div>

      <div className="module-grid">
        {modules.length === 0 && (
          <div className="no-modules"><div className="no-modules-icon">📚</div><div>No modules available for your role yet.</div></div>
        )}
        {modules.map((m) => (
          <Link key={m.key} to={m.to} className={`module-card module-${m.key}`}>
            <div className="module-top"><div className="mc-icon">{m.icon}</div><div className="module-open">→</div></div>
            <div className="mc-name">{m.name}</div>
            <div className="mc-desc">{m.desc}</div>
            <div className="mc-footer"><span>Open module</span></div>
          </Link>
        ))}
      </div>

      <div className="portal-footer">
        <div className="footer-line" />
        <div className="footer-content"><span>Eastern Public School</span><span>•</span><span>PYP Academic Hub</span><span>•</span><span>{ACADEMIC_YEAR}</span></div>
      </div>
    </div>
  );
}

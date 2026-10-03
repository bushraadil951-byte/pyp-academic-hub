import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ROLES, ROLE_LABELS } from '../constants.js';

const NAV = {
  [ROLES.ADMIN]: [
    ['Main', [['/portal', '🏠', 'Home']]],
    ['Manage', [['/admin/students', '👨‍🎓', 'Students'], ['/admin/teachers', '👩‍🏫', 'Teachers'], ['/admin/tests', '📝', 'IBT Mock Tests']]],
    ['Assessments', [['/marks/DT', '📊', 'Diagnostic Tests (DT)'], ['/marks/FA', '📋', 'Formative (FA)'], ['/marks/SA', '🧾', 'Summative (SA)']]],
    ['Student Development', [['/ib', '🌱', 'IB Profile'], ['/isp', '📖', 'ISP Profile'], ['/aptitude', '🎯', 'Aptitude']]],
  ],
  [ROLES.TEACHER]: [
    ['Main', [['/portal', '🏠', 'Home'], ['/teacher/students', '👨‍🎓', 'Students']]],
    ['Assessments', [['/marks/DT', '📊', 'Diagnostic Tests (DT)'], ['/marks/FA', '📋', 'Formative (FA)'], ['/marks/SA', '🧾', 'Summative (SA)']]],
    ['Student Development', [['/ib', '🌱', 'IB Profile'], ['/isp', '📖', 'ISP Profile'], ['/aptitude', '🎯', 'Aptitude']]],
  ],
  [ROLES.STUDENT]: [['Main', [['/portal', '🏠', 'Home'], ['/student/progress/DT', '📊', 'My Diagnostics'], ['/student/ib', '🌱', 'My IB Profile'], ['/student/isp', '📖', 'My ISP Profile'], ['/student/aptitude', '🎯', 'My Aptitude']]]],
};

export default function Layout({ title = 'Academic Hub', back }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const sections = NAV[user.role] || [];
  const active = (to) => (to === '/portal' ? pathname === '/portal' : pathname.startsWith(to));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/eps-logo.png" className="sidebar-eps-logo" alt="Eastern Public School" />
          <div className="sidebar-hub">PYP Academic Hub</div>
          <div className="sidebar-meta">Developing Minds. Discovering Potential. Shaping Futures.</div>
        </div>
        {sections.map(([label, links]) => (
          <div key={label}>
            <div className="nav-section">{label}</div>
            {links.map(([to, icon, text]) => (
              <Link key={to} to={to} className={`nav-link ${active(to) ? 'active' : ''}`}>
                <span className="nav-icon">{icon}</span>{text}
              </Link>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <div className="sidebar-user">{user.name}</div>
          <div className="sidebar-role">{ROLE_LABELS[user.role] || user.role}</div>
          <button className="btn-signout" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {back && <Link to={back} className="back-btn">← Back</Link>}
            <div className="topbar-title">{title}</div>
          </div>
          <div className="topbar-user">{ROLE_LABELS[user.role]} · {user.name}</div>
        </div>
        <div className="page"><Outlet /></div>
      </main>
    </div>
  );
}

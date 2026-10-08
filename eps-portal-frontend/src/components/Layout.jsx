import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Home, GraduationCap, Users, TrendingUp, BarChart3, ClipboardList,
  FileCheck, Sprout, BookOpen, Target, LogOut, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { ROLES, ROLE_LABELS } from '../constants.js';

const DEV = ['Student Development', [['/ib', Sprout, 'IB Profile'], ['/isp', BookOpen, 'ISP Profile'], ['/aptitude', Target, 'Aptitude']]];
const ASSESS = ['Assessments', [['/marks/DT', BarChart3, 'Diagnostic Tests (DT)'], ['/marks/FA', ClipboardList, 'Formative (FA)'], ['/marks/SA', FileCheck, 'Summative (SA)']]];

const NAV = {
  [ROLES.ADMIN]: [
    ['Main', [['/portal', Home, 'Home']]],
    ['Manage', [['/admin/students', GraduationCap, 'Students'], ['/admin/teachers', Users, 'Teachers'], ['/analytics', TrendingUp, 'IBT Analytics']]],
    ASSESS, DEV,
  ],
  [ROLES.TEACHER]: [
    ['Main', [['/portal', Home, 'Home'], ['/teacher/students', GraduationCap, 'Students']]],
    ASSESS, DEV,
  ],
  [ROLES.STUDENT]: [
    ['Main', [
      ['/portal', Home, 'Home'], ['/analytics', TrendingUp, 'IBT Analytics'],
      ['/student/progress/DT', BarChart3, 'My Diagnostics'], ['/student/ib', Sprout, 'My IB Profile'],
      ['/student/isp', BookOpen, 'My ISP Profile'], ['/student/aptitude', Target, 'My Aptitude'],
    ]],
  ],
};

export default function Layout({ title = 'Academic Hub', back }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const sections = NAV[user.role] || [];
  const active = (to) => (to === '/portal' ? pathname === '/portal' : pathname.startsWith(to));
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/eps-logo.png" className="sidebar-eps-logo" alt="Eastern Public School" />
          <div className="sidebar-hub">PYP Academic Hub</div>
          <div className="sidebar-meta">Developing Minds. Discovering Potential. Shaping Futures.</div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(([label, links]) => (
            <div key={label}>
              <div className="nav-section">{label}</div>
              {links.map(([to, Icon, text]) => (
                <Link key={to} to={to} className={`nav-link ${active(to) ? 'active' : ''}`}>
                  <Icon className="nav-icon" size={18} strokeWidth={1.75} />
                  <span>{text}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-avatar">{initial}</div>
          <div className="sidebar-userinfo">
            <div className="sidebar-user">{user.name}</div>
            <div className="sidebar-role">{ROLE_LABELS[user.role] || user.role}</div>
          </div>
          <Link to="/change-password" className="nav-link" style={{ padding: '6px 0', fontSize: '.78rem' }}>🔒 Change password</Link>
          <button className="btn-signout" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut size={17} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          {back && (
            <Link to={back} className="back-btn"><ArrowLeft size={16} /> Back</Link>
          )}
          <h1 className="topbar-title">{title}</h1>
        </header>
        <div className="page"><Outlet /></div>
      </main>
    </div>
  );
}

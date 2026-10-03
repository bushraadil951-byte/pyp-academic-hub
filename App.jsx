import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ROLES } from './constants.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PortalHome from './pages/PortalHome.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminStudents from './pages/admin/Students.jsx';
import AdminTeachers from './pages/admin/Teachers.jsx';
import AdminTests from './pages/admin/Tests.jsx';
import AdminQuestions from './pages/admin/Questions.jsx';
import TeacherDashboard from './pages/teacher/Dashboard.jsx';
import TeacherStudents from './pages/teacher/Students.jsx';
import StudentDashboard from './pages/student/Dashboard.jsx';
import StudentTest from './pages/student/Test.jsx';
import StudentScores from './pages/student/Scores.jsx';
import StudentReview from './pages/student/Review.jsx';
import StudentProgress from './pages/student/Progress.jsx';
import MarksHub from './pages/marks/MarksHub.jsx';
import MarksHome from './pages/marks/MarksHome.jsx';
import MarksEntry from './pages/marks/MarksEntry.jsx';
import MarksUpload from './pages/marks/MarksUpload.jsx';
import MarksAnalytics from './pages/marks/MarksAnalytics.jsx';
import MarksCross from './pages/marks/MarksCross.jsx';

// Replaces Flask's @login_required(role). Wrong role -> back to the portal; logged out -> login.
function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/portal" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const { ADMIN, TEACHER, STUDENT } = ROLES;
  const routes = [
    ['/portal', [ADMIN, TEACHER, STUDENT], 'Academic Hub', <PortalHome />],
    ['/soon/:key', [ADMIN, TEACHER, STUDENT], 'Coming soon', <ComingSoon />, '/portal'],
    ['/admin', [ADMIN], 'Dashboard', <AdminDashboard />],
    ['/admin/students', [ADMIN], 'Students', <AdminStudents />, '/admin'],
    ['/admin/teachers', [ADMIN], 'Teachers', <AdminTeachers />, '/admin'],
    ['/admin/tests', [ADMIN], 'IBT Mock Tests', <AdminTests />, '/admin'],
    ['/admin/tests/:testId/questions', [ADMIN], 'Question Bank', <AdminQuestions />, '/admin/tests'],
    ['/teacher', [TEACHER], 'Dashboard', <TeacherDashboard />],
    ['/teacher/students', [TEACHER], 'Students', <TeacherStudents />, '/teacher'],
    ['/marks', [ADMIN, TEACHER], 'Marks & Assessments', <MarksHub />],
    ['/marks/:kind', [ADMIN, TEACHER], 'Marks & Assessments', <MarksHome />, '/marks'],
    ['/marks/:kind/entry', [ADMIN, TEACHER], 'Enter Marks', <MarksEntry />, '/marks'],
    ['/marks/:kind/upload', [ADMIN, TEACHER], 'Upload Marks', <MarksUpload />, '/marks'],
    ['/marks/:kind/analytics', [ADMIN, TEACHER], 'Grade Analytics', <MarksAnalytics />, '/marks'],
    ['/marks/:kind/cross-grade', [ADMIN], 'Cross-grade Analytics', <MarksCross />, '/marks'],
    ['/student/progress/:kind', [STUDENT], 'My Progress', <StudentProgress />, '/student'],
    ['/student', [STUDENT], 'My Dashboard', <StudentDashboard />],
    ['/student/scores', [STUDENT], 'My Scores', <StudentScores />, '/student'],
    ['/student/review/:resultId', [STUDENT], 'Review', <StudentReview />, '/student/scores'],
  ];

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      {routes.map(([path, roles, title, el, back]) => (
        <Route key={path} element={<Guard roles={roles}><Layout title={title} back={back} /></Guard>}>
          <Route path={path} element={el} />
        </Route>
      ))}
      {/* Test-taking is full screen (no sidebar), as in the original test.html */}
      <Route path="/student/test/:testId" element={<Guard roles={[STUDENT]}><StudentTest /></Guard>} />
      <Route path="*" element={<Navigate to={user ? '/portal' : '/'} replace />} />
    </Routes>
  );
}

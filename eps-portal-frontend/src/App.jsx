import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ROLES } from './constants.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PortalHome from './pages/PortalHome.jsx';
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
import IbDashboard from './pages/profile/IbDashboard.jsx';
import IbLearnerProfile from './pages/profile/IbLearnerProfile.jsx';
import IbAtl from './pages/profile/IbAtl.jsx';
import IbReport from './pages/profile/IbReport.jsx';
import StudentIb from './pages/profile/StudentIb.jsx';
import IspDashboard from './pages/profile/IspDashboard.jsx';
import IspRate from './pages/profile/IspRate.jsx';
import StudentIsp from './pages/profile/StudentIsp.jsx';
import { AptitudeStaff, AptitudeStudent } from './pages/profile/Aptitude.jsx';
import IbtAnalytics from './pages/admin/Analytics.jsx';
import StudentUpload from './pages/admin/StudentUpload.jsx';
import ImportResults from './pages/admin/ImportResults.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import EmailImport from './pages/admin/EmailImport.jsx';

// Replaces Flask's @login_required(role). Wrong role -> back to the portal; logged out -> login.
function Guard({ roles, children, allowMustChange = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.mustChange && !allowMustChange) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/portal" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const { ADMIN, TEACHER, STUDENT } = ROLES;
  const routes = [
    ['/portal', [ADMIN, TEACHER, STUDENT], 'Academic Hub', <PortalHome />],
    ['/admin', [ADMIN], 'Dashboard', <AdminDashboard />],
    ['/admin/students', [ADMIN], 'Students', <AdminStudents />, '/admin'],
    ['/admin/teachers', [ADMIN], 'Teachers', <AdminTeachers />, '/admin'],
    ['/admin/students/upload', [ADMIN], 'Upload Students', <StudentUpload />, '/admin/students'],
    ['/analytics', [ADMIN, TEACHER], 'IBT Analytics', <IbtAnalytics />, '/portal'],
    ['/admin/tests', [ADMIN], 'IBT Mock Tests', <AdminTests />, '/portal'],
    ['/admin/import-results', [ADMIN], 'Import Results', <ImportResults />, '/admin/tests'],
    ['/admin/tests/:testId/questions', [ADMIN], 'Question Bank', <AdminQuestions />, '/admin/tests'],
    ['/teacher', [TEACHER], 'Dashboard', <TeacherDashboard />],
    ['/teacher/students', [TEACHER], 'Students', <TeacherStudents />, '/teacher'],
    ['/marks', [ADMIN, TEACHER], 'Marks & Assessments', <MarksHub />],
    ['/marks/:kind', [ADMIN, TEACHER], 'Marks & Assessments', <MarksHome />, '/marks'],
    ['/marks/:kind/entry', [ADMIN, TEACHER], 'Enter Marks', <MarksEntry />, '/marks'],
    ['/marks/:kind/upload', [ADMIN, TEACHER], 'Upload Marks', <MarksUpload />, '/marks'],
    ['/marks/:kind/analytics', [ADMIN, TEACHER], 'Grade Analytics', <MarksAnalytics />, '/marks'],
    ['/marks/:kind/cross-grade', [ADMIN], 'Cross-grade Analytics', <MarksCross />, '/marks'],
    ['/ib', [ADMIN, TEACHER], 'IB Profile Development', <IbDashboard />],
    ['/ib/learner-profile', [ADMIN, TEACHER], 'Learner Profile', <IbLearnerProfile />, '/ib'],
    ['/ib/atl', [ADMIN, TEACHER], 'ATL Skills', <IbAtl />, '/ib'],
    ['/ib/report/:studentId', [ADMIN, TEACHER], 'IB Report', <IbReport />, '/ib'],
    ['/isp', [ADMIN, TEACHER], 'ISP Profile Development', <IspDashboard />],
    ['/isp/rate', [ADMIN, TEACHER], 'ISP Rating', <IspRate />, '/isp'],
    ['/aptitude', [ADMIN, TEACHER], 'Aptitude Analytics', <AptitudeStaff />],
    ['/student/ib', [STUDENT], 'My IB Profile', <StudentIb />, '/student'],
    ['/student/isp', [STUDENT], 'My ISP Profile', <StudentIsp />, '/student'],
    ['/student/aptitude', [STUDENT], 'My Aptitude Profile', <AptitudeStudent />, '/student'],
    ['/student/progress/:kind', [STUDENT], 'My Progress', <StudentProgress />, '/student'],
    ['/student', [STUDENT], 'My Dashboard', <StudentDashboard />],
    ['/student/scores', [STUDENT], 'My Scores', <StudentScores />, '/student'],
    ['/student/review/:resultId', [STUDENT], 'Review', <StudentReview />, '/student/scores'],
    ['/admin/emails', [ADMIN], 'Import Emails', <EmailImport />, '/admin/students'],
  ];

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/change-password" element={<Guard allowMustChange><ChangePassword /></Guard>} />
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

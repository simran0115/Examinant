import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
// Components
import { AuthProvider, useAuth } from './contexts/AuthContext';
import DashboardLayout from './components/DashboardLayout';
// test
// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import TestSeriesPage from './pages/TestSeriesPage';
import TestSeriesDetailsPage from './pages/TestSeriesDetailsPage';
import FreeResourcesPage from './pages/FreeResourcesPage';
import ResultPage from './pages/ResultPage';
import AboutPage from './pages/AboutPage';
import NotFound from './pages/NotFound';
import TermsPage from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import RefundCancellationPolicyPage from './pages/RefundCancellationPolicyPage';
import GRPPage from './pages/GRPPage';
import UserAgreementPage from './pages/UserAgreementPage';
import CookiePolicyPage from './pages/CookiePolicyPage';
import DisclaimerPage from './pages/DisclaimerPage';

// Lazy Loaded Pages
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard'));
const StudentTestsPage = React.lazy(() => import('./pages/student/StudentTestsPage'));
const StudentMarketPage = React.lazy(() => import('./pages/student/StudentMarketPage'));
const StudentAnalyticsPage = React.lazy(() => import('./pages/student/StudentAnalyticsPage'));
const StudentTestAttemptPage = React.lazy(() => import('./pages/student/StudentTestAttemptPage'));
const StudentPYQsPage = React.lazy(() => import('./pages/student/StudentPYQsPage'));
const StudentResourcesPage = React.lazy(() => import('./pages/student/StudentResourcesPage'));
// const PYQsDiscoveryPage = React.lazy(() => import('./pages/PYQsDiscoveryPage'));
// const PYQDetailsPage = React.lazy(() => import('./pages/PYQDetailsPage'));
const StudentTestResultsPage = React.lazy(() => import('./pages/student/StudentTestResultsPage'));
const StudentTestResultDetailPage = React.lazy(() => import('./pages/student/StudentTestResultDetailPage'));

const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const AdminTestsPage = React.lazy(() => import('./pages/admin/AdminTestsPage'));
// const AdminPYQsPage = React.lazy(() => import('./pages/admin/AdminPYQsPage'));
// const AdminAddPYQPage = React.lazy(() => import('./pages/admin/AdminAddPYQPage'));
const AdminResourcesPage = React.lazy(() => import('./pages/admin/AdminResourcesPage'));
const AdminAddResourcePage = React.lazy(() => import('./pages/admin/AdminAddResourcePage'));
const AdminStudentsPage = React.lazy(() => import('./pages/admin/AdminStudentsPage'));
const AdminSettingsPage = React.lazy(() => import('./pages/admin/AdminSettingsPage'));
const QuestionBank = React.lazy(() => import('./pages/admin/QuestionBank'));
const AdminChaptersPage = React.lazy(() => import('./pages/admin/AdminChaptersPage'));
const TestSeriesManagement = React.lazy(() => import('./pages/admin/TestSeriesManagement'));
const TestCreationWizard = React.lazy(() => import('./pages/admin/TestCreationWizard'));
const AdminSubjectsPage = React.lazy(() => import('./pages/admin/AdminSubjectsPage'));
const AdminClassesPage = React.lazy(() => import('./pages/admin/AdminClassesPage'));
// ── OMR Feature (Removed) ──────────────────────────────────────────────



import './App.css';

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <Loader2 className="animate-spin text-teal-600" size={40} />
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('student' | 'admin')[] }) => {
  const auth = useAuth();

  if (!auth) return <PageLoader />;

  const { currentUser, loading, userRole } = auth;

  if (loading) return <PageLoader />;

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Role is required to decide access/redirects.
  if (allowedRoles && !userRole) {
    return <PageLoader />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on actual role if they try to access unauthorized area
    return <Navigate to={userRole === 'admin' ? '/admin-dashboard' : '/dashboard'} replace />;
  }

  // If roles are loaded but userRole is null (shouldn't happen for auth'd user based on our context logic), 
  // we might want to wait or handle it. But our context defaults to 'student' in fail-safe.

  return <Outlet />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/test-series" element={<TestSeriesPage />} />
              <Route path="/test-series/:id" element={<TestSeriesDetailsPage />} />
              {/* <Route path="/pyqs" element={<PYQsDiscoveryPage />} /> */}
              {/* <Route path="/pyqs/:id" element={<PYQDetailsPage />} /> */}
              <Route path="/resources" element={<FreeResourcesPage />} />
              <Route path="/results" element={<ResultPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/refund-policy" element={<RefundCancellationPolicyPage />} />
              <Route path="/grp" element={<GRPPage />} />
              <Route path="/sla" element={<Navigate to="/grp" replace />} />
              <Route path="/user-agreement" element={<UserAgreementPage />} />
              <Route path="/cookie-policy" element={<CookiePolicyPage />} />
              <Route path="/disclaimer" element={<DisclaimerPage />} />

              <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                {/* Dashboard Layout Routes */}
                <Route element={<DashboardLayout role="student"><Outlet /></DashboardLayout>}>
                  <Route path="/dashboard" element={<StudentDashboard />} />
                  <Route path="/dashboard/tests" element={<StudentTestsPage />} />
                  <Route path="/dashboard/market" element={<StudentMarketPage />} />
                  <Route path="/dashboard/pyqs" element={<StudentPYQsPage />} />
                  <Route path="/dashboard/resources" element={<StudentResourcesPage />} />
                  <Route path="/dashboard/analytics" element={<StudentAnalyticsPage />} />
                  <Route path="/dashboard/results" element={<StudentTestResultsPage />} />
                  <Route path="/dashboard/results/:attemptId" element={<StudentTestResultDetailPage />} />
                </Route>
                {/* Full Screen Test Route */}
                <Route path="/dashboard/attempt/:testId" element={<StudentTestAttemptPage />} />

              </Route>

              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route element={<DashboardLayout role="admin"><Outlet /></DashboardLayout>}>
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                  <Route path="/admin-dashboard/test-series" element={<TestSeriesManagement />} />
                  <Route path="/admin-dashboard/create-test" element={<TestCreationWizard />} />
                  <Route path="/admin-dashboard/tests" element={<AdminTestsPage />} />
                  <Route path="/admin-dashboard/question-bank" element={<QuestionBank />} />
                  <Route path="/admin-dashboard/chapters" element={<AdminChaptersPage />} />
                  <Route path="/admin-dashboard/subjects" element={<AdminSubjectsPage />} />
                  <Route path="/admin-dashboard/classes" element={<AdminClassesPage />} />
                  {/* <Route path="/admin-dashboard/pyqs" element={<AdminPYQsPage />} /> */}
                  {/* <Route path="/admin-dashboard/pyqs/new" element={<AdminAddPYQPage />} /> */}
                  <Route path="/admin-dashboard/resources" element={<AdminResourcesPage />} />
                  <Route path="/admin-dashboard/resources/new" element={<AdminAddResourcePage />} />
                  <Route path="/admin-dashboard/students" element={<AdminStudentsPage />} />
                  <Route path="/admin-dashboard/settings" element={<AdminSettingsPage />} />

                </Route>
              </Route>


              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;

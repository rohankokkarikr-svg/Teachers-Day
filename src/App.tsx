import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ROUTES } from './lib/constants';
import Navbar from './components/layout/Navbar';
import MobileBottomNavigation from './components/layout/MobileBottomNavigation';
import AdminSidebar from './components/layout/AdminSidebar';
import AdminHeader from './components/layout/AdminHeader';
import ToastContainer from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Eagerly loaded pages (critical path)
import HomePage from './pages/student/HomePage';
import LoginPage from './pages/student/LoginPage';

// Lazily loaded pages
const VotePage = lazy(() => import('./pages/student/VotePage'));
const CategoryVotePage = lazy(() => import('./pages/student/CategoryVotePage'));
const LiveResultsPage = lazy(() => import('./pages/student/LiveResultsPage'));
const AppreciationPage = lazy(() => import('./pages/student/AppreciationPage'));
const ProfilePage = lazy(() => import('./pages/student/ProfilePage'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminTeachers = lazy(() => import('./pages/admin/AdminTeachers'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminVotingControl = lazy(() => import('./pages/admin/AdminVotingControl'));
const AdminParticipation = lazy(() => import('./pages/admin/AdminParticipation'));
const AdminAppreciation = lazy(() => import('./pages/admin/AdminAppreciation'));
const AdminResults = lazy(() => import('./pages/admin/AdminResults'));
const AdminEventMode = lazy(() => import('./pages/admin/AdminEventMode'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

// Dedicated Presentation Event Mode
const EventModePage = lazy(() => import('./pages/EventModePage'));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60dvh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-sm text-surface-400">Loading...</p>
      </div>
    </div>
  );
}

// Student Layout — includes Navbar + Bottom Nav
function StudentLayout() {
  return (
    <ProtectedRoute>
      <Navbar />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <MobileBottomNavigation />
    </ProtectedRoute>
  );
}

// Admin Layout — includes Sidebar + Header
function AdminLayout() {
  return (
    <ProtectedRoute requireAdmin>
      <div className="flex min-h-[100dvh] bg-surface-950">
        <AdminSidebar />
        <div className="flex-1 md:ml-64 flex flex-col min-w-0">
          <AdminHeader />
          <main className="flex-1 pb-24 md:pb-8 overflow-x-hidden">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Public Layout — minimal chrome
function PublicLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer />

        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<LoginPage />} />
          </Route>

          {/* Student Routes */}
          <Route element={<StudentLayout />}>
            <Route path={ROUTES.VOTE} element={<VotePage />} />
            <Route path={ROUTES.CATEGORY_VOTE} element={<CategoryVotePage />} />
            <Route path={ROUTES.LIVE_RESULTS} element={<LiveResultsPage />} />
            <Route path={ROUTES.APPRECIATION} element={<AppreciationPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="teachers" element={<AdminTeachers />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="voting" element={<AdminVotingControl />} />
            <Route path="results" element={<LiveResultsPage />} />
            <Route path="participation" element={<AdminParticipation />} />
            <Route path="appreciation" element={<AdminAppreciation />} />
            <Route path="final-results" element={<AdminResults />} />
            <Route path="event-mode" element={<AdminEventMode />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Full Screen Event Mode */}
          <Route
            path={ROUTES.EVENT_MODE}
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<PageLoader />}>
                  <EventModePage />
                </Suspense>
              </ProtectedRoute>
            }
          />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="min-h-[100dvh] flex items-center justify-center px-4">
              <div className="text-center">
                <h1 className="font-display text-6xl font-bold text-gradient-primary mb-4">
                  404
                </h1>
                <p className="text-surface-400 mb-6">Page not found</p>
                <a href={ROUTES.HOME} className="btn-primary px-6 py-3 rounded-xl text-sm">
                  Go Home
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
    <SpeedInsights />
    </AuthProvider>
  );
}

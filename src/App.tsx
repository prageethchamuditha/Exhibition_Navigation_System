import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RealtimeAnnouncements } from './components/RealtimeAnnouncements';
import './index.css';

// Lazy load page components to improve initial loading performance
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminExhibitionsPage = lazy(() => import('./pages/admin/AdminExhibitionsPage').then(m => ({ default: m.AdminExhibitionsPage })));
const AdminStoresPage = lazy(() => import('./pages/admin/AdminStoresPage').then(m => ({ default: m.AdminStoresPage })));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage').then(m => ({ default: m.AdminCategoriesPage })));
const AdminNodesPage = lazy(() => import('./pages/admin/AdminNodesPage').then(m => ({ default: m.AdminNodesPage })));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })));
const AdminVisitorsPage = lazy(() => import('./pages/admin/AdminVisitorsPage').then(m => ({ default: m.AdminVisitorsPage })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));

const StoreDirectoryPage = lazy(() => import('./pages/StoreDirectoryPage').then(m => ({ default: m.StoreDirectoryPage })));
const StoreDetailPage = lazy(() => import('./pages/StoreDetailPage').then(m => ({ default: m.StoreDetailPage })));
const ExhibitionDirectoryPage = lazy(() => import('./pages/ExhibitionDirectoryPage').then(m => ({ default: m.ExhibitionDirectoryPage })));
const ExhibitionDetailPage = lazy(() => import('./pages/ExhibitionDetailPage').then(m => ({ default: m.ExhibitionDetailPage })));
const MapPage = lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));

// Centered loading fallback component
function PageLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div className="spinner" style={{ width: 36, height: 36, borderTopColor: 'var(--color-primary)' }} />
      <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', letterSpacing: '0.05em' }}>
        LOADING RESOURCES...
      </span>
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeAnnouncements />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/map"
              element={
                <ProtectedRoute>
                  <MapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exhibitions"
              element={
                <ProtectedRoute>
                  <ExhibitionDirectoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exhibitions/:id"
              element={
                <ProtectedRoute>
                  <ExhibitionDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores"
              element={
                <ProtectedRoute>
                  <StoreDirectoryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/stores/:id"
              element={
                <ProtectedRoute>
                  <StoreDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />


            {/* Admin routes */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <Routes>
                      <Route path="dashboard" element={<AdminDashboardPage />} />
                      <Route path="exhibitions" element={<AdminExhibitionsPage />} />
                      <Route path="stores" element={<AdminStoresPage />} />
                      <Route path="categories" element={<AdminCategoriesPage />} />
                      <Route path="nodes" element={<AdminNodesPage />} />
                      <Route path="announcements" element={<AdminAnnouncementsPage />} />
                      <Route path="visitors" element={<AdminVisitorsPage />} />
                      <Route path="analytics" element={<AdminAnalyticsPage />} />
                      <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;


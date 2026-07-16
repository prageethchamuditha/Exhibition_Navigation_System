import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { HomePage } from './pages/HomePage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminExhibitionsPage } from './pages/admin/AdminExhibitionsPage';
import { AdminStoresPage } from './pages/admin/AdminStoresPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminNodesPage } from './pages/admin/AdminNodesPage';
import { AdminAnnouncementsPage } from './pages/admin/AdminAnnouncementsPage';
import { AdminVisitorsPage } from './pages/admin/AdminVisitorsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { StoreDirectoryPage } from './pages/StoreDirectoryPage';
import { StoreDetailPage } from './pages/StoreDetailPage';
import { ExhibitionDirectoryPage } from './pages/ExhibitionDirectoryPage';
import { ExhibitionDetailPage } from './pages/ExhibitionDetailPage';
import { MapPage } from './pages/MapPage';
import { SearchPage } from './pages/SearchPage';
import { RealtimeAnnouncements } from './components/RealtimeAnnouncements';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeAnnouncements />
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;


import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from './components/AppShell';
import AuthForm from './components/AuthForm';
import SystemStatus from './components/SystemStatus';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth-context';
import MapPage from './pages/MapPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import SiteDetailPage from './pages/SiteDetailPage';

/**
 * Gate for authenticated routes.
 *
 * While a stored token is being revalidated we render a spinner rather than
 * redirecting: bouncing the user to /login on every refresh and then back again
 * would be a visible flicker on a session that was perfectly valid.
 */
function RequireAuth({ children }) {
  const { isAuthenticated, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <div className="full-page-centre">
        <Spinner label="Restoring your session" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/** Keeps signed-in users away from the auth screens. */
function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return null;
  return isAuthenticated ? <Navigate to="/projects" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <AuthForm mode="login" />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <AuthForm mode="register" />
          </RedirectIfAuthenticated>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/sites/:siteId" element={<SiteDetailPage />} />
        <Route
          path="/status"
          element={
            <>
              <div className="page-heading">
                <h1>System status</h1>
                <p>Live connectivity across the frontend, API, and database.</p>
              </div>
              <SystemStatus />
            </>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

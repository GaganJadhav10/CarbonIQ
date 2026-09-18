import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

import AppShell from './components/AppShell';
import { sites as sitesApi } from './lib/api';
import { useAuth } from './lib/auth-context';
import AuthPage from './pages/AuthPage';
import ProjectsPage from './pages/ProjectsPage';
import WorkspacePage from './pages/WorkspacePage';

/**
 * Gate for authenticated routes.
 *
 * While a stored token is being revalidated nothing is rendered: redirecting to
 * /login and straight back again would flash the sign-in screen at someone
 * whose session was perfectly valid.
 */
function RequireAuth({ children }) {
  const { isAuthenticated, isRestoring } = useAuth();

  if (isRestoring) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, isRestoring } = useAuth();

  if (isRestoring) return null;
  return isAuthenticated ? <Navigate to="/projects" replace /> : children;
}

/**
 * Deep link for a site.
 *
 * Analytics moved from a page into a drawer over the workspace map, but
 * /sites/:id URLs already exist, so this resolves the site's project and
 * forwards to the workspace with that site selected.
 */
function SiteRedirect() {
  const { siteId } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    request((options) => sitesApi.get(siteId, options))
      .then((site) => {
        if (!cancelled) {
          navigate(`/projects/${site.properties.project_id}?site=${siteId}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId, request, navigate]);

  return failed ? <Navigate to="/projects" replace /> : null;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <AuthPage mode="login" />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <AuthPage mode="register" />
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
        <Route path="/projects/:projectId" element={<WorkspacePage />} />
        <Route path="/sites/:siteId" element={<SiteRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

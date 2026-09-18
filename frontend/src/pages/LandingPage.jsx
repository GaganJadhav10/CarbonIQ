import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, FolderTree, GitBranch, PenTool, Sparkles } from 'lucide-react';

import ThemeToggle from '../components/ThemeToggle';
import { ColdStartNotice, SkeletonBlock, Spinner } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';

// Mapbox GL is ~2.4MB. Loading it lazily keeps it off the critical path so the
// hero paints immediately, and the map streams in underneath.
const MapView = lazy(() => import('../components/MapView'));

const FEATURES = [
  {
    Icon: FolderTree,
    title: 'Organise by project',
    body: 'Group monitoring sites under a project — a reforestation programme, a mangrove survey, a biodiversity baseline.',
  },
  {
    Icon: PenTool,
    title: 'Draw site boundaries',
    body: 'Trace a polygon straight onto the map. Boundaries are stored as PostGIS geometry in WGS 84, not as an approximation.',
  },
  {
    Icon: BarChart3,
    title: 'Track performance',
    body: 'Carbon sequestered, canopy cover and species counts, charted month by month for every site.',
  },
];

/**
 * Public landing page.
 *
 * Exists because the app previously opened straight onto a login form: a
 * reviewer arriving cold had no idea what CarbonIQ was, and no way in without
 * credentials. The demo button solves both without weakening authentication —
 * it provisions a real account with a real JWT, subject to the same ownership
 * checks as any other user.
 */
export default function LandingPage() {
  const { startDemo } = useAuth();
  const navigate = useNavigate();

  const [isStarting, setIsStarting] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState(null);

  async function handleDemo() {
    setIsStarting(true);
    setError(null);
    const slowTimer = setTimeout(() => setIsSlow(true), 2200);

    try {
      await startDemo();
      navigate('/projects', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not start the demo. Please try again.'
      );
    } finally {
      clearTimeout(slowTimer);
      setIsSlow(false);
      setIsStarting(false);
    }
  }

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="container container--wide landing__nav-inner">
          <span className="brand">
            <img className="brand__mark" src="/favicon.svg" alt="" />
            CarbonIQ
          </span>

          <div className="landing__nav-actions">
            <ThemeToggle />
            <Link to="/login" className="button button--ghost">
              Sign in
            </Link>
            <Link to="/register" className="button button--secondary">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container container--wide landing__hero">
          <div className="landing__hero-copy">
            <span className="pill landing__eyebrow">
              <Sparkles size={13} aria-hidden="true" />
              Geospatial monitoring
            </span>

            <h1>
              Know exactly what your land is doing, <em>site by site</em>.
            </h1>

            <p className="landing__lede">
              CarbonIQ turns carbon and biodiversity programmes into something you can see. Draw the
              boundary of every monitoring site on a map, then watch how each one performs over
              time.
            </p>

            <div className="landing__cta">
              <button
                type="button"
                className="button button--primary button--lg"
                onClick={handleDemo}
                disabled={isStarting}
              >
                {isStarting ? <Spinner /> : null}
                {isStarting ? 'Preparing your demo…' : 'View live demo'}
                {!isStarting && <ArrowRight size={17} aria-hidden="true" />}
              </button>

              <Link to="/register" className="button button--secondary button--lg">
                Create an account
              </Link>
            </div>

            <p className="landing__cta-note">
              The demo builds you a private workspace preloaded with three sample projects. Nothing
              to sign up for, and nothing you do there affects anyone else.
            </p>

            {isSlow && isStarting && (
              <div className="landing__notice">
                <ColdStartNotice />
              </div>
            )}

            {error && (
              <div className="notice notice--error landing__notice" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="landing__hero-map card card--flush">
            <Suspense fallback={<SkeletonBlock height="100%" label="Loading map" />}>
              <MapView featureCollection={null} interactive={false} showLabels={false} />
            </Suspense>
            <div className="landing__map-caption">
              <strong>Site boundaries as real geometry</strong>
              <span className="muted">Stored in PostGIS · EPSG:4326</span>
            </div>
          </div>
        </section>

        <section className="container container--wide landing__features">
          {FEATURES.map(({ Icon, title, body }) => (
            <article key={title} className="card landing__feature">
              <span className="landing__feature-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing__footer">
        <div className="container container--wide landing__footer-inner">
          <p className="muted">
            Built with React, Mapbox GL JS, Chart.js, FastAPI and PostGIS. Demo data is synthetic.
          </p>
          <a
            className="landing__footer-link"
            href="https://github.com/GaganJadhav10/CarbonIQ"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch size={15} aria-hidden="true" />
            Source
          </a>
        </div>
      </footer>
    </div>
  );
}

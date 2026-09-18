import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, MapPin, Trees, Layers, ArrowLeft } from 'lucide-react';

import MapView from '../components/MapView';
import { ErrorNotice, SkeletonList, Spinner } from '../components/ui';
import { ApiError, projects as projectsApi, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import StatTile from '../components/StatTile';

function SiteDraftForm({ geometry, projectId, onSaved, onDiscard }) {
  const { request } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give the site a name.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const site = await request((options) =>
        sitesApi.create({ project_id: projectId, name: name.trim(), boundary: geometry }, options)
      );
      setName('');
      onSaved(site);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the site.');
    } finally {
      setIsSaving(false);
    }
  }

  const ringLength = geometry.coordinates?.[0]?.length ?? 0;

  return (
    <form
      className="card"
      onSubmit={handleSubmit}
      style={{ border: '1px solid var(--color-accent)', background: 'var(--color-accent-soft)' }}
    >
      <h3 className="card__title" style={{ color: 'var(--color-accent)' }}>
        Save New Geographic Site
      </h3>
      <p className="card__subtitle" style={{ color: 'var(--color-text-muted)' }}>
        Captured polygon with {ringLength} boundary points. Name it to register it under this
        project.
      </p>

      <div className="field">
        <label htmlFor="site-name">Site Name</label>
        <input
          id="site-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. North Ridge Forest Plot"
          autoFocus
        />
      </div>

      {error && (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      )}

      <div className="button-row">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving && <Spinner />}
          {isSaving ? 'Saving…' : 'Save Site'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={onDiscard}
          disabled={isSaving}
        >
          Discard
        </button>
      </div>
    </form>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState({ kind: 'loading' });
  const [draftGeometry, setDraftGeometry] = useState(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [project, collection] = await Promise.all([
        request((options) => projectsApi.get(projectId, options)),
        request((options) => sitesApi.list(projectId, options)),
      ]);
      setState({ kind: 'ready', project, collection });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Could not load this project.',
      });
    }
  }, [projectId, request]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSiteSaved(site) {
    setDraftGeometry(null);
    setState((current) =>
      current.kind === 'ready'
        ? {
            ...current,
            project: { ...current.project, site_count: current.project.site_count + 1 },
            collection: {
              type: 'FeatureCollection',
              features: [site, ...current.collection.features],
            },
          }
        : current
    );
  }

  if (state.kind === 'loading') return <SkeletonList rows={2} />;
  if (state.kind === 'error') return <ErrorNotice message={state.message} onRetry={load} />;

  const { project, collection } = state;
  const features = collection.features || [];
  const totalArea = features.reduce((acc, f) => acc + (f.properties?.area_hectares || 0), 0);

  return (
    <>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Link
          to="/projects"
          style={{
            color: 'var(--color-text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}
        >
          <ArrowLeft size={14} /> Projects
        </Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--color-text)', fontWeight: 650 }}>{project.name}</span>
      </nav>

      <div className="page-heading">
        <div>
          <h1>{project.name}</h1>
          <p>{project.description || 'Geospatial carbon restoration monitoring project.'}</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-grid">
        <StatTile icon={MapPin} label="Registered Sites" value={project.site_count} unit="sites" />
        <StatTile
          icon={Layers}
          label="Total Area"
          value={totalArea > 0 ? totalArea.toLocaleString() : '0'}
          unit="hectares"
        />
        <StatTile
          icon={Trees}
          label="Est. Carbon Stock"
          value={totalArea > 0 ? (totalArea * 14.5).toFixed(1) : '0'}
          unit="tCO₂e"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)' }}>
        <section>
          <div className="card card--flush" style={{ marginBottom: 'var(--space-5)' }}>
            <div
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 className="card__title" style={{ fontSize: 'var(--text-base)' }}>
                  Geospatial Site Map
                </h2>
                <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  Draw a polygon using map tools to define a new site boundary.
                </p>
              </div>
            </div>
            <MapView
              featureCollection={collection}
              drawEnabled={!draftGeometry}
              onPolygonDrawn={setDraftGeometry}
              onSiteClick={(siteId) => navigate(`/sites/${siteId}`)}
              height="520px"
            />
          </div>

          {draftGeometry && (
            <SiteDraftForm
              geometry={draftGeometry}
              projectId={project.id}
              onSaved={handleSiteSaved}
              onDiscard={() => setDraftGeometry(null)}
            />
          )}
        </section>

        <aside>
          <div className="card">
            <h2 className="card__title" style={{ fontSize: 'var(--text-base)' }}>
              Project Sites ({features.length})
            </h2>
            <p className="card__subtitle" style={{ fontSize: 'var(--text-xs)' }}>
              Click any site for metric history and analytics.
            </p>

            {features.length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                No sites mapped yet. Use the polygon draw tool on the map to create the first site.
              </p>
            ) : (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {features.map((feature) => (
                  <Link
                    key={feature.id}
                    to={`/sites/${feature.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-sunken)',
                      textDecoration: 'none',
                      color: 'var(--color-text)',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 650, fontSize: 'var(--text-sm)' }}>
                        {feature.properties.name}
                      </div>
                      <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {feature.properties.area_hectares
                          ? feature.properties.area_hectares.toLocaleString()
                          : 0}{' '}
                        ha
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

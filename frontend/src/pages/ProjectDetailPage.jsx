import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import MapView from '../components/MapView';
import { ErrorNotice, SkeletonList, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';
import { ApiError, projects as projectsApi, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';

/**
 * Panel for turning a drawn polygon into a saved site.
 *
 * Naming is a separate step from drawing on purpose: asking for a name inside
 * the map interaction would mean a modal over the thing the user is looking at.
 */
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
    <form className="card draft-panel" onSubmit={handleSubmit}>
      <h3 className="card__title">Name this site</h3>
      <p className="card__subtitle">
        Polygon captured with {ringLength} points. Give it a name to save it to this project.
      </p>

      <div className="field">
        <label htmlFor="site-name">Site name</label>
        <input
          id="site-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. North Ridge Block"
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
          {isSaving ? 'Savingâ€¦' : 'Save site'}
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

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span aria-hidden="true">/</span>
        <span>{project.name}</span>
      </nav>

      <div className="page-heading">
        <h1>{project.name}</h1>
        {project.description && <p>{project.description}</p>}
        <p className="page-heading__meta">
          {project.site_count} {project.site_count === 1 ? 'site' : 'sites'} · Created{' '}
          {formatDate(project.created_at)}
        </p>
      </div>

      <div className="split-layout">
        <section className="split-layout__map">
          <div className="card card--flush">
            <div className="map-toolbar">
              <div>
                <h2 className="card__title">Sites</h2>
                <p className="card__subtitle" style={{ margin: 0 }}>
                  Use the polygon tool on the map to draw a new site boundary.
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
            <div style={{ marginTop: 'var(--space-4)' }}>
              <SiteDraftForm
                geometry={draftGeometry}
                projectId={project.id}
                onSaved={handleSiteSaved}
                onDiscard={() => setDraftGeometry(null)}
              />
            </div>
          )}
        </section>

        <aside className="split-layout__side">
          <div className="card">
            <h2 className="card__title">Site list</h2>
            <p className="card__subtitle">Select a site to see its analytics.</p>

            {collection.features.length === 0 ? (
              <p className="muted">No sites yet. Draw a polygon on the map to add the first one.</p>
            ) : (
              <ul className="site-list">
                {collection.features.map((feature) => (
                  <li key={feature.id}>
                    <Link to={`/sites/${feature.id}`}>
                      <strong>{feature.properties.name}</strong>
                      <span className="muted">
                        {feature.properties.area_hectares.toLocaleString()} ha
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

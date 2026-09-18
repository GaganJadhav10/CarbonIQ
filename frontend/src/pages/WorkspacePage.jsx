import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import MapCanvas from '../components/MapCanvas';
import SiteDrawer from '../components/SiteDrawer';
import Sparkline from '../components/Sparkline';
import { Button, EmptyState, ErrorBanner, Field, SkeletonRows } from '../components/ui';
import { ApiError, projects as projectsApi, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { formatArea, formatNumber } from '../lib/format';
import { useToast } from '../lib/toast-context';

/**
 * Project workspace — DESIGN.md §5.3.
 *
 * Three columns: project meta plus the site ledger, the map, and the analytics
 * drawer. Drawing is a mode of the map rather than a separate screen.
 *
 * The selected site lives in the query string (`?site=`), so a selection is
 * linkable and the browser back button steps through it. That is also what lets
 * the old /sites/:id links keep working.
 */
export default function WorkspacePage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { request } = useAuth();
  const toast = useToast();
  const mapRef = useRef(null);

  const selectedId = searchParams.get('site') ? Number(searchParams.get('site')) : null;

  const [state, setState] = useState({ kind: 'loading' });
  const [draft, setDraft] = useState(null);
  const [siteName, setSiteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [metrics, setMetrics] = useState({ loading: false, data: null });

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
        message: "Couldn't load this project. Check your connection and try again.",
      });
    }
  }, [projectId, request]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch the selected site's history whenever the selection changes.
  useEffect(() => {
    if (selectedId == null) {
      setMetrics({ loading: false, data: null });
      return;
    }

    let cancelled = false;
    setMetrics({ loading: true, data: null });

    request((options) => sitesApi.metrics(selectedId, options))
      .then((data) => {
        if (!cancelled) setMetrics({ loading: false, data });
      })
      .catch(() => {
        if (!cancelled) setMetrics({ loading: false, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, request]);

  function select(siteId) {
    setSearchParams(siteId == null ? {} : { site: String(siteId) }, { replace: false });
  }

  async function saveSite(event) {
    event.preventDefault();
    if (!siteName.trim()) {
      setNameError('Enter a site name');
      return;
    }

    setSaving(true);
    setNameError(null);
    try {
      const site = await request((options) =>
        sitesApi.create(
          { project_id: Number(projectId), name: siteName.trim(), boundary: draft },
          options
        )
      );

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

      setDraft(null);
      setSiteName('');
      toast.success('Site saved');
      select(site.id);
    } catch (error) {
      setNameError(error instanceof ApiError ? error.message : 'Could not save the site.');
    } finally {
      setSaving(false);
    }
  }

  function discardDraft() {
    setDraft(null);
    setSiteName('');
    setNameError(null);
    mapRef.current?.cancelDraw();
  }

  if (state.kind === 'error') {
    return (
      <section className="panel">
        <ErrorBanner message={state.message} onRetry={load} />
      </section>
    );
  }

  const project = state.kind === 'ready' ? state.project : null;
  const features = state.kind === 'ready' ? state.collection.features : [];
  const selectedSite = features.find((feature) => feature.id === selectedId) ?? null;

  return (
    <>
      <section className="panel">
        <div className="panel__head stack stack--tight">
          <Link className="btn btn--quiet" to="/projects">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Projects
          </Link>

          {state.kind === 'loading' ? (
            <div className="skeleton skeleton--text" aria-hidden="true" />
          ) : (
            <>
              <h1 className="t-panel-title">{project.name}</h1>
              {project.description && <p className="t-body muted">{project.description}</p>}
              <Button variant="primary" onClick={() => mapRef.current?.startDraw()}>
                Add site
              </Button>
            </>
          )}
        </div>

        {/* Naming happens in the panel, beside where the saved row will appear,
            rather than in a dialog over the map the user just drew on. */}
        {draft && (
          <form className="panel__head stack stack--tight" onSubmit={saveSite}>
            <Field
              id="site-name"
              label="Site name"
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              error={nameError}
              autoFocus
            />
            <div className="row">
              <Button type="submit" variant="primary" loading={saving}>
                Save site
              </Button>
              <Button type="button" variant="quiet" onClick={discardDraft}>
                Discard
              </Button>
            </div>
          </form>
        )}

        <div className="panel__scroll">
          {state.kind === 'loading' && <SkeletonRows rows={4} />}

          {state.kind === 'ready' && features.length === 0 && !draft && (
            <EmptyState
              message="This project has no sites. Draw the boundary of your first site on the map."
              action={
                <Button variant="primary" onClick={() => mapRef.current?.startDraw()}>
                  Add site
                </Button>
              }
            />
          )}

          {state.kind === 'ready' && features.length > 0 && (
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Score</th>
                  <th scope="col">Area</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
                  <tr
                    key={feature.id}
                    aria-selected={feature.id === selectedId}
                    onMouseEnter={() => mapRef.current?.highlightSite(feature.id)}
                    onMouseLeave={() => mapRef.current?.highlightSite(null)}
                  >
                    <td>
                      {/* A real link, so the ledger does everything clicking a
                          polygon does and stays keyboard reachable (§11). */}
                      <a
                        className="ledger__link"
                        href={`/projects/${projectId}?site=${feature.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          select(feature.id);
                        }}
                        onFocus={() => mapRef.current?.highlightSite(feature.id)}
                        onBlur={() => mapRef.current?.highlightSite(null)}
                      >
                        <span className="grow ledger__name">{feature.properties.name}</span>
                        <Sparkline
                          values={feature.properties.sparkline}
                          label={`Biodiversity score trend for ${feature.properties.name}`}
                        />
                      </a>
                    </td>
                    <td className="ledger__num">
                      {feature.properties.latest_score == null
                        ? '—'
                        : formatNumber(feature.properties.latest_score, 1)}
                    </td>
                    <td className="ledger__num">{formatArea(feature.properties.area_hectares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <MapCanvas
        ref={mapRef}
        collection={state.kind === 'ready' ? state.collection : null}
        selectedId={selectedId}
        onSelect={select}
        onDrawComplete={setDraft}
        // Leave room for the drawer so a fitted polygon is never hidden beneath it.
        padding={selectedSite ? { right: 560 } : {}}
      />

      {selectedSite && (
        <SiteDrawer
          site={selectedSite}
          metrics={metrics.data}
          loading={metrics.loading}
          onClose={() => select(null)}
        />
      )}
    </>
  );
}

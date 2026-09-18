import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import MapView from '../components/MapView';
import MetricsChart from '../components/MetricsChart';
import { metricLabel } from '../lib/metrics';
import { EmptyState, ErrorNotice, SkeletonList } from '../components/ui';
import { formatDate } from '../lib/format';
import { ApiError, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';

/** Latest value, and change across the whole series, for a headline figure. */
function summarise(series) {
  const points = series.points;
  if (points.length === 0) return null;

  const first = points[0].value;
  const latest = points.at(-1).value;
  const change = latest - first;
  const percent = first === 0 ? null : (change / first) * 100;

  return { latest, change, percent };
}

export default function SiteDetailPage() {
  const { siteId } = useParams();
  const { request } = useAuth();

  const [state, setState] = useState({ kind: 'loading' });
  const [activeMetric, setActiveMetric] = useState(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [site, metrics] = await Promise.all([
        request((options) => sitesApi.get(siteId, options)),
        request((options) => sitesApi.metrics(siteId, options)),
      ]);
      setState({ kind: 'ready', site, metrics });
      setActiveMetric(metrics.series[0]?.metric_name ?? null);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Could not load this site.',
      });
    }
  }, [siteId, request]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loading') return <SkeletonList rows={2} />;
  if (state.kind === 'error') return <ErrorNotice message={state.message} onRetry={load} />;

  const { site, metrics } = state;
  const properties = site.properties;
  const selected = metrics.series.find((series) => series.metric_name === activeMetric);

  const siteCollection = { type: 'FeatureCollection', features: [site] };

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/projects/${properties.project_id}`}>{properties.project_name}</Link>
        <span aria-hidden="true">/</span>
        <span>{properties.name}</span>
      </nav>

      <div className="page-heading">
        <h1>{properties.name}</h1>
        <p className="page-heading__meta">
          {properties.area_hectares.toLocaleString()} hectares · Added{' '}
          {formatDate(properties.created_at)}
        </p>
      </div>

      {/* Headline figures first: the latest value and its direction of travel
          are what a reviewer wants before they read a chart. */}
      <div className="stat-row">
        {metrics.series.map((series) => {
          const summary = summarise(series);
          if (!summary) return null;
          const isUp = summary.change >= 0;

          return (
            <button
              key={series.metric_name}
              type="button"
              className={`stat-tile${series.metric_name === activeMetric ? ' stat-tile--active' : ''}`}
              onClick={() => setActiveMetric(series.metric_name)}
              aria-pressed={series.metric_name === activeMetric}
            >
              <span className="stat-tile__label">{metricLabel(series.metric_name)}</span>
              <span className="stat-tile__value">
                {summary.latest.toLocaleString()}
                <span className="stat-tile__unit">{series.unit}</span>
              </span>
              <span className={`stat-tile__delta${isUp ? '' : ' stat-tile__delta--down'}`}>
                {isUp ? 'â–²' : 'â–¼'} {Math.abs(summary.change).toLocaleString()}
                {summary.percent !== null && ` (${Math.abs(summary.percent).toFixed(1)}%)`}
                <span className="muted"> over {series.points.length} months</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="split-layout">
        <section className="split-layout__map">
          <div className="card">
            <h2 className="card__title">
              {selected ? metricLabel(selected.metric_name) : 'Metrics'} over time
            </h2>
            <p className="card__subtitle">
              {selected
                ? `Monthly observations, ${formatDate(selected.points[0].recorded_at)} to ${formatDate(selected.points.at(-1).recorded_at)}.`
                : 'No metric history recorded for this site.'}
            </p>

            {selected ? (
              <MetricsChart series={selected} />
            ) : (
              <EmptyState
                title="No metrics yet"
                description="Run db/seed.py to populate this site with demo metric history."
              />
            )}
          </div>
        </section>

        <aside className="split-layout__side">
          <div className="card card--flush">
            <div className="map-toolbar">
              <h2 className="card__title">Boundary</h2>
            </div>
            <MapView featureCollection={siteCollection} interactive={false} height="260px" />
          </div>
        </aside>
      </div>
    </>
  );
}

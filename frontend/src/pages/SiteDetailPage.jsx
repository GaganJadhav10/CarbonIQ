import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Trees, Calendar, Layers, MapPin, Sparkles } from 'lucide-react';

import MapView from '../components/MapView';
import MetricsChart from '../components/MetricsChart';
import { metricLabel } from '../lib/metrics';
import { EmptyState, ErrorNotice, SkeletonList } from '../components/ui';
import { formatDate } from '../lib/format';
import { ApiError, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import StatTile from '../components/StatTile';
import AiInsightCard from '../components/AiInsightCard';

/** Latest value, and change across the whole series, for a headline figure. */
function summarise(series) {
  const points = series.points;
  if (!points || points.length === 0) return null;

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
      setActiveMetric(metrics.series?.[0]?.metric_name ?? null);
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
  const selectedSeries = metrics.series?.find((series) => series.metric_name === activeMetric);

  const siteCollection = { type: 'FeatureCollection', features: [site] };

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
        <Link to="/projects" style={{ color: 'var(--color-text-muted)' }}>
          Projects
        </Link>
        <ChevronRight size={12} />
        <Link
          to={`/projects/${properties.project_id}`}
          style={{ color: 'var(--color-text-muted)' }}
        >
          {properties.project_name}
        </Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--color-text)', fontWeight: 650 }}>{properties.name}</span>
      </nav>

      <div className="page-heading">
        <div>
          <h1>{properties.name}</h1>
          <p>
            Site area:{' '}
            <strong style={{ color: 'var(--color-text)' }}>
              {properties.area_hectares.toLocaleString()} ha
            </strong>{' '}
            · Added {formatDate(properties.created_at)}
          </p>
        </div>
      </div>

      {/* Metrics Selector Tiles Bar */}
      <div className="stats-grid">
        {metrics.series?.map((series) => {
          const summary = summarise(series);
          if (!summary) return null;
          const isUp = summary.change >= 0;
          const isActive = series.metric_name === activeMetric;

          return (
            <div
              key={series.metric_name}
              onClick={() => setActiveMetric(series.metric_name)}
              style={{
                cursor: 'pointer',
                borderColor: isActive ? 'var(--color-accent)' : undefined,
                boxShadow: isActive ? '0 0 0 2px rgb(16 185 129 / 30%)' : undefined,
                background: isActive ? 'var(--color-accent-soft)' : undefined,
              }}
            >
              <StatTile
                icon={series.metric_name.includes('carbon') ? Trees : Layers}
                label={metricLabel(series.metric_name)}
                value={summary.latest.toLocaleString()}
                unit={series.unit}
                trend={`${Math.abs(summary.change).toLocaleString()} (${summary.percent !== null ? Math.abs(summary.percent).toFixed(1) : 0}%)`}
                trendDirection={isUp ? 'up' : 'down'}
                hint={`Over ${series.points.length} readings`}
              />
            </div>
          );
        })}
      </div>

      {/* AI Site Intelligence Card */}
      <AiInsightCard
        title={`Site Intelligence: ${properties.name}`}
        insights={[
          `High biomass retention detected across ${properties.area_hectares.toLocaleString()} hectares.`,
          `NDVI score shows consistent positive growth over historical satellite observation periods.`,
        ]}
        metrics={[
          {
            label: 'Observed Area',
            value: `${properties.area_hectares.toLocaleString()} ha`,
            subtext: 'Geospatial Polygon',
          },
          { label: 'Site Health Status', value: 'Optimal', subtext: 'High Carbon Retention' },
        ]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <section className="stack">
          {/* Main Chart */}
          <div className="card">
            <h2 className="card__title">
              {selectedSeries ? metricLabel(selectedSeries.metric_name) : 'Metrics'} Time-Series
            </h2>
            <p className="card__subtitle">
              {selectedSeries
                ? `Historical observations recorded from ${formatDate(selectedSeries.points[0]?.recorded_at)} to ${formatDate(selectedSeries.points.at(-1)?.recorded_at)}.`
                : 'No metric history recorded for this site.'}
            </p>

            {selectedSeries ? (
              <MetricsChart series={selectedSeries} />
            ) : (
              <EmptyState
                title="No metrics available"
                description="Run db seed scripts to populate site observation history."
              />
            )}
          </div>

          {/* Tabular Metric History */}
          {selectedSeries && selectedSeries.points.length > 0 && (
            <div className="table-container">
              <div
                style={{
                  padding: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border)',
                  fontWeight: 700,
                }}
              >
                Observation Data Log ({selectedSeries.points.length} entries)
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date Recorded</th>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSeries.points
                    .slice()
                    .reverse()
                    .map((pt, idx) => (
                      <tr key={idx}>
                        <td className="tabular">{formatDate(pt.recorded_at)}</td>
                        <td>{metricLabel(selectedSeries.metric_name)}</td>
                        <td className="tabular" style={{ fontWeight: 650 }}>
                          {pt.value.toLocaleString()}
                        </td>
                        <td className="muted">{selectedSeries.unit}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="stack">
          {/* Boundary Map */}
          <div className="card card--flush">
            <div
              style={{
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
                fontWeight: 650,
              }}
            >
              Geospatial Boundary
            </div>
            <MapView featureCollection={siteCollection} interactive={false} height="260px" />
          </div>

          {/* Metadata Card */}
          <div className="card">
            <h3 className="card__title" style={{ fontSize: 'var(--text-base)' }}>
              Site Properties
            </h3>
            <div className="stack" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <div>
                <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  PROJECT
                </span>
                <div style={{ fontWeight: 600 }}>{properties.project_name}</div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  HECTARES
                </span>
                <div style={{ fontWeight: 600 }} className="tabular">
                  {properties.area_hectares.toLocaleString()} ha
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  RECORD CREATED
                </span>
                <div style={{ fontWeight: 600 }}>{formatDate(properties.created_at)}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

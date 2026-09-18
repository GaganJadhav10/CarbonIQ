import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { X } from 'lucide-react';

import { buildChartData, buildChartOptions } from '../lib/chart-theme';
import {
  formatArea,
  formatChange,
  formatCoordinates,
  formatDate,
  formatMonth,
  formatNumber,
} from '../lib/format';
import { METRIC_ORDER, metricMeta, summariseSeries } from '../lib/metrics';
import { useTheme } from '../lib/theme-context';
import { Chip, EmptyState, Segmented, SkeletonChart } from './ui';

/** Range control (§5.4). `null` means the whole history. */
const RANGES = [
  { value: 6, label: '6 months' },
  { value: 12, label: '1 year' },
  { value: 36, label: '3 years' },
  { value: null, label: 'All' },
];

function clipToRange(points, months) {
  if (months == null || points.length <= months) return points;
  return points.slice(-months);
}

/**
 * Site analytics — DESIGN.md §5.4.
 *
 * Ordered by what gets asked first: which site, which indicator, what is the
 * latest value and which way it moved, the series behind it, then what the
 * number actually means.
 */
export default function SiteDrawer({ site, metrics, loading, onClose }) {
  const { resolved } = useTheme();
  const [metricKey, setMetricKey] = useState(null);
  const [months, setMonths] = useState(12);
  const [asTable, setAsTable] = useState(false);

  const available = useMemo(() => {
    const present = new Set((metrics?.series ?? []).map((s) => s.metric_name));
    return METRIC_ORDER.filter((key) => present.has(key));
  }, [metrics]);

  // Reset to the first available metric whenever the site changes.
  useEffect(() => {
    if (available.length > 0 && !available.includes(metricKey)) setMetricKey(available[0]);
  }, [available, metricKey]);

  const series = metrics?.series?.find((s) => s.metric_name === metricKey);
  const meta = metricKey ? metricMeta(metricKey) : null;
  const points = useMemo(() => clipToRange(series?.points ?? [], months), [series, months]);
  const summary = useMemo(
    () => (metricKey ? summariseSeries(metricKey, points) : null),
    [metricKey, points]
  );

  const properties = site?.properties;

  const chart = useMemo(() => {
    if (!series || points.length === 0 || !meta) return null;
    return {
      data: buildChartData(
        points.map((p) => formatMonth(p.recorded_at)),
        points.map((p) => p.value)
      ),
      options: buildChartOptions({
        unit: meta.unit,
        lastLabel: formatNumber(points.at(-1).value, meta.decimals),
      }),
    };
    // `resolved` is not read directly here, but buildChartData and
    // buildChartOptions resolve different token values per theme, so the chart
    // must be rebuilt when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, points, meta, resolved]);

  return (
    <aside className="drawer" aria-label={`Analytics for ${properties?.name ?? 'site'}`}>
      <header className="drawer__head">
        <div>
          <div className="row row--wrap">
            <h2 className="t-panel-title">{properties?.name}</h2>
            {/* §5.4 and §12: seeded figures are labelled, never passed off as
                real measurements. */}
            <Chip variant="sample">Sample data</Chip>
          </div>
          <p className="t-small muted tabular">{formatArea(properties?.area_hectares)}</p>
          {properties?.centroid && (
            <p className="t-small muted tabular">
              {formatCoordinates(properties.centroid[0], properties.centroid[1])}
            </p>
          )}
        </div>

        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close analytics">
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="drawer__body">
        {loading && <SkeletonChart />}

        {!loading && available.length === 0 && (
          <EmptyState message="No measurements recorded for this site yet." />
        )}

        {!loading && available.length > 0 && (
          <>
            <Segmented
              label="Metric"
              value={metricKey}
              onChange={setMetricKey}
              options={available.map((key) => ({ value: key, label: metricMeta(key).label }))}
            />

            {summary && meta && (
              <div>
                <div className="indicator__value">
                  <span className="t-indicator">{formatNumber(summary.latest, meta.decimals)}</span>
                  {meta.shortUnit && <span className="indicator__unit">{meta.shortUnit}</span>}
                </div>
                {/* Direction is carried by the sign and the words, so it still
                    reads without colour perception (§11). */}
                <p className={`t-body indicator__change--${summary.direction}`}>
                  {formatChange(summary.change, meta.decimals)} since {formatDate(summary.since)}
                </p>
              </div>
            )}

            <Segmented label="Time range" value={months} onChange={setMonths} options={RANGES} />

            {asTable ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">{meta?.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points
                      .slice()
                      .reverse()
                      .map((point) => (
                        <tr key={point.recorded_at}>
                          <td>{formatDate(point.recorded_at)}</td>
                          <td className="tabular">{formatNumber(point.value, meta.decimals)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              chart && (
                <div className="chart">
                  <Line key={resolved} data={chart.data} options={chart.options} />
                </div>
              )
            )}

            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setAsTable((current) => !current)}
            >
              {asTable ? 'View as chart' : 'View as table'}
            </button>

            {/* Fixed text from a lookup, never generated (§5.4). */}
            {meta?.description && <p className="t-small muted">{meta.description}</p>}
          </>
        )}
      </div>
    </aside>
  );
}

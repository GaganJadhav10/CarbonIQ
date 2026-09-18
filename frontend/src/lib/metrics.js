/** Metric presentation metadata, shared by the chart and the summary tiles. */

/** Human-readable labels for the seeded metric keys. */
const METRIC_LABELS = {
  carbon_sequestered: 'Carbon sequestered',
  canopy_cover: 'Canopy cover',
  species_count: 'Species count',
};

/**
 * Turn a metric key into a display label.
 *
 * Unknown keys fall back to a de-underscored, sentence-cased version rather
 * than rendering a raw identifier -- the metric table is deliberately open, so
 * new metric names must degrade gracefully without a frontend change.
 */
export function metricLabel(metricName) {
  return (
    METRIC_LABELS[metricName] ??
    metricName.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())
  );
}

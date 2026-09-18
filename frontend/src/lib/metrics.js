/**
 * Metric metadata — DESIGN.md §5.4 and §10.
 *
 * Each entry carries the display label, the unit shown on the y-axis, which
 * direction counts as an improvement, and one fixed explanatory sentence. The
 * explanations are deliberately a lookup and never generated: a user deciding
 * whether a number is good needs the same definition every time.
 */

export const METRICS = {
  biodiversity_score: {
    label: 'Biodiversity score',
    unit: 'score, 0 to 100',
    shortUnit: '',
    higherIsBetter: true,
    decimals: 1,
    description:
      'Biodiversity score. A 0 to 100 index combining species richness and habitat condition. Higher is better.',
  },
  species_richness: {
    label: 'Species richness',
    unit: 'species observed',
    shortUnit: 'species',
    higherIsBetter: true,
    decimals: 0,
    description:
      'Species richness. The count of distinct species recorded in the site during the survey period. Higher is better.',
  },
  human_intrusion_index: {
    label: 'Human intrusion index',
    unit: 'index, 0 to 100',
    shortUnit: '',
    // The one metric where a falling value is an improvement (§5.4).
    higherIsBetter: false,
    decimals: 1,
    description:
      'Human intrusion index. A 0 to 100 measure of disturbance from tracks, grazing and extraction. Lower is better.',
  },
  ndvi: {
    label: 'NDVI',
    unit: 'index, -1 to 1',
    shortUnit: '',
    higherIsBetter: true,
    decimals: 2,
    description:
      'NDVI. Normalised difference vegetation index, a -1 to 1 measure of vegetation density from reflectance. Higher is better.',
  },
  carbon_stock: {
    label: 'Carbon stock',
    unit: 'tCO2e',
    shortUnit: 'tCO2e',
    higherIsBetter: true,
    decimals: 1,
    description:
      'Carbon stock. Estimated carbon held in above-ground biomass across the site, in tonnes of CO2 equivalent. Higher is better.',
  },
};

/** Order the metric switcher presents them in (§5.4). */
export const METRIC_ORDER = [
  'biodiversity_score',
  'species_richness',
  'human_intrusion_index',
  'ndvi',
  'carbon_stock',
];

/**
 * Metadata for a metric key.
 *
 * Unknown keys degrade to a de-underscored label rather than rendering a raw
 * identifier: the metrics table is deliberately open, so a new metric name must
 * not require a frontend change to be readable.
 */
export function metricMeta(key) {
  return (
    METRICS[key] ?? {
      label: key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      unit: '',
      shortUnit: '',
      higherIsBetter: true,
      decimals: 1,
      description: '',
    }
  );
}

export function metricLabel(key) {
  return metricMeta(key).label;
}

/**
 * Summarise a series: latest value, change across the range, and whether that
 * change is an improvement for this particular metric.
 */
export function summariseSeries(key, points) {
  if (!points || points.length === 0) return null;

  const meta = metricMeta(key);
  const first = points[0].value;
  const latest = points.at(-1).value;
  const change = latest - first;

  // Flat is neither better nor worse; a tiny epsilon avoids float noise
  // registering as a direction.
  const isFlat = Math.abs(change) < 1e-9;
  const direction = isFlat ? 'flat' : change > 0 === meta.higherIsBetter ? 'better' : 'worse';

  return {
    latest,
    change,
    direction,
    since: points[0].recorded_at,
    count: points.length,
  };
}

/**
 * Bridge between CSS custom properties and the two libraries that cannot read
 * them: Chart.js (draws to canvas) and Mapbox GL (styles via a JSON spec).
 *
 * Without this, every chart and map colour has to be duplicated as a hex
 * literal in JavaScript, which then cannot follow the theme -- exactly the bug
 * this replaces. Colours stay defined once, in styles/index.css.
 */

/**
 * Read a CSS custom property from :root.
 *
 * @param {string} name     Property name including the leading `--`.
 * @param {string} fallback Used during SSR or before styles have applied.
 */
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value.trim() || fallback;
}

/** Read a custom property whose value is a quoted string, e.g. a Mapbox style URL. */
export function cssVarString(name, fallback = '') {
  return cssVar(name, fallback).replace(/^['"]|['"]$/g, '');
}

/** Read a custom property that holds a number. */
export function cssVarNumber(name, fallback = 0) {
  const parsed = Number.parseFloat(cssVar(name, ''));
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** The palette Chart.js needs, resolved for whichever theme is active. */
export function readChartTokens() {
  return {
    series: [
      cssVar('--viz-1', '#0d6e66'),
      cssVar('--viz-2', '#b06d17'),
      cssVar('--viz-3', '#3b6fb0'),
    ],
    grid: cssVar('--viz-grid', 'rgba(0,0,0,0.09)'),
    axis: cssVar('--viz-axis', '#55655f'),
    fillStrong: cssVar('--viz-fill-strong', 'rgba(13,110,102,0.22)'),
    fillSoft: cssVar('--viz-fill-soft', 'rgba(13,110,102,0.02)'),
    surface: cssVar('--color-surface', '#ffffff'),
    text: cssVar('--color-text', '#0f1f1c'),
    border: cssVar('--color-border', '#dde4e2'),
    fontSans: cssVar('--font-sans', 'sans-serif'),
  };
}

/** The values Mapbox needs, resolved for whichever theme is active. */
export function readMapTokens() {
  return {
    style: cssVarString('--map-style', 'mapbox://styles/mapbox/outdoors-v12'),
    fill: cssVar('--map-polygon-fill', '#0d6e66'),
    fillOpacity: cssVarNumber('--map-polygon-fill-opacity', 0.22),
    hoverOpacity: cssVarNumber('--map-polygon-hover-opacity', 0.42),
    line: cssVar('--map-polygon-line', '#0a5751'),
    labelColor: cssVar('--map-label-color', '#0f1f1c'),
    labelHalo: cssVar('--map-label-halo', '#ffffff'),
  };
}

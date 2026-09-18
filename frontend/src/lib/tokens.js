/**
 * Bridge between CSS custom properties and the two libraries that cannot read
 * them: Chart.js (draws to a canvas) and Mapbox GL (styles via a JSON spec).
 *
 * Without this, every chart and map colour would have to be duplicated as a hex
 * literal in JavaScript and could not follow the theme. Colours stay defined
 * once, in styles/tokens.css.
 */

/** Read a custom property from :root. */
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value.trim() || fallback;
}

/** Read a custom property whose value is a quoted string, e.g. a Mapbox style URL. */
export function cssVarString(name, fallback = '') {
  return cssVar(name, fallback).replace(/^['"]|['"]$/g, '');
}

/** Palette for Chart.js, resolved for whichever theme is active. */
export function readChartTokens() {
  return {
    series: [
      cssVar('--series-1', '#0e6b78'),
      cssVar('--series-2', '#3f7d4e'),
      cssVar('--series-3', '#c98a0e'),
      cssVar('--series-4', '#5b6c8f'),
    ],
    grid: cssVar('--rule', '#dde3da'),
    axis: cssVar('--text-muted', '#55665c'),
    line: cssVar('--border', '#c7cfc4'),
    surface: cssVar('--surface', '#fbfcfa'),
    text: cssVar('--text', '#22332b'),
    font: cssVar('--font-sans', 'system-ui, sans-serif'),
  };
}

/** Values for Mapbox, resolved for whichever theme is active. */
export function readMapTokens() {
  return {
    satellite: cssVarString(
      '--map-style-satellite',
      'mapbox://styles/mapbox/satellite-streets-v12'
    ),
    flat: cssVarString('--map-style-flat', 'mapbox://styles/mapbox/light-v11'),
    accent: cssVar('--accent', '#0e6b78'),
    draft: cssVar('--draft', '#e0a526'),
    halo: cssVar('--moss-900', '#22332b'),
    surface: cssVar('--surface', '#fbfcfa'),
  };
}

/**
 * Mapbox Static Images API URL for the auth screen — DESIGN.md §5.1.
 *
 * A real satellite view of a real protected landscape with sample polygons
 * drawn over it, generated from the project's own token. The polygons are the
 * seeded Sundarbans sites, so the caption's "Sample sites" is accurate.
 */

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const STYLE = 'satellite-v9';

/** The two seeded Sundarbans sites, as GeoJSON for the overlay parameter. */
const OVERLAY = {
  type: 'FeatureCollection',
  features: [
    [88.78, 21.86, 88.88, 21.94],
    [88.8, 22.1, 88.9, 22.18],
  ].map(([west, south, east, north]) => ({
    type: 'Feature',
    properties: {
      // Static API styling is expressed as simplestyle-spec properties.
      stroke: '#ffffff',
      'stroke-width': 2,
      'stroke-opacity': 1,
      fill: '#0e6b78',
      'fill-opacity': 0.35,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  })),
};

/**
 * Build the image URL.
 *
 * Returns an empty string without a token so the <img> simply fails to load
 * rather than requesting a malformed URL.
 */
export function staticMapUrl({ width = 900, height = 1200 } = {}) {
  if (!TOKEN) return '';

  const overlay = encodeURIComponent(JSON.stringify(OVERLAY));
  // `auto` frames the overlay, so the image always contains the polygons
  // regardless of the rendered aspect ratio.
  return (
    `https://api.mapbox.com/styles/v1/mapbox/${STYLE}/static/` +
    `geojson(${overlay})/auto/${width}x${height}@2x?padding=80&access_token=${TOKEN}`
  );
}

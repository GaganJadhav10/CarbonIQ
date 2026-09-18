/**
 * Custom mapbox-gl-draw styling — DESIGN.md §7.
 *
 * The library's default orange must not ship. A polygon being drawn is a draft,
 * so it reads as one: dashed marigold line, marigold fill at 0.2, white vertex
 * handles with a moss outline. Once saved it becomes an ordinary site and is
 * rendered by the site layers instead.
 *
 * Colours are passed in rather than hardcoded so they follow the theme.
 */
export function buildDrawStyles({ draft, halo, surface }) {
  return [
    // --- Polygon being drawn, and selected polygons ---
    {
      id: 'gl-draw-polygon-fill',
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: { 'fill-color': draft, 'fill-opacity': 0.2 },
    },
    {
      id: 'gl-draw-polygon-stroke',
      type: 'line',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': draft, 'line-width': 2, 'line-dasharray': [2, 2] },
    },

    // --- The line segment following the cursor while placing corners ---
    {
      id: 'gl-draw-line',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': draft, 'line-width': 2, 'line-dasharray': [2, 2] },
    },

    // --- Vertex handles: white with a moss outline ---
    {
      id: 'gl-draw-polygon-and-line-vertex-halo-active',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 6, 'circle-color': halo },
    },
    {
      id: 'gl-draw-polygon-and-line-vertex-active',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 4.5, 'circle-color': surface },
    },

    // --- Midpoints, for dragging an edge into a new corner ---
    {
      id: 'gl-draw-polygon-midpoint',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      paint: { 'circle-radius': 3, 'circle-color': draft },
    },
  ];
}

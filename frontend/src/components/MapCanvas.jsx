import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import area from '@turf/area';

import { buildDrawStyles } from '../lib/draw-styles';
import { formatArea, formatCoordinates } from '../lib/format';
import { readMapTokens } from '../lib/tokens';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLE_STORAGE_KEY = 'carboniq.mapstyle';

// India-wide, used only until real geometry arrives and the camera fits to it.
const FALLBACK_CENTER = [78.9, 22.6];
const FALLBACK_ZOOM = 3.4;

const SOURCE = 'sites';
const FILL = 'sites-fill';
const LINE = 'sites-line';
const LABEL = 'sites-label';

const EMPTY = { type: 'FeatureCollection', features: [] };

mapboxgl.accessToken = MAPBOX_TOKEN;

function readStoredStyle() {
  try {
    const stored = localStorage.getItem(STYLE_STORAGE_KEY);
    return stored === 'flat' || stored === 'satellite' ? stored : 'satellite';
  } catch {
    return 'satellite';
  }
}

/** Bounding box covering every polygon in a collection. */
function boundsOf(collection) {
  const bounds = new mapboxgl.LngLatBounds();
  let any = false;

  for (const feature of collection?.features ?? []) {
    for (const ring of feature.geometry?.coordinates ?? []) {
      for (const position of ring) {
        bounds.extend(position);
        any = true;
      }
    }
  }
  return any ? bounds : null;
}

/**
 * Owns the Mapbox instance — DESIGN.md §6 and §7.
 *
 * Exposes `fitToSites`, `highlightSite` and `startDraw` through a ref, which is
 * what lets the ledger and the map behave as one instrument: hovering a row
 * calls `highlightSite`, and selecting a polygon calls back into the ledger.
 *
 * All colours and both base styles come from CSS custom properties, so the map
 * follows the theme without holding a palette of its own.
 */
const MapCanvas = forwardRef(function MapCanvas(
  {
    collection,
    selectedId = null,
    onSelect,
    onDrawComplete,
    padding = {},
    showStyleControl = true,
  },
  ref
) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const hoveredRef = useRef(null);
  const paddingRef = useRef(padding);
  const onSelectRef = useRef(onSelect);
  const onDrawCompleteRef = useRef(onDrawComplete);

  const [ready, setReady] = useState(false);
  const [style, setStyle] = useState(readStoredStyle);
  const [drawing, setDrawing] = useState(false);
  const [draftArea, setDraftArea] = useState(null);
  const [cursor, setCursor] = useState(null);

  useEffect(() => {
    paddingRef.current = padding;
    onSelectRef.current = onSelect;
    onDrawCompleteRef.current = onDrawComplete;
  });

  /** (Re)install source and layers. Runs on load and after every style swap. */
  const installLayers = useCallback((map) => {
    const t = readMapTokens();

    if (!map.getSource(SOURCE)) {
      // promoteId is what makes feature-state work, which drives hover and
      // selection highlighting.
      map.addSource(SOURCE, { type: 'geojson', data: EMPTY, promoteId: 'id' });
    }

    if (!map.getLayer(FILL)) {
      map.addLayer({
        id: FILL,
        type: 'fill',
        source: SOURCE,
        paint: {
          'fill-color': t.accent,
          'fill-opacity': [
            'case',
            [
              'any',
              ['boolean', ['feature-state', 'hover'], false],
              ['boolean', ['feature-state', 'selected'], false],
            ],
            0.4,
            0.22,
          ],
        },
      });
    }

    if (!map.getLayer(LINE)) {
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        paint: {
          // Selected gets a white line with a kingfisher casing (§7).
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            t.surface,
            t.accent,
          ],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 2],
        },
      });
    }

    if (!map.getLayer(LABEL)) {
      map.addLayer({
        id: LABEL,
        type: 'symbol',
        source: SOURCE,
        // §7: hide labels below zoom 9, where they would collide.
        minzoom: 9,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 0.8],
        },
        paint: {
          'text-color': t.surface,
          'text-halo-color': t.halo,
          'text-halo-width': 1.5,
        },
      });
    }
  }, []);

  const fitToSites = useCallback((data) => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = boundsOf(data);
    if (!bounds) return;

    // Panels are padding, so nothing is hidden underneath them (§7).
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.fitBounds(bounds, {
      padding: { top: 48, bottom: 48, left: 48, right: 48, ...paddingRef.current },
      maxZoom: 13,
      duration: prefersReduced ? 0 : 1600,
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fitToSites: () => fitToSites(collection),
      highlightSite(id) {
        const map = mapRef.current;
        if (!map || !map.getSource(SOURCE)) return;

        if (hoveredRef.current !== null && hoveredRef.current !== id) {
          map.setFeatureState({ source: SOURCE, id: hoveredRef.current }, { hover: false });
        }
        hoveredRef.current = id;
        if (id !== null) map.setFeatureState({ source: SOURCE, id }, { hover: true });
      },
      startDraw() {
        if (!drawRef.current) return;
        setDrawing(true);
        setDraftArea(null);
        drawRef.current.changeMode('draw_polygon');
      },
      cancelDraw() {
        drawRef.current?.deleteAll();
        drawRef.current?.changeMode('simple_select');
        setDrawing(false);
        setDraftArea(null);
      },
    }),
    [collection, fitToSites]
  );

  // --- Create the map once -------------------------------------------------
  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current) return undefined;

    const t = readMapTokens();
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: style === 'flat' ? t.flat : t.satellite,
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      styles: buildDrawStyles(t),
    });
    drawRef.current = draw;
    map.addControl(draw);

    map.on('load', () => {
      installLayers(map);
      setReady(true);
    });

    // Live hectare readout while the shape is being drawn (§5.3).
    const updateDraftArea = () => {
      const [feature] = draw.getAll().features;
      if (!feature) return setDraftArea(null);
      setDraftArea(area(feature) / 10_000);
    };
    map.on('draw.render', updateDraftArea);

    map.on('draw.create', (event) => {
      const feature = event.features?.[0];
      setDrawing(false);
      setDraftArea(null);
      draw.deleteAll();
      if (feature) onDrawCompleteRef.current?.(feature.geometry);
    });

    map.on('mousemove', (event) => setCursor(event.lngLat));
    map.on('mouseout', () => setCursor(null));

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setReady(false);
    };
    // Style changes are handled by the swap effect below, not by rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installLayers]);

  // --- Swap base style, reinstalling layers afterwards ----------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const t = readMapTokens();
    map.setStyle(style === 'flat' ? t.flat : t.satellite);
    map.once('styledata', () => installLayers(map));

    try {
      localStorage.setItem(STYLE_STORAGE_KEY, style);
    } catch {
      // Storage blocked; the choice just will not survive a reload.
    }
  }, [style, ready, installLayers]);

  // --- Selection and hover from the map ------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;

    const handleClick = (event) => {
      const feature = event.features?.[0];
      if (feature) onSelectRef.current?.(feature.properties.id);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', FILL, handleClick);
    map.on('mouseenter', FILL, handleEnter);
    map.on('mouseleave', FILL, handleLeave);

    return () => {
      map.off('click', FILL, handleClick);
      map.off('mouseenter', FILL, handleEnter);
      map.off('mouseleave', FILL, handleLeave);
    };
  }, [ready]);

  // --- Data in, camera fitted ----------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !collection) return;

    const source = map.getSource(SOURCE);
    if (!source) return;

    source.setData(collection);
    fitToSites(collection);
  }, [collection, ready, style, fitToSites]);

  // --- Selected polygon ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource(SOURCE)) return;

    for (const feature of collection?.features ?? []) {
      map.setFeatureState(
        { source: SOURCE, id: feature.id },
        { selected: feature.id === selectedId }
      );
    }
  }, [selectedId, collection, ready]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map">
        <div className="error-banner" role="alert">
          <p>
            Mapbox token missing. Set <code>VITE_MAPBOX_TOKEN</code> and rebuild.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map">
      <div ref={containerRef} className="map__canvas" aria-label="Map of project sites" />

      {showStyleControl && (
        <div className="map__float map__style-control">
          <div className="segmented" role="radiogroup" aria-label="Map style">
            <button
              type="button"
              role="radio"
              aria-checked={style === 'satellite'}
              className="segmented__option"
              onClick={() => setStyle('satellite')}
            >
              Satellite
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={style === 'flat'}
              className="segmented__option"
              onClick={() => setStyle('flat')}
            >
              Flat
            </button>
          </div>
        </div>
      )}

      {drawing && (
        <div className="map__float map__hint">
          <span>Click to place corners. Double-click to finish.</span>
          {draftArea != null && <strong className="tabular">{formatArea(draftArea)}</strong>}
        </div>
      )}

      {cursor && (
        <div className="map__float map__readout">{formatCoordinates(cursor.lng, cursor.lat)}</div>
      )}
    </div>
  );
});

export default MapCanvas;

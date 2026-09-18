import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

import { useTheme } from '../lib/theme-context';
import { readMapTokens } from '../lib/tokens';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// India-wide view, used only until real site geometry arrives and we fit to it.
const FALLBACK_CENTER = [78.9, 22.6];
const FALLBACK_ZOOM = 3.4;

const SOURCE_ID = 'carboniq-sites';
const FILL_LAYER = `${SOURCE_ID}-fill`;
const LINE_LAYER = `${SOURCE_ID}-outline`;
const LABEL_LAYER = `${SOURCE_ID}-label`;

mapboxgl.accessToken = MAPBOX_TOKEN;

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

/**
 * Bounding box covering every polygon in a FeatureCollection.
 *
 * A fold over coordinate pairs, done here rather than pulling in turf for this
 * one function.
 */
function boundsOf(featureCollection) {
  const bounds = new mapboxgl.LngLatBounds();
  let hasAny = false;

  for (const feature of featureCollection?.features ?? []) {
    for (const ring of feature.geometry?.coordinates ?? []) {
      for (const position of ring) {
        bounds.extend(position);
        hasAny = true;
      }
    }
  }

  return hasAny ? bounds : null;
}

/**
 * Mapbox GL JS map rendering site polygons, optionally with drawing enabled.
 *
 * Colours and the base style come from CSS custom properties via readMapTokens,
 * so the map follows the app's theme instead of carrying its own hardcoded
 * palette.
 *
 * @param {object}   props
 * @param {object}   props.featureCollection GeoJSON FeatureCollection of sites.
 * @param {boolean}  [props.drawEnabled]     Show the polygon drawing control.
 * @param {Function} [props.onPolygonDrawn]  Called with a GeoJSON Polygon.
 * @param {Function} [props.onSiteClick]     Called with a site id on polygon click.
 * @param {boolean}  [props.interactive]     Set false for a static thumbnail.
 * @param {boolean}  [props.showLabels]      Site name labels. Off for thumbnails.
 */
export default function MapView({
  featureCollection,
  drawEnabled = false,
  onPolygonDrawn,
  onSiteClick,
  interactive = true,
  showLabels = true,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const popupRef = useRef(null);
  const hoveredRef = useRef(null);
  const appliedStyleRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const { resolved } = useTheme();

  // Latest callbacks live in refs so changing a handler does not tear down and
  // rebuild the map -- a rebuild would throw away the user's pan and zoom.
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onSiteClickRef = useRef(onSiteClick);
  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
    onSiteClickRef.current = onSiteClick;
  });

  /** (Re)create the source and layers. Runs on load and after every style swap. */
  const installLayers = useCallback(
    (map) => {
      const tokens = readMapTokens();

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: EMPTY_COLLECTION,
          // Needed for feature-state, which drives the hover highlight.
          promoteId: 'id',
        });
      }

      if (!map.getLayer(FILL_LAYER)) {
        map.addLayer({
          id: FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': tokens.fill,
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              tokens.hoverOpacity,
              tokens.fillOpacity,
            ],
          },
        });
      }

      if (!map.getLayer(LINE_LAYER)) {
        map.addLayer({
          id: LINE_LAYER,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': tokens.line,
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 3, 2],
          },
        });
      }

      if (showLabels && !map.getLayer(LABEL_LAYER)) {
        map.addLayer({
          id: LABEL_LAYER,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-offset': [0, 0.6],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': tokens.labelColor,
            'text-halo-color': tokens.labelHalo,
            'text-halo-width': 1.5,
          },
        });
      }
    },
    [showLabels]
  );

  // --- Create the map once -------------------------------------------------
  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current) return undefined;

    const tokens = readMapTokens();
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: tokens.style,
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      interactive,
      attributionControl: true,
    });
    mapRef.current = map;

    if (interactive) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    }

    map.on('load', () => {
      installLayers(map);
      setIsReady(true);
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      popupRef.current = null;
      setIsReady(false);
    };
  }, [interactive, installLayers]);

  // --- Swap the base style when the theme changes --------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;

    const tokens = readMapTokens();
    // Compare against what we last applied rather than inspecting the live
    // style object, whose shape is Mapbox's business and not a stable contract.
    if (appliedStyleRef.current === tokens.style) return;
    appliedStyleRef.current = tokens.style;

    // setStyle discards custom sources and layers, so they are reinstalled once
    // the new style has loaded. The data effect below then refills the source.
    map.setStyle(tokens.style);
    map.once('styledata', () => installLayers(map));
  }, [resolved, isReady, installLayers]);

  // --- Hover highlight and popup -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady || !interactive) return undefined;

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'map-popup',
      offset: 8,
    });
    popupRef.current = popup;

    const clearHover = () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredRef.current }, { hover: false });
        hoveredRef.current = null;
      }
    };

    const handleMove = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      if (hoveredRef.current !== feature.id) {
        clearHover();
        hoveredRef.current = feature.id;
        map.setFeatureState({ source: SOURCE_ID, id: feature.id }, { hover: true });
      }

      map.getCanvas().style.cursor = onSiteClickRef.current ? 'pointer' : '';

      const { name, area_hectares: area } = feature.properties;

      // Built as DOM nodes, not an HTML string: site names are user input, and
      // setHTML would happily execute markup someone put in a site name.
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = name;
      const detail = document.createElement('span');
      detail.textContent = `${Number(area).toLocaleString()} ha`;
      content.append(title, document.createElement('br'), detail);

      popup.setLngLat(event.lngLat).setDOMContent(content).addTo(map);
    };

    const handleLeave = () => {
      clearHover();
      map.getCanvas().style.cursor = '';
      popup.remove();
    };

    const handleClick = (event) => {
      const feature = event.features?.[0];
      if (feature) onSiteClickRef.current?.(feature.properties.id);
    };

    map.on('mousemove', FILL_LAYER, handleMove);
    map.on('mouseleave', FILL_LAYER, handleLeave);
    map.on('click', FILL_LAYER, handleClick);

    return () => {
      map.off('mousemove', FILL_LAYER, handleMove);
      map.off('mouseleave', FILL_LAYER, handleLeave);
      map.off('click', FILL_LAYER, handleClick);
      popup.remove();
    };
  }, [isReady, interactive]);

  // --- Attach or detach the drawing control --------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return undefined;

    if (!drawEnabled) {
      if (drawRef.current) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
      return undefined;
    }

    if (drawRef.current) return undefined;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
    });
    drawRef.current = draw;
    map.addControl(draw, 'top-left');

    const handleCreate = (event) => {
      const feature = event.features?.[0];
      if (feature) onPolygonDrawnRef.current?.(feature.geometry);
      // The drawn shape is handed to the form; the saved site comes back through
      // the site source. Leaving it here would render the polygon twice.
      draw.deleteAll();
    };

    map.on('draw.create', handleCreate);
    return () => {
      map.off('draw.create', handleCreate);
    };
  }, [drawEnabled, isReady]);

  // --- Push site data into the source --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady || !featureCollection) return;

    const source = map.getSource(SOURCE_ID);
    if (!source) return;

    source.setData(featureCollection);

    const bounds = boundsOf(featureCollection);
    if (bounds) map.fitBounds(bounds, { padding: 56, maxZoom: 12, duration: 700 });
  }, [featureCollection, isReady, resolved]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`map-container map-container--error ${className}`}>
        <div className="notice notice--error">
          <p className="notice__title">Mapbox token missing</p>
          <p>
            Set <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env.local</code> locally, or in
            the Vercel project settings, then rebuild.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={`map-container ${className}`} />;
}

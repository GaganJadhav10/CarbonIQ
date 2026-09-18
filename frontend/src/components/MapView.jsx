import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// India-wide view, used only until real site geometry arrives and we fit to it.
const FALLBACK_CENTER = [78.9, 22.6];
const FALLBACK_ZOOM = 3.6;

const SOURCE_ID = 'carboniq-sites';

mapboxgl.accessToken = MAPBOX_TOKEN;

/**
 * Compute a bounding box covering every polygon in a FeatureCollection.
 *
 * Done here rather than with a turf dependency: it is a fold over coordinate
 * pairs, and the whole library would be imported for this one function.
 */
function boundsOf(featureCollection) {
  const bounds = new mapboxgl.LngLatBounds();
  let hasAny = false;

  for (const feature of featureCollection.features ?? []) {
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
 * @param {object}   props
 * @param {object}   props.featureCollection GeoJSON FeatureCollection of sites.
 * @param {boolean}  [props.drawEnabled]     Show the polygon drawing control.
 * @param {Function} [props.onPolygonDrawn]  Called with a GeoJSON Polygon.
 * @param {Function} [props.onSiteClick]     Called with a site id on polygon click.
 * @param {boolean}  [props.interactive]     Set false for a static thumbnail.
 */
export default function MapView({
  featureCollection,
  drawEnabled = false,
  onPolygonDrawn,
  onSiteClick,
  interactive = true,
  height = '100%',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Keep the latest callbacks in refs so that changing a handler does not tear
  // down and rebuild the map -- rebuilding would lose the user's pan and zoom.
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onSiteClickRef = useRef(onSiteClick);
  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
    onSiteClickRef.current = onSiteClick;
  });

  const fitToData = useCallback((map, data) => {
    const bounds = boundsOf(data);
    if (bounds) map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 600 });
  }, []);

  // --- Create the map once -------------------------------------------------
  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current) return undefined;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      interactive,
    });
    mapRef.current = map;

    if (interactive) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    }

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: `${SOURCE_ID}-fill`,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#0f766e', 'fill-opacity': 0.25 },
      });

      map.addLayer({
        id: `${SOURCE_ID}-outline`,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#0f766e', 'line-width': 2 },
      });

      map.addLayer({
        id: `${SOURCE_ID}-label`,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 0.5],
        },
        paint: {
          'text-color': '#123',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5,
        },
      });

      if (onSiteClickRef.current) {
        map.on('click', `${SOURCE_ID}-fill`, (event) => {
          const feature = event.features?.[0];
          if (feature) onSiteClickRef.current(feature.properties.id);
        });
        map.on('mouseenter', `${SOURCE_ID}-fill`, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', `${SOURCE_ID}-fill`, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      setIsReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setIsReady(false);
    };
  }, [interactive]);

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
      // Clear immediately: the drawn shape is handed to the form, and the saved
      // site comes back through the site source. Leaving it would double-draw.
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
    fitToData(map, featureCollection);
  }, [featureCollection, isReady, fitToData]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-container map-container--error" style={{ height }}>
        <div className="notice notice--error">
          <p className="notice__title">Mapbox token missing</p>
          <p>
            Set <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env.local</code> (locally) or in
            the Vercel project settings, then rebuild.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="map-container" style={{ height }} />;
}

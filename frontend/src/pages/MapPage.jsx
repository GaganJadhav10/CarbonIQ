import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, Layers, MapPin, Trees } from 'lucide-react';

import MapView from '../components/MapView';
import { ColdStartNotice, EmptyState, ErrorNotice } from '../components/ui';
import { ApiError, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import StatTile from '../components/StatTile';

/** Every site the user owns, across all projects, on one map. */
export default function MapPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ kind: 'loading' });
  const [isSlow, setIsSlow] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    setIsSlow(false);
    try {
      const collection = await request((options) => sitesApi.list(null, options), {
        onSlow: () => setIsSlow(true),
      });
      setState({ kind: 'ready', collection });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Could not load sites.',
      });
    } finally {
      setIsSlow(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const features = state.kind === 'ready' ? state.collection.features || [] : [];
  const totalArea = features.reduce((acc, f) => acc + (f.properties?.area_hectares || 0), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Geospatial Map Intelligence</h1>
          <p>
            Interactive map visualizing registered site boundaries, canopy coverage, and project
            zones.
          </p>
        </div>
      </div>

      {state.kind === 'ready' && (
        <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
          <StatTile icon={MapPin} label="Total Sites Mapped" value={features.length} unit="sites" />
          <StatTile
            icon={Layers}
            label="Total Coverage"
            value={totalArea.toLocaleString()}
            unit="hectares"
          />
          <StatTile
            icon={Trees}
            label="Est. Carbon Storage"
            value={(totalArea * 14.5).toFixed(1)}
            unit="tCO₂e"
          />
        </div>
      )}

      {isSlow && state.kind === 'loading' && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ColdStartNotice />
        </div>
      )}

      {state.kind === 'error' && <ErrorNotice message={state.message} onRetry={load} />}

      {state.kind === 'ready' && features.length === 0 && (
        <EmptyState
          title="No mapped sites found"
          description="Open a project and draw a site boundary on its map to view it here."
        />
      )}

      {state.kind !== 'error' && (
        <div className="card card--flush" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <MapView
            featureCollection={state.kind === 'ready' ? state.collection : null}
            onSiteClick={(siteId) => navigate(`/sites/${siteId}`)}
            height="640px"
          />
        </div>
      )}
    </>
  );
}

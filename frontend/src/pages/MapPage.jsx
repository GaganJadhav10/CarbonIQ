import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MapView from '../components/MapView';
import { ColdStartNotice, EmptyState, ErrorNotice } from '../components/ui';
import { ApiError, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';

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

  return (
    <>
      <div className="page-heading">
        <h1>Map</h1>
        <p>
          Every site across all of your projects. Click a polygon to open that site&apos;s
          analytics.
        </p>
      </div>

      {isSlow && state.kind === 'loading' && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ColdStartNotice />
        </div>
      )}

      {state.kind === 'error' && <ErrorNotice message={state.message} onRetry={load} />}

      {state.kind === 'ready' && state.collection.features.length === 0 && (
        <EmptyState
          title="No sites to show"
          description="Open a project and draw a site boundary on its map to see it here."
        />
      )}

      {state.kind !== 'error' && (
        <div className="card card--flush">
          <MapView
            featureCollection={state.kind === 'ready' ? state.collection : null}
            onSiteClick={(siteId) => navigate(`/sites/${siteId}`)}
            height="620px"
          />
        </div>
      )}
    </>
  );
}

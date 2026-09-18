import { useCallback, useEffect, useState } from 'react';

import { API_BASE_URL, ApiError, health } from '../lib/api';
import StatusBadge from './StatusBadge';

/**
 * Live status of the three deployed services.
 *
 * This is the Phase 0 end-to-end proof: rendering it successfully means the
 * browser reached Vercel, Vercel's bundle reached the Render API across origins,
 * and the API reached Supabase with PostGIS installed.
 */
export default function SystemStatus() {
  const [state, setState] = useState({ kind: 'loading' });
  const [isColdStart, setIsColdStart] = useState(false);

  const check = useCallback(async (signal) => {
    setState({ kind: 'loading' });
    setIsColdStart(false);

    try {
      const result = await health.get({ signal, onSlow: () => setIsColdStart(true) });
      setState({ kind: 'ok', health: result });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Unexpected error.',
      });
    } finally {
      setIsColdStart(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    check(controller.signal);
    return () => controller.abort();
  }, [check]);

  const status = state.kind === 'ok' ? 'ok' : state.kind === 'error' ? 'error' : 'pending';

  return (
    <section className="card" aria-labelledby="system-status-title">
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <h2 className="card__title" id="system-status-title">
            System status
          </h2>
          <p className="card__subtitle">
            Frontend, API, and database connectivity, checked end to end.
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      <div aria-live="polite">
        {state.kind === 'loading' && (
          <>
            <div className="stack" aria-hidden="true">
              <div className="skeleton" style={{ width: '60%' }} />
              <div className="skeleton" style={{ width: '45%' }} />
              <div className="skeleton" style={{ width: '70%' }} />
            </div>
            <p className="visually-hidden">Checking system status.</p>
            {isColdStart && (
              <div className="notice notice--info" style={{ marginTop: 'var(--space-4)' }}>
                <p className="notice__title">Waking up the API</p>
                <p>
                  The API is hosted on Render&apos;s free tier, which sleeps after inactivity. The
                  first request can take up to a minute.
                </p>
              </div>
            )}
          </>
        )}

        {state.kind === 'ok' && (
          <dl className="detail-grid">
            <dt>API endpoint</dt>
            <dd>{API_BASE_URL}</dd>

            <dt>Environment</dt>
            <dd>{state.health.environment}</dd>

            <dt>Database</dt>
            <dd>{state.health.database}</dd>

            <dt>PostGIS</dt>
            <dd>{state.health.postgis_version}</dd>
          </dl>
        )}

        {state.kind === 'error' && (
          <>
            <div className="notice notice--error">
              <p className="notice__title">Could not reach the API</p>
              <p>{state.message}</p>
            </div>
            <dl className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
              <dt>Attempted endpoint</dt>
              <dd>{API_BASE_URL}/api/health</dd>
            </dl>
          </>
        )}
      </div>

      <footer style={{ marginTop: 'var(--space-5)' }}>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => check()}
          disabled={state.kind === 'loading'}
        >
          {state.kind === 'loading' ? 'Checking…' : 'Re-run check'}
        </button>
      </footer>
    </section>
  );
}

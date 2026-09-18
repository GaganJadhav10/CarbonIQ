import { useCallback, useEffect, useState } from 'react';
import { Server, Database, Globe, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

import { API_BASE_URL, ApiError, health } from '../lib/api';
import StatusBadge from './StatusBadge';

export default function SystemStatus() {
  const [state, setState] = useState({ kind: 'loading' });
  const [setIsColdStart] = useState(false);
  const [latency, setLatency] = useState(null);

  const check = useCallback(async (signal) => {
    setState({ kind: 'loading' });
    setIsColdStart(false);
    const start = performance.now();

    try {
      const result = await health.get({ signal, onSlow: () => setIsColdStart(true) });
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);
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
    <section className="stack">
      <div className="stats-grid">
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Globe size={20} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 650 }}>
              FRONTEND CLIENT
            </div>
            <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>Operational</div>
          </div>
        </div>

        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={20} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 650 }}>
              FASTAPI BACKEND
            </div>
            <div
              style={{
                fontWeight: 700,
                color: state.kind === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {state.kind === 'ok'
                ? 'Operational'
                : state.kind === 'error'
                  ? 'Offline'
                  : 'Checking...'}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Database size={20} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 650 }}>
              DATABASE & POSTGIS
            </div>
            <div
              style={{
                fontWeight: 700,
                color: state.kind === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {state.kind === 'ok' ? state.health.database : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div>
            <h2 className="card__title">Service Health & Latency Monitor</h2>
            <p className="card__subtitle" style={{ margin: 0 }}>
              Live ping check across API origin and PostgreSQL PostGIS geospatial extension.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <StatusBadge status={status} />
            <button
              type="button"
              className="button button--secondary"
              onClick={() => check()}
              disabled={state.kind === 'loading'}
            >
              <RefreshCw size={14} className={state.kind === 'loading' ? 'animate-spin' : ''} />
              <span>{state.kind === 'loading' ? 'Testing...' : 'Re-test Health'}</span>
            </button>
          </div>
        </header>

        {state.kind === 'ok' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Configured Target</th>
                  <th>Status</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>API Base Endpoint</strong>
                  </td>
                  <td className="tabular muted">{API_BASE_URL}</td>
                  <td>
                    <span className="pill">Online</span>
                  </td>
                  <td className="tabular">{latency ? `${latency} ms` : '—'}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Environment Mode</strong>
                  </td>
                  <td className="tabular muted">{state.health.environment}</td>
                  <td>
                    <span className="pill">Active</span>
                  </td>
                  <td className="tabular">—</td>
                </tr>
                <tr>
                  <td>
                    <strong>Database Status</strong>
                  </td>
                  <td className="tabular muted">Supabase PostgreSQL</td>
                  <td>
                    <span className="pill">{state.health.database}</span>
                  </td>
                  <td className="tabular">—</td>
                </tr>
                <tr>
                  <td>
                    <strong>Spatial Engine</strong>
                  </td>
                  <td className="tabular muted">{state.health.postgis_version}</td>
                  <td>
                    <span className="pill pill--lime">PostGIS Ready</span>
                  </td>
                  <td className="tabular">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="notice notice--error" role="alert">
            <p className="notice__title">API Connectivity Issue</p>
            <p>{state.message}</p>
          </div>
        )}
      </div>
    </section>
  );
}

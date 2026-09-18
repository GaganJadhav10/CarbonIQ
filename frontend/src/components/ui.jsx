/** Small presentational primitives shared across pages. */

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="spinner" role="status" aria-label={label}>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function ErrorNotice({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="notice notice--error" role="alert">
      <p className="notice__title">{title}</p>
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          className="button button--secondary"
          style={{ marginTop: 'var(--space-3)' }}
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ColdStartNotice() {
  return (
    <div className="notice notice--info">
      <p className="notice__title">Waking up the API</p>
      <p>
        The API runs on Render&apos;s free tier, which sleeps after inactivity. The first request
        can take up to a minute.
      </p>
    </div>
  );
}

export function SkeletonList({ rows = 3 }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="card">
          <div className="skeleton" style={{ width: '45%', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

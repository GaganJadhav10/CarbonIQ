import { useEffect, useRef } from 'react';
import { AlertCircle, RotateCw, X } from 'lucide-react';

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
      <p className="notice__title">
        <AlertCircle size={16} aria-hidden="true" /> {title}
      </p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button button--secondary mt-3" onClick={onRetry}>
          <RotateCw size={15} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      )}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
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
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
        </div>
      ))}
    </div>
  );
}

/**
 * Placeholder sized to the map or chart it stands in for, to avoid layout shift.
 *
 * The height arrives as a CSS custom property rather than an inline `height`:
 * it parameterises the class instead of overriding it, so the styling stays in
 * the stylesheet where the rest of the design system lives.
 */
export function SkeletonBlock({ height = '320px', label = 'Loading' }) {
  return (
    <div
      className="skeleton skeleton--block"
      style={{ '--skeleton-height': height }}
      role="status"
      aria-label={label}
    >
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

/**
 * Accessible modal dialog.
 *
 * Uses the native <dialog> element so focus trapping, Escape-to-close, inertness
 * of the page behind it, and top-layer stacking all come from the platform
 * rather than being reimplemented (and half-implemented) in JavaScript.
 */
export function Modal({ open, onClose, title, description, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // `cancel` fires on Escape. Routing it through onClose keeps React state and
  // the dialog's own open state from drifting apart.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="modal-title"
      onClick={(event) => {
        // The backdrop is the dialog element itself, so a click whose target is
        // the dialog rather than its panel is by definition outside the panel.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal__panel">
        <header className="modal__header">
          <div>
            <h2 className="card__title" id="modal-title">
              {title}
            </h2>
            {description && <p className="card__subtitle modal__description">{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

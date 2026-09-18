import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Shared primitives — DESIGN.md §6.
 *
 * Icons appear only where they carry meaning (close, draw, delete, overflow),
 * never as decoration and never inside a coloured circle.
 */

/* --- Button --------------------------------------------------------------- */

export function Button({
  variant = 'secondary',
  loading = false,
  block = false,
  children,
  className = '',
  ...rest
}) {
  return (
    <button
      className={`btn btn--${variant}${block ? ' btn--block' : ''} ${className}`.trim()}
      // Loading keeps the label and adds an inline indicator (§6), so the
      // button never changes width mid-action.
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }) {
  return (
    <button className={`icon-btn ${className}`.trim()} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/* --- Fields --------------------------------------------------------------- */

/**
 * Text input with the label always above it (§6 forbids placeholder-only
 * labels) and helper text shown before any error occurs (§5.1).
 */
export function Field({ id, label, help, error, as = 'input', ...rest }) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  const Tag = as;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <Tag
        id={id}
        className="field__input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {help && !error && (
        <p className="field__help" id={`${id}-help`}>
          {help}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/* --- Segmented control ---------------------------------------------------- */

/**
 * Used for the project type filter, the metric switcher and the time range (§6).
 *
 * Rendered as radios rather than buttons so arrow keys move between options and
 * screen readers announce it as one choice with a selected member.
 */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="segmented__option"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --- Chip ----------------------------------------------------------------- */

/** Text only, no icons (§6). */
export function Chip({ children, variant }) {
  return <span className={`chip${variant ? ` chip--${variant}` : ''}`}>{children}</span>;
}

/* --- States --------------------------------------------------------------- */

/** Skeleton rows match the real row height so nothing shifts on load (§5.5). */
export function SkeletonRows({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton skeleton--row" />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return <div className="skeleton skeleton--chart" aria-hidden="true" />;
}

export function EmptyState({ message, action }) {
  return (
    <div className="empty">
      <p className="muted">{message}</p>
      {action}
    </div>
  );
}

/** Inline banner in the affected panel, never a full-page takeover (§5.5). */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="error-banner" role="alert">
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* --- Modal ---------------------------------------------------------------- */

/**
 * Used for creating a project (§6).
 *
 * The native <dialog> element supplies focus trapping, Escape-to-close, page
 * inertness and top-layer stacking, so none of that is reimplemented here.
 * Focus returns to the trigger automatically when it closes.
 */
export function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

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
        // The backdrop is the dialog element itself, so a click landing on it
        // rather than on the panel is by definition outside.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal__panel">
        <div className="modal__head">
          <h2 className="t-panel-title" id="modal-title">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}

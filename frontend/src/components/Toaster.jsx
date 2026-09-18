import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { ToastContext } from '../lib/toast-context';

/** §6: bottom left, 4 seconds. */
const DISMISS_AFTER_MS = 4000;

/**
 * Transient confirmations.
 *
 * §6 and §10: the toast uses the same verb as the action that caused it, so
 * "Save site" is confirmed by "Site saved".
 */
export default function Toaster({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, message) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, variant, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS)
      );
    },
    [dismiss]
  );

  // Clear outstanding timers on unmount so none can fire into a dead tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Announced politely, so a confirmation never steals focus from whatever
          the user is doing next. */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast${toast.variant === 'error' ? ' toast--error' : ''}`}
          >
            <span className="grow">{toast.message}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

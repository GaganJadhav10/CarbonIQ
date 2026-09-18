import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

import { ToastContext } from '../lib/toast-context';

const DISMISS_AFTER_MS = 4500;

const VARIANTS = {
  success: { Icon: CheckCircle2, className: 'toast toast--success' },
  error: { Icon: XCircle, className: 'toast toast--error' },
};

/**
 * Transient status messages.
 *
 * Until now the app only ever reported failures, and inline at that -- creating
 * a project or saving a site gave no confirmation beyond the list changing.
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

  // Clear outstanding timers on unmount so they cannot fire into a dead tree.
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

      {/* role="status" + aria-live announces messages to screen readers without
          stealing focus from whatever the user is doing. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const { Icon, className } = VARIANTS[toast.variant] ?? VARIANTS.success;
          return (
            <div key={toast.id} className={className}>
              <Icon size={18} aria-hidden="true" />
              <span>{toast.message}</span>
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

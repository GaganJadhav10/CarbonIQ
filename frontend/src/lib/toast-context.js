import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/**
 * Returns `{ success, error }`, each taking a message string.
 *
 * Safe to call outside a provider: it degrades to no-ops rather than throwing,
 * so a missing provider can never take a page down over a status message.
 */
export function useToast() {
  return useContext(ToastContext) ?? { success: () => {}, error: () => {} };
}

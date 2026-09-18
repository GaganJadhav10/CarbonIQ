import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, auth as authApi } from './api';
import { AuthContext } from './auth-context';

/**
 * Authentication state, backed by sessionStorage.
 *
 * sessionStorage rather than localStorage is a deliberate trade-off: the token
 * is still readable by any script on the page (so it is not XSS-proof), but its
 * lifetime is bounded by the tab, so an abandoned session on a shared machine
 * does not survive. A httpOnly cookie would be stronger still, but with the API
 * on a different origin that means third-party cookies and CSRF handling --
 * disproportionate for this application's threat model. See the README.
 */

const STORAGE_KEY = 'carboniq.session';

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Private mode, or a corrupt value. Treat as signed out rather than crashing.
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the session still works for this page view.
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [isRestoring, setIsRestoring] = useState(() => readStoredSession() !== null);

  const signOut = useCallback(() => {
    setSession(null);
    writeStoredSession(null);
  }, []);

  const applySession = useCallback((payload) => {
    const next = { token: payload.access_token, user: payload.user };
    setSession(next);
    writeStoredSession(next);
    return next;
  }, []);

  // A stored token may have expired while the tab was closed. Validate it once
  // on mount so the app never renders a signed-in shell around a dead session.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setIsRestoring(false);
      return;
    }

    const controller = new AbortController();
    authApi
      .me({ token: stored.token, signal: controller.signal })
      .then((user) => setSession({ token: stored.token, user }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        // Only a rejected token means signed out. A network failure or cold
        // start must not throw the user out of a perfectly valid session.
        if (error instanceof ApiError && error.status === 401) signOut();
      })
      .finally(() => setIsRestoring(false));

    return () => controller.abort();
  }, [signOut]);

  const signIn = useCallback(
    async (email, password) => applySession(await authApi.login(email, password)),
    [applySession]
  );

  const signUp = useCallback(
    async (email, password) => applySession(await authApi.register(email, password)),
    [applySession]
  );

  /** Provision and sign into a guest account preloaded with demo data. */
  const startDemo = useCallback(async () => applySession(await authApi.demo()), [applySession]);

  /**
   * Call an endpoint with the current token, signing out on a 401.
   *
   * Centralising this means no component has to remember to handle an expired
   * token, and an expiry mid-session degrades to the login screen rather than
   * to a wall of failed requests.
   */
  const request = useCallback(
    async (endpoint, options = {}) => {
      try {
        return await endpoint({ ...options, token: session?.token });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) signOut();
        throw error;
      }
    },
    [session, signOut]
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      isRestoring,
      isGuest: Boolean(session?.user?.email?.endsWith('@carboniq.demo')),
      signIn,
      signUp,
      signOut,
      startDemo,
      request,
    }),
    [session, isRestoring, signIn, signUp, signOut, startDemo, request]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

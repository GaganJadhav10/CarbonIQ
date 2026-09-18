import { useCallback, useEffect, useMemo, useState } from 'react';

import { ThemeContext } from './theme-context';

const STORAGE_KEY = 'carboniq.theme';

/** 'system' follows the OS; 'light' and 'dark' are explicit overrides. */
const VALID_PREFERENCES = new Set(['system', 'light', 'dark']);

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_PREFERENCES.has(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * Theme preference, persisted across visits.
 *
 * The DOM is the single source of truth for which theme is *applied*: setting
 * `data-theme` on <html> is what CSS responds to, and the inline script in
 * index.html applies the stored value before first paint so there is no flash
 * of the wrong theme while React boots.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [systemIsDark, setSystemIsDark] = useState(systemPrefersDark);

  // Track the OS setting so 'system' stays live rather than being read once.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemIsDark(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const resolved = preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const root = document.documentElement;

    if (preference === 'system') {
      // Removing the attribute hands control back to the CSS media query,
      // rather than pinning a value that would then go stale.
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }

    // Lets form controls, scrollbars and the like match the theme.
    root.style.colorScheme = resolved;

    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage blocked; the choice simply will not survive a reload.
    }
  }, [preference, resolved]);

  const cycle = useCallback(() => {
    setPreference((current) =>
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'
    );
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

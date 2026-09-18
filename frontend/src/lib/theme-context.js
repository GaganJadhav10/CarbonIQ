import { createContext, useContext } from 'react';

/**
 * Theme context and hook, kept apart from the provider component so that the
 * provider file exports only a component and Fast Refresh keeps working.
 */
export const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error('useTheme must be used inside a ThemeProvider.');
  return context;
}

import { createContext, useContext } from 'react';

/**
 * Auth context and its hook, kept separate from AuthProvider so that the
 * provider file exports only a component and React Fast Refresh keeps working.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}

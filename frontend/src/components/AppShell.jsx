import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../lib/auth-context';
import ThemeToggle from './ThemeToggle';
import { Button, Chip } from './ui';

/**
 * App shell — DESIGN.md §4.
 *
 * 56 px header: product name as text (no logo graphic), a single nav item, and
 * the signed-in user with a quiet sign-out. No breadcrumb bar; the project name
 * appears in the workspace panel instead. Below the header the map fills all
 * remaining space, so `app__body` never scrolls.
 */
export default function AppShell() {
  const { user, signOut, isGuest } = useAuth();

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="app__header">
        <NavLink to="/projects" className="app__name">
          CarbonIQ
        </NavLink>

        <nav className="app__nav" aria-label="Primary">
          <NavLink
            to="/projects"
            className={({ isActive }) => `app__nav-link${isActive ? ' is-active' : ''}`}
          >
            Projects
          </NavLink>
        </nav>

        <div className="app__account">
          {isGuest && <Chip variant="sample">Sample workspace</Chip>}
          <span className="app__email muted">{user?.email}</span>
          <ThemeToggle />
          <Button variant="quiet" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="app__body" id="main">
        <Outlet />
      </div>
    </div>
  );
}

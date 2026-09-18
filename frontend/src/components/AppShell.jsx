import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  FolderTree,
  LogOut,
  Map,
  Menu,
  X,
  Search,
  Leaf,
  Sparkles,
  User,
} from 'lucide-react';

import { useAuth } from '../lib/auth-context';
import ThemeToggle from './ThemeToggle';

const NAV_ITEMS = [
  { to: '/projects', label: 'Projects Overview', Icon: FolderTree },
  { to: '/map', label: 'Geospatial Map', Icon: Map },
  { to: '/status', label: 'System Status', Icon: Activity },
];

/** Header, sidebar navigation, and page frame for every signed-in route. */
export default function AppShell() {
  const { user, signOut, isGuest } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`app-sidebar${isNavOpen ? ' is-open' : ''}`}>
        <NavLink to="/projects" className="app-sidebar__brand">
          <div className="app-sidebar__brand-logo">
            <Leaf size={18} />
          </div>
          <span>CarbonIQ</span>
        </NavLink>

        <nav className="app-sidebar__nav" aria-label="Primary navigation">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsNavOpen(false)}
              className={({ isActive }) => `app-sidebar__link${isActive ? ' is-active' : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <div
            className="ai-card__badge"
            style={{ margin: 0, width: '100%', justifyContent: 'center' }}
          >
            <Sparkles size={12} />
            <span>AI Satellite Sync Active</span>
          </div>
        </div>

        <div className="app-sidebar__footer">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--color-accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
              }}
            >
              <User size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email}
              </span>
              {isGuest && (
                <span
                  className="pill pill--lime"
                  style={{ fontSize: '10px', padding: '0 6px', width: 'fit-content' }}
                >
                  Demo Mode
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="icon-button"
              style={{ display: 'none' }} // Mobile toggle handled cleanly via responsive CSS or header
              onClick={() => setIsNavOpen((open) => !open)}
              aria-label="Toggle Navigation"
            >
              {isNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="app-topbar__search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search projects or sites..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  height: 'auto',
                  boxShadow: 'none',
                }}
              />
            </div>
          </div>

          <div className="app-topbar__actions">
            {isGuest && (
              <span className="pill" title="A temporary demo workspace">
                Demo Account
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="container container--wide" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

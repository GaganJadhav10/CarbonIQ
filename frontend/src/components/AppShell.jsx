import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../lib/auth-context';

const NAV_ITEMS = [
  { to: '/projects', label: 'Projects' },
  { to: '/map', label: 'Map' },
  { to: '/status', label: 'Status' },
];

/** Header, primary navigation, and page frame for every signed-in route. */
export default function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <NavLink to="/projects" className="brand">
            <img className="brand__mark" src="/favicon.svg" alt="" />
            CarbonIQ
          </NavLink>

          <nav className="main-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `main-nav__link${isActive ? ' is-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__account">
            <span className="muted site-header__email">{user?.email}</span>
            <button type="button" className="button button--secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p className="muted">
            CarbonIQ · Geospatial project &amp; site analytics · Demo data is synthetic.
          </p>
        </div>
      </footer>
    </div>
  );
}

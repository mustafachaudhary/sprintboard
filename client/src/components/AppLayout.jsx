import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { ProjectsProvider } from '../context/ProjectsContext';
import { initials } from '../utils/format';

/**
 * AppLayout is the shell for every private page — a sidebar and a top bar:
 * sidebar (wordmark + nav) and top bar (object name left, the
 * account switcher at the right end behind a full-height divider).
 *
 * The top bar deliberately carries no actions: each screen owns its
 * one primary action, so there is never a second competing primary.
 */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  // Human-readable name for the current route, used in the top bar.
  const pageTitle = location.pathname.startsWith('/projects')
    ? 'Projects'
    : location.pathname.startsWith('/tasks')
      ? 'All Tasks'
      : 'Overview';

  return (
    <ProjectsProvider>
      <div className="shell">
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

        <div className="main">
          <header className="topbar">
            <button
              type="button"
              className="icon-btn topbar__menu-btn"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <Menu size={18} />
            </button>

            <nav className="topbar__crumb" aria-label="Breadcrumb">
              <span className="topbar__root">SprintBoard</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span className="topbar__title">{pageTitle}</span>
            </nav>

            <div className="topbar__switcher">
              <span className="avatar">{initials(user?.name)}</span>
              <span className="topbar__switcher-name">{user?.name}</span>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Account menu"
                  aria-expanded={switcherOpen}
                  onClick={() => setSwitcherOpen((v) => !v)}
                >
                  <ChevronDown size={15} />
                </button>
                {switcherOpen && (
                  <div className="menu" role="menu" style={{ minWidth: 200 }}>
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
                    </div>
                    <button
                      type="button"
                      className="menu__item menu__item--danger"
                      role="menuitem"
                      onClick={() => {
                        setSwitcherOpen(false);
                        logout();
                      }}
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
    </ProjectsProvider>
  );
}

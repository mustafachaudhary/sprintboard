import { Link, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, ListTodo, Plus } from 'lucide-react';
import { useProjects } from '../context/ProjectsContext';
import Logo from './Logo';

/**
 * Sidebar: the wordmark, primary navigation and the user's projects.
 * The account switcher lives in the top bar (see AppLayout). On screens
 * under 900px it slides in over a backdrop (controlled by AppLayout).
 */
export default function Sidebar({ open, onNavigate }) {
  const { projects, loading } = useProjects();
  const location = useLocation();
  const isProjectActive = (id) => location.pathname === `/projects/${id}`;

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <Link to="/" className="sidebar__brand" onClick={onNavigate}>
        <Logo />
        <span className="sidebar__name">SprintBoard</span>
      </Link>

      <nav className="sidebar__section" aria-label="Primary">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`} onClick={onNavigate}>
          <LayoutDashboard size={17} />
          Dashboard
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`} onClick={onNavigate}>
          <FolderKanban size={17} />
          Projects
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`} onClick={onNavigate}>
          <ListTodo size={17} />
          All Tasks
        </NavLink>
      </nav>

      <div className="sidebar__section" style={{ overflowY: 'auto', flex: 1 }}>
        <div className="sidebar__label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Projects
          <Link
            to="/projects"
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            aria-label="Manage projects"
            title="Manage projects"
            onClick={onNavigate}
          >
            <Plus size={14} />
          </Link>
        </div>
        {loading ? (
          <div style={{ padding: '6px 10px', fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className={`sidebar__project${isProjectActive(project.id) ? ' sidebar__project--active' : ''}`}
              onClick={onNavigate}
              title={project.name}
            >
              <span className="sidebar__project-color" style={{ background: project.color }} />
              <span className="sidebar__project-name">{project.name}</span>
            </Link>
          ))
        )}
      </div>

      <div className="sidebar__spacer" />
    </aside>
  );
}

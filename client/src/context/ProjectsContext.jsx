import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

/**
 * ProjectsContext caches the user's project list so several parts of the UI
 * can share it without each fetching its own copy:
 *   - the sidebar's project navigation
 *   - the projects page grid
 *   - the "which project?" dropdown when creating a task
 *
 * It also exposes `taskVersion` / `bumpTaskVersion()`: a counter pages can
 * watch to re-fetch their task lists when a task changes somewhere else
 * (e.g. a task created from the top bar while the board page is open).
 */
const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taskVersion, setTaskVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/projects');
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const bumpTaskVersion = useCallback(() => setTaskVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ projects, loading, error, refresh, taskVersion, bumpTaskVersion }),
    [projects, loading, error, refresh, taskVersion, bumpTaskVersion]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error('useProjects must be used inside <ProjectsProvider>');
  return context;
}

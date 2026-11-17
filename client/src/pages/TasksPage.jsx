import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ListTodo, Plus, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { useToast } from '../context/ToastContext';
import TaskDetail from '../components/TaskDetail';
import TaskModal from '../components/TaskModal';
import { Loading, EmptyState, ErrorState } from '../components/States';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, describeDeadline } from '../utils/format';

/**
 * All Tasks — the full list:
 *
 *   title row (title left, the one primary right)
 *   underline tabs for the list's states on a full-width 1px rule
 *   filter bar: search left, priority / overdue / sort right
 *   the table on the ground: grey header labels, one rule per row,
 *   the identity column widest, deadlines right-aligned
 *
 * The server does search, priority, overdue and sorting (SQL side);
 * the status tabs slice the fetched rows client-side so each tab can
 * show its honest count without extra round trips.
 */
export default function TasksPage() {
  const { taskVersion, bumpTaskVersion } = useProjects();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState('created');
  const [tab, setTab] = useState('all');

  const [detailTask, setDetailTask] = useState(null);
  const [creating, setCreating] = useState(false);

  // Debounced search: the input updates instantly, the query lags 300ms.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (priority) params.set('priority', priority);
    if (overdueOnly) params.set('overdue', 'true');
    if (sort) params.set('sort', sort);
    return params.toString();
  }, [search, priority, overdueOnly, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQuery();
      const data = await api.get(`/api/tasks${query ? `?${query}` : ''}`);
      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    load();
  }, [load, taskVersion]);

  // Counts follow the view: each tab shows how many of the fetched rows
  // would land in it (recomputed on every fetch and filter change).
  const counts = useMemo(() => {
    const result = { all: tasks.length };
    for (const status of STATUS_ORDER) {
      result[status] = tasks.filter((task) => task.status === status).length;
    }
    return result;
  }, [tasks]);

  const visibleTasks = useMemo(
    () => (tab === 'all' ? tasks : tasks.filter((task) => task.status === tab)),
    [tasks, tab]
  );

  const hasFilters = search || priority || overdueOnly || tab !== 'all';
  const activeFilterCount = useMemo(
    () => [search, priority, overdueOnly && 'overdue', tab !== 'all' && STATUS_LABELS[tab]].filter(Boolean).length,
    [search, priority, overdueOnly, tab]
  );

  function handleTaskSaved(updated) {
    setTasks((current) =>
      current.map((task) =>
        task.id === updated.id ? { ...task, ...updated, projectName: task.projectName, projectColor: task.projectColor } : task
      )
    );
    setDetailTask((current) => (current && current.id === updated.id ? { ...current, ...updated } : current));
  }

  function handleTaskDeleted(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setDetailTask(null);
    bumpTaskVersion();
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setPriority('');
    setOverdueOnly(false);
    setSort('created');
    setTab('all');
  }

  if (error && tasks.length === 0) {
    return <div className="page"><ErrorState message={error} onRetry={load} /></div>;
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">All Tasks</h1>
          <p className="page__subtitle num">
            {loading ? 'Loading…' : `${counts.all} task${counts.all === 1 ? '' : 's'}${search || priority || overdueOnly ? ' matching your filters' : ''}`}
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            New Task
          </button>
        </div>
      </div>

      {/* Underline tabs for the list's states, on a full-width rule */}
      <div className="tabs" role="tablist" aria-label="Filter tasks by status">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`tab${tab === 'all' ? ' tab--active' : ''}`}
          onClick={() => setTab('all')}
        >
          All
          <span className="tab__count num">{counts.all}</span>
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={tab === status}
            className={`tab${tab === status ? ' tab--active' : ''}`}
            onClick={() => setTab(status)}
          >
            {STATUS_LABELS[status]}
            <span className="tab__count num">{counts[status]}</span>
          </button>
        ))}
      </div>

      {/* Filter bar: search on the left, the rest on the right */}
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by title…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search tasks by title"
          />
        </div>

        <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select className="select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort tasks">
          <option value="created">Newest first</option>
          <option value="deadline">Deadline</option>
          <option value="priority">Priority</option>
        </select>

        <button
          type="button"
          className={`chip-toggle${overdueOnly ? ' chip-toggle--active' : ''}`}
          onClick={() => setOverdueOnly((v) => !v)}
          aria-pressed={overdueOnly}
        >
          Overdue only
        </button>

        <span style={{ flex: 1 }} />

        {activeFilterCount > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
            <X size={13} />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {loading ? (
        <Loading label="Loading tasks…" />
      ) : visibleTasks.length === 0 ? (
        <div style={{ padding: '16px 0' }}>
          <EmptyState
            icon={<ListTodo size={32} />}
            title={hasFilters ? 'No tasks match your filters' : 'No tasks yet'}
            hint={hasFilters ? 'Try removing a filter or two.' : 'Create a task from here or from any project board.'}
            action={
              hasFilters ? (
                <button type="button" className="btn btn--secondary btn--sm" onClick={clearFilters}>Clear filters</button>
              ) : (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
                  <Plus size={14} /> New Task
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          {/* Header: grey labels, no fill, no rule under it */}
          <div className="task-table__head" aria-hidden="true">
            <span>Task</span>
            <span>Project</span>
            <span>Priority</span>
            <span>Status</span>
            <span className="right">Deadline</span>
            <span />
          </div>
          <div role="table" aria-label="Tasks">
            {visibleTasks.map((task) => {
              const due = describeDeadline(task.deadline, task.status);
              return (
                <button
                  type="button"
                  className="task-row"
                  key={task.id}
                  onClick={() => setDetailTask(task)}
                  aria-label={`Open task ${task.title}`}
                >
                  <span className="task-row__title">{task.title}</span>
                  <span className="task-row__project">
                    <span className="task-row__project-dot" style={{ background: task.projectColor }} />
                    {task.projectName}
                  </span>
                  <span><PriorityBadge priority={task.priority} /></span>
                  <span><StatusBadge status={task.status} /></span>
                  <span className={`task-row__deadline${due?.overdue ? ' task-row__deadline--overdue' : ''}`}>
                    {due ? due.text : '—'}
                  </span>
                  <span className="task-row__chevron">
                    <ChevronRight size={15} />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}

      {creating && (
        <TaskModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); showToast('Task created'); load(); }}
        />
      )}

      {/* If a refresh failed but we still have data on screen, be explicit
          about it instead of silently showing stale rows. */}
      {error && tasks.length > 0 && (
        <div className="alert" style={{ marginTop: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={15} />{error}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={load}>Retry</button>
        </div>
      )}
    </div>
  );
}

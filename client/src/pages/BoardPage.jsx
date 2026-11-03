import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Inbox, Pencil, Plus, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { useToast } from '../context/ToastContext';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import TaskDetail from '../components/TaskDetail';
import ProjectModal from '../components/ProjectModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Loading, EmptyState, ErrorState } from '../components/States';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER } from '../utils/format';

/**
 * The Kanban board for one project.
 *
 * How drag & drop works (no external library):
 *   1. Cards are native `draggable` elements; on dragstart they put their
 *      task id into the drag event's dataTransfer.
 *   2. Columns track "is something hovering over me?" via dragenter/
 *      dragleave/dragover and highlight themselves.
 *   3. On drop, the column reads the task id and calls moveTask(taskId,
 *      newStatus, beforeTaskId): it reorders the local array optimistically,
 *      computes a new fractional `position` for the moved card, and PATCHes
 *      {status, position} to the server. If the request fails, the board
 *      reverts to the pre-move snapshot and shows an error toast.
 *
 * Non-drag alternative: every card opens the detail drawer, which contains a
 * regular status <select> — keyboard and screen-reader users change status
 * there.
 */
export default function BoardPage() {
  const { projectId } = useParams();
  const { projects, loading: projectsLoading, taskVersion, bumpTaskVersion, refresh } = useProjects();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const [creating, setCreating] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [editingProject, setEditingProject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const project = useMemo(
    () => projects.find((p) => p.id === Number(projectId)),
    [projects, projectId]
  );

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.get(`/api/projects/${projectId}/tasks`);
      setTasks(data.tasks);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [loadTasks, taskVersion]);

  // ---- drag & drop --------------------------------------------------

  const columnTasks = useCallback(
    (status) => {
      const term = search.trim().toLowerCase();
      return tasks
        .filter(
          (task) =>
            task.status === status &&
            (!term || task.title.toLowerCase().includes(term)) &&
            (!priorityFilter || task.priority === priorityFilter)
        )
        .sort((a, b) => a.position - b.position);
    },
    [tasks, search, priorityFilter]
  );

  /**
   * Move `taskId` into column `newStatus`, optionally placing it before
   * `beforeTaskId` (dropping onto a specific card). Positions are fractional
   * numbers: the moved card takes the midpoint between its new neighbours,
   * so nothing else has to be rewritten.
   */
  async function moveTask(taskId, newStatus, beforeTaskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === newStatus && beforeTaskId == null) return;

    const snapshot = tasks;

    // Build the new column order locally.
    const targetList = columnTasks(newStatus).filter((t) => t.id !== taskId);
    let insertAt = targetList.length;
    if (beforeTaskId != null) {
      const index = targetList.findIndex((t) => t.id === beforeTaskId);
      if (index !== -1) insertAt = index;
    }
    const previous = targetList[insertAt - 1];
    const next = targetList[insertAt];
    const newPosition =
      previous || next
        ? ((previous?.position ?? next.position - 100) + (next?.position ?? previous.position + 100)) / 2
        : 100;

    const moved = { ...task, status: newStatus, position: newPosition };
    const updated = tasks.map((t) => (t.id === taskId ? moved : t));
    setTasks(updated);

    try {
      await api.patch(`/api/tasks/${taskId}`, { status: newStatus, position: newPosition });
      bumpTaskVersion();
    } catch (err) {
      setTasks(snapshot); // revert on failure
      showToast(err.message, 'error');
    }
  }

  function handleDrop(event, status) {
    event.preventDefault();
    setDragOverColumn(null);
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (taskId) moveTask(taskId, status, null);
  }

  // Dropping directly ON a card inserts before that card.
  function handleCardDrop(event, status, beforeTask) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverColumn(null);
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (taskId && taskId !== beforeTask.id) moveTask(taskId, status, beforeTask.id);
  }

  // ---- task editing / deletion ---------------------------------------

  function handleTaskSaved(updated) {
    setTasks((current) => current.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    setDetailTask((current) => (current && current.id === updated.id ? { ...current, ...updated } : current));
  }

  function handleTaskDeleted(taskId) {
    setTasks((current) => current.filter((t) => t.id !== taskId));
    setDetailTask(null);
    setConfirmDelete(false);
  }

  async function handleDeleteProject() {
    setDeleting(true);
    try {
      await api.delete(`/api/projects/${projectId}`);
      await refresh();
      showToast('Project deleted');
    } catch (err) {
      showToast(err.message, 'error');
      setDeleting(false);
    }
  }

  // ---- render ---------------------------------------------------------

  if (projectsLoading || loading) return <Loading label="Loading board…" />;

  if (!project) {
    return (
      <div className="page">
        <EmptyState
          icon={<Inbox size={34} />}
          title="Project not found"
          hint="It may have been deleted, or it belongs to another account."
          action={<Link to="/projects" className="btn btn--secondary btn--sm">Back to projects</Link>}
        />
      </div>
    );
  }

  if (loadError) return <div className="page"><ErrorState message={loadError} onRetry={() => { setLoading(true); loadTasks(); }} /></div>;

  const totalVisible = STATUS_ORDER.reduce((sum, status) => sum + columnTasks(status).length, 0);

  return (
    <div className="page">
      <div className="page__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/projects" className="icon-btn" aria-label="Back to projects" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <ArrowLeft size={16} />
          </Link>
          <span className="sidebar__project-color" style={{ background: project.color, width: 12, height: 12, borderRadius: 4 }} />
          <div>
            <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {project.name}
              <button type="button" className="icon-btn" onClick={() => setEditingProject(true)} aria-label="Edit project">
                <Pencil size={13} />
              </button>
            </h1>
            {project.description && <p className="page__subtitle">{project.description}</p>}
          </div>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            New Task
          </button>
        </div>
      </div>

      <div className="board-toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search this board…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search tasks on this board"
          />
        </div>
        <select
          className="select"
          style={{ height: 34, width: 150, background: 'var(--surface)' }}
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {(search || priorityFilter) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => { setSearch(''); setPriorityFilter(''); }}
          >
            <X size={13} />
            Clear
          </button>
        )}
        {(search || priorityFilter) && (
          <span className="board-toolbar__count">
            {totalVisible} matching task{totalVisible === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="board">
        {STATUS_ORDER.map((status) => {
          const items = columnTasks(status);
          return (
            <section
              key={status}
              className={`column${dragOverColumn === status ? ' column--drag-over' : ''}`}
              aria-label={`${STATUS_LABELS[status]} column`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={() => setDragOverColumn(status)}
              onDragLeave={(event) => {
                // Only clear when the pointer truly left the column box.
                if (!event.currentTarget.contains(event.relatedTarget)) setDragOverColumn(null);
              }}
              onDrop={(event) => handleDrop(event, status)}
            >
              <header className="column__header">
                <span className="column__title">{STATUS_LABELS[status]}</span>
                <span className="column__count num">{items.length}</span>
              </header>

              <div className="column__list">
                {items.length === 0 && <div className="column__empty">{dragOverColumn === status ? 'Drop here' : 'No tasks'}</div>}
                {items.map((task) => (
                  <div
                    key={task.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleCardDrop(event, status, task)}
                  >
                    <TaskCard
                      task={task}
                      isDragging={draggingId === task.id}
                      onDragStart={setDraggingId}
                      onDragEnd={() => setDraggingId(null)}
                      onOpen={setDetailTask}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {creating && (
        <TaskModal
          fixedProject={project}
          onClose={() => setCreating(false)}
          onSaved={(task) => {
            setCreating(false);
            setTasks((current) => [...current, task]);
            showToast('Task created');
          }}
        />
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}

      {editingProject && (
        <ProjectModal
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={(updated) => {
            setEditingProject(false);
            showToast('Project updated');
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${project.name}", its ${project.taskCount} task${project.taskCount === 1 ? '' : 's'} and all comments will be permanently deleted. This cannot be undone.`}
          busy={deleting}
          onConfirm={handleDeleteProject}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

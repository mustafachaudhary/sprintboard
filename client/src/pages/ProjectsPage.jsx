import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { useToast } from '../context/ToastContext';
import ProjectModal from '../components/ProjectModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Loading, EmptyState, ErrorState } from '../components/States';
import { formatDate } from '../utils/format';

/**
 * Projects — a full-width table listing, like All Tasks:
 * a bare table on the ground (no cards around it), grey header labels,
 * row rules, the identity column widest, right-aligned tabular figures.
 *
 * Each row: the project's colour mark and name (identity), its description,
 * task counts, a progress bar and the created date. The kebab holds edit
 * and delete. Clicking a row opens the project's board.
 */
export default function ProjectsPage() {
  const { projects, loading, error, refresh } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [menuFor, setMenuFor] = useState(null);   // project id whose kebab menu is open
  const [editing, setEditing] = useState(null);   // project being edited, or 'new'
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    const tasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
    return `${projects.length} project${projects.length === 1 ? '' : 's'}, ${tasks} task${tasks === 1 ? '' : 's'}`;
  }, [projects]);

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/api/projects/${deleting.id}`);
      await refresh();
      showToast('Project deleted');
      setDeleting(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><Loading label="Loading projects…" /></div>;
  if (error) return <div className="page"><ErrorState message={error} onRetry={refresh} /></div>;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Projects</h1>
          <p className="page__subtitle num">{summary}</p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Plus size={15} />
            New Project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          hint="Projects group your tasks and give each one its own Kanban board. Create your first one to get started."
          action={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
              <Plus size={14} /> Create your first project
            </button>
          }
        />
      ) : (
        <>
          {/* Header: grey labels, no fill, no rule under it */}
          <div className="projects-table__head" aria-hidden="true">
            <span>Project</span>
            <span className="right">Tasks</span>
            <span>Progress</span>
            <span className="right">Created</span>
            <span />
          </div>
          <div role="table" aria-label="Projects">
            {projects.map((project) => {
              const percent = project.taskCount > 0
                ? Math.round((project.completedCount / project.taskCount) * 100)
                : 0;
              return (
                <div
                  key={project.id}
                  role="row"
                  tabIndex={0}
                  className="projects-row"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigate(`/projects/${project.id}`);
                  }}
                  aria-label={`Open project ${project.name}`}
                >
                  {/* Identity: colour mark + name + description, the widest cell */}
                  <span className="projects-row__identity">
                    <span className="projects-row__color" style={{ background: project.color }} aria-hidden="true" />
                    <span className="projects-row__name-wrap">
                      <span className="projects-row__name">{project.name}</span>
                      <span className="projects-row__desc">{project.description || 'No description yet.'}</span>
                    </span>
                  </span>
                  <span className="projects-row__count num">
                    {project.completedCount}/{project.taskCount}
                  </span>
                  <span className="projects-row__progress">
                    <span className="progress">
                      <span
                        className="progress__fill"
                        style={{ transform: `scaleX(${percent / 100})`, background: project.color }}
                      />
                    </span>
                    <span className="projects-row__percent num">{percent}%</span>
                  </span>
                  <span className="projects-row__created num">{formatDate(project.createdAt?.slice(0, 10))}</span>
                  <span className="projects-row__actions" onClick={(event) => event.stopPropagation()}>
                    <div className="menu-anchor">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Actions for ${project.name}`}
                        aria-expanded={menuFor === project.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuFor(menuFor === project.id ? null : project.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuFor === project.id && (
                        <div className="menu" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="menu__item"
                            onClick={() => { setMenuFor(null); setEditing(project); }}
                          >
                            <Pencil size={14} /> Edit project
                          </button>
                          <button
                            type="button"
                            className="menu__item menu__item--danger"
                            onClick={() => { setMenuFor(null); setDeleting(project); }}
                          >
                            <Trash2 size={14} /> Delete project
                          </button>
                        </div>
                      )}
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing === 'new' && (
        <ProjectModal
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); showToast('Project created'); }}
        />
      )}
      {editing && editing !== 'new' && (
        <ProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); showToast('Project updated'); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${deleting.name}", its ${deleting.taskCount} task${deleting.taskCount === 1 ? '' : 's'} and all comments will be permanently deleted. This cannot be undone.`}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

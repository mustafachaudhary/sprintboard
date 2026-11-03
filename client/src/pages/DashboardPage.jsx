import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { Loading, ErrorState, EmptyState } from '../components/States';
import MiniBars from '../components/MiniBars';
import { describeDeadline, formatDateTime } from '../utils/format';

/**
 * Overview — the dashboard.
 *
 * One question: "Is this sprint moving, and what needs me now?"
 *
 * The top row is the screen's hierarchy: the pulse card (the headline
 * completion figure, its rhythm over the last 14 days, and the honest
 * week-over-week delta) beside a "Needs you" rail — the overdue items and
 * whatever is waiting in review, each one click from its board. There is
 * no KPI strip: every headline number lives in the card that explains it.
 *
 * Below, stacked sections: recent activity, then the projects. Every
 * number comes from GET /api/dashboard — nothing is hardcoded.
 */
export default function DashboardPage() {
  const { projects } = useProjects();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/api/dashboard');
      setData(result);
      setError(null);
      setFetchedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <div className="page"><Loading label="Loading your workspace…" /></div>;
  if (error && !data) return <div className="page"><ErrorState message={error} onRetry={load} /></div>;

  const { stats, recentTasks, completionSeries, attention } = data;

  // Headline figure and the honest week-over-week delta.
  // Every relative figure names its baseline in the same phrase.
  const thisWeek = completionSeries.slice(7).reduce((sum, point) => sum + point.count, 0);
  const lastWeek = completionSeries.slice(0, 7).reduce((sum, point) => sum + point.count, 0);
  const delta = thisWeek - lastWeek;
  const deltaText =
    delta > 0 ? `+${delta} vs the week before`
      : delta < 0 ? `${delta} vs the week before`
        : 'level with the week before';

  // The best day, for the pulse subline. Plain computation — a 14-item
  // array needs no memo, and hooks must never sit after the early returns.
  const bestDay = (() => {
    const max = Math.max(...completionSeries.map((point) => point.count), 0);
    if (max === 0) return null;
    const point = completionSeries.find((p) => p.count === max);
    return {
      count: max,
      label: new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  })();

  const freshness = fetchedAt
    ? `Updated ${fetchedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : null;

  const railEmpty = attention.overdue.length === 0 && attention.inReview.length === 0;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Overview</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {freshness && <span className="section__meta">{freshness}</span>}
          <button type="button" className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {error && data && (
        <div className="alert"><RefreshCw size={15} /> {error}</div>
      )}

      {/* The screen's hierarchy: pulse lead + needs-you rail */}
      <div className="dash-top">
        {/* Sprint pulse: the headline figure, its rhythm, the delta */}
        <section className="card pulse" aria-label="Sprint pulse">
          <div className="pulse__figure-row">
            <span className="pulse__figure num">{stats.completionRate}<span className="pulse__unit">%</span></span>
            <span className="pulse__caption">
              of the sprint done
              <span className="pulse__sub num">
                {stats.completedTasks} of {stats.totalTasks} tasks · {deltaText}
              </span>
            </span>
          </div>
          <div className="pulse__chart">
            {stats.totalTasks === 0 || stats.completedTasks === 0 ? (
              <p className="pulse__empty">
                {stats.totalTasks === 0
                  ? 'No tasks yet. Create a project and start the sprint.'
                  : 'Nothing completed in this window yet. Finish a task and the pulse starts.'}
              </p>
            ) : (
              <MiniBars series={completionSeries} />
            )}
          </div>
          {bestDay && (
            <div className="pulse__foot num">
              Best day {bestDay.label} with {bestDay.count} · last 14 days
            </div>
          )}
        </section>

        {/* Needs you: overdue and in-review, each row one click from its board */}
        <section className="card rail" aria-label="Needs your attention">
          <div className="rail__body">
            {railEmpty ? (
              <div className="rail__clear">
                <span className="rail__clear-title">Clear runway</span>
                <span className="rail__clear-hint">Nothing is overdue and nothing is waiting in review.</span>
              </div>
            ) : (
              <>
                {attention.overdue.length > 0 && (
                  <>
                    <div className="rail__group">
                      <span className="rail__group-name">Overdue</span>
                      <span className="rail__group-count num">{attention.overdue.length}</span>
                    </div>
                    {attention.overdue.map((task) => {
                      const due = describeDeadline(task.deadline, 'todo');
                      return (
                        <Link to={`/projects/${task.projectId}`} key={task.id} className="rail__row">
                          <span className="rail__bar" style={{ background: task.projectColor }} />
                          <span className="rail__main">
                            <span className="rail__title">{task.title}</span>
                            <span className="rail__sub">{task.projectName}</span>
                          </span>
                          <span className="rail__signal">{due?.text}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
                {attention.inReview.length > 0 && (
                  <>
                    <div className="rail__group">
                      <span className="rail__group-name">In review</span>
                      <span className="rail__group-count num">{attention.inReview.length}</span>
                    </div>
                    {attention.inReview.map((task) => (
                      <Link to={`/projects/${task.projectId}`} key={task.id} className="rail__row">
                        <span className="rail__bar" style={{ background: task.projectColor }} />
                        <span className="rail__main">
                          <span className="rail__title">{task.title}</span>
                          <span className="rail__sub">{task.projectName}</span>
                        </span>
                        <ChevronRight size={15} className="rail__chevron" />
                      </Link>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
          <Link to="/tasks" className="rail__foot">View all tasks</Link>
        </section>
      </div>

      {/* 2. Recent activity */}
      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Recent activity</h2>
          <Link to="/tasks" className="section__action">View all tasks</Link>
        </div>
        {recentTasks.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Nothing here yet"
              hint="Recently updated tasks will appear in this feed."
            />
          </div>
        ) : (
          <div className="activity-list">
            {recentTasks.map((task) => {
              const due = describeDeadline(task.deadline, task.status);
              return (
                <Link to={`/projects/${task.projectId}`} key={task.id} className="activity-item">
                  <span className="activity-item__color" style={{ background: task.projectColor }} />
                  <div className="activity-item__main">
                    <div className="activity-item__title">{task.title}</div>
                    <div className="activity-item__sub">
                      {task.projectName}
                      {due?.overdue && (
                        <> <span className="activity-item__overdue">{due.text}</span></>
                      )}
                    </div>
                  </div>
                  <span className="activity-item__date num">{formatDateTime(task.updatedAt)}</span>
                  <ChevronRight size={15} className="rail__chevron" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Projects */}
      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Projects</h2>
          <Link to="/projects" className="section__action">Manage projects</Link>
        </div>
        {projects.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No projects yet"
              hint="Projects group your tasks and give each one its own board."
              action={<Link to="/projects" className="btn btn--primary btn--sm">Create your first project</Link>}
            />
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => {
              const percent = project.taskCount > 0
                ? Math.round((project.completedCount / project.taskCount) * 100)
                : 0;
              return (
                <Link to={`/projects/${project.id}`} key={project.id} className="project-list__row">
                  <div className="project-list__row-main">
                    <span className="project-list__name">
                      <span className="project-list__dot" style={{ background: project.color }} />
                      {project.name}
                    </span>
                    <div className="project-list__desc">{project.description || 'No description yet.'}</div>
                  </div>
                  <div className="project-list__bar">
                    <div className="progress">
                      <div
                        className="progress__fill"
                        style={{ transform: `scaleX(${percent / 100})`, background: project.color }}
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${project.name} progress`}
                      />
                    </div>
                  </div>
                  <span className="project-list__count num">
                    {project.completedCount}/{project.taskCount}
                  </span>
                  <ChevronRight size={15} className="rail__chevron" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

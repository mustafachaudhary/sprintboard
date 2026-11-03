import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, MessageSquare, Send, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, formatDateTime, initials, describeDeadline } from '../utils/format';

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  deadline: '',
};

/**
 * Task detail drawer: view + edit + comments + delete for one task.
 *
 * Editing model: the form fields start from the task's saved values. When
 * anything differs from the saved version a "Save changes" button appears
 * (and the drawer tells you so), sending one PATCH /api/tasks/:id.
 */
export default function TaskDetail({ task, onClose, onSaved, onDeleted }) {
  const { bumpTaskVersion } = useProjects();
  const { showToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Reset the form whenever a different task is opened.
  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      deadline: task.deadline || '',
    });
    setErrors({});
    setAlert(null);
  }, [task]);

  // Load the comment thread for this task.
  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    api
      .get(`/api/tasks/${task.id}/comments`)
      .then((data) => { if (!cancelled) setComments(data.comments); })
      .catch((err) => { if (!cancelled) showToast(err.message, 'error'); })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [task.id, showToast]);

  // "Dirty" check: is the form different from the saved task?
  const isDirty = useMemo(
    () =>
      form.title !== task.title ||
      form.description !== (task.description || '') ||
      form.status !== task.status ||
      form.priority !== task.priority ||
      form.deadline !== (task.deadline || ''),
    [form, task]
  );

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSave() {
    setBusy(true);
    setAlert(null);
    try {
      const data = await api.patch(`/api/tasks/${task.id}`, {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        deadline: form.deadline || null,
      });
      bumpTaskVersion();
      onSaved(data.task);
      showToast('Task updated');
    } catch (err) {
      if (err.details) setErrors(err.details);
      else setAlert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/api/tasks/${task.id}`);
      bumpTaskVersion();
      showToast('Task deleted');
      onDeleted(task.id);
    } catch (err) {
      setConfirmingDelete(false);
      setBusy(false);
      setAlert(err.message);
    }
  }

  async function handlePostComment(event) {
    event.preventDefault();
    const content = commentText.trim();
    if (!content) return;
    setPostingComment(true);
    try {
      const data = await api.post(`/api/tasks/${task.id}/comments`, { content });
      setComments((current) => [...current, data.comment]);
      setCommentText('');
      bumpTaskVersion();
    } catch (err) {
      showToast(err.details?.content || err.message, 'error');
    } finally {
      setPostingComment(false);
    }
  }

  const due = describeDeadline(form.deadline || null, form.status);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`}>
        <div className="drawer__header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer__title">{task.title}</div>
            <div className="drawer__project">
              <span className="sidebar__project-color" style={{ background: task.projectColor }} />
              {task.projectName}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close task details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="drawer__body">
          {alert && <div className="alert"><AlertTriangle size={15} />{alert}</div>}

          <div className="detail-grid">
            <div>
              <div className="detail-section__label">Status</div>
              <select className="select" value={form.status} onChange={setField('status')} aria-label="Status">
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="detail-section__label">Priority</div>
              <select className={`select${errors.priority ? ' select--invalid' : ''}`} value={form.priority} onChange={setField('priority')} aria-label="Priority">
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="detail-section__label">
              <CalendarDays size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 5 }} />
              Deadline {due && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: due.overdue ? 'var(--negative)' : 'var(--text-secondary)' }}>— {due.text}</span>}
            </div>
            <input type="date" className={`input${errors.deadline ? ' input--invalid' : ''}`} value={form.deadline} onChange={setField('deadline')} aria-label="Deadline" />
            {errors.deadline && <span className="field__error">{errors.deadline}</span>}
          </div>

          <div>
            <div className="detail-section__label">Title</div>
            <input
              className={`input${errors.title ? ' input--invalid' : ''}`}
              value={form.title}
              onChange={setField('title')}
              maxLength={140}
              aria-label="Task title"
            />
            {errors.title && <span className="field__error">{errors.title}</span>}
          </div>

          <div>
            <div className="detail-section__label">Description</div>
            <textarea
              className={`textarea${errors.description ? ' textarea--invalid' : ''}`}
              value={form.description}
              onChange={setField('description')}
              placeholder="Add context, acceptance criteria, links…"
              maxLength={2000}
              rows={5}
              aria-label="Task description"
            />
            {errors.description && <span className="field__error">{errors.description}</span>}
          </div>

          {isDirty && (
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          )}

          <div>
            <div className="detail-section__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={12} />
              Comments <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({comments.length})</span>
            </div>

            {commentsLoading ? (
              <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading comments…</div>
            ) : comments.length === 0 ? (
              <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No comments yet. Start the discussion below.
              </div>
            ) : (
              comments.map((comment) => (
                <div className="comment" key={comment.id}>
                  <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                    {initials(comment.authorName)}
                  </span>
                  <div className="comment__bubble">
                    <div className="comment__meta">
                      <span className="comment__author">{comment.authorName}</span>
                      <span className="comment__time">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <div className="comment__content">{comment.content}</div>
                  </div>
                </div>
              ))
            )}

            <form className="comment-composer" onSubmit={handlePostComment}>
              <textarea
                className="textarea"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Write a comment…"
                maxLength={1000}
                aria-label="Write a comment"
              />
              <button
                type="submit"
                className="btn btn--secondary"
                disabled={postingComment || !commentText.trim()}
                aria-label="Post comment"
                style={{ height: 38 }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>

        <div className="drawer__footer">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={busy || !isDirty}
            title={isDirty ? 'Save your changes' : 'Nothing to save yet'}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </aside>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${task.title}" and its comments will be permanently removed. This cannot be undone.`}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

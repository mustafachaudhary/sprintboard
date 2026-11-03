import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import Modal from './Modal';
import { PRIORITY_LABELS } from '../utils/format';

/**
 * "New task" dialog. Used from three places:
 *   - the board (project is fixed, no dropdown shown)
 *   - the All Tasks page and the top bar (project picked from a dropdown)
 */
export default function TaskModal({ fixedProject = null, defaultProjectId = null, onClose, onSaved }) {
  const { projects, bumpTaskVersion } = useProjects();

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline: '',
    projectId: fixedProject?.id ?? defaultProjectId ?? projects[0]?.id ?? '',
  });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        deadline: form.deadline || null, // empty string -> no deadline
        projectId: form.projectId,
      };
      const data = await api.post('/api/tasks', payload);
      bumpTaskVersion();
      onSaved(data.task);
    } catch (err) {
      if (err.details) setErrors(err.details);
      else setAlert(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {alert && <div className="alert"><AlertTriangle size={15} />{alert}</div>}

        <div className="field">
          <label className="field__label" htmlFor="task-title">Title</label>
          <input
            id="task-title"
            className={`input${errors.title ? ' input--invalid' : ''}`}
            value={form.title}
            onChange={setField('title')}
            placeholder="e.g. Implement drag-and-drop"
            maxLength={140}
            autoFocus
          />
          {errors.title && <span className="field__error">{errors.title}</span>}
        </div>

        {!fixedProject && (
          <div className="field">
            <label className="field__label" htmlFor="task-project">Project</label>
            <select
              id="task-project"
              className="select"
              value={form.projectId}
              onChange={setField('projectId')}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="task-desc">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <textarea
            id="task-desc"
            className={`textarea${errors.description ? ' textarea--invalid' : ''}`}
            value={form.description}
            onChange={setField('description')}
            placeholder="Add context, acceptance criteria, links…"
            maxLength={2000}
            rows={4}
          />
          {errors.description && <span className="field__error">{errors.description}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="field__label" htmlFor="task-priority">Priority</label>
            <select id="task-priority" className="select" value={form.priority} onChange={setField('priority')}>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="task-deadline">Deadline <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input
              id="task-deadline"
              type="date"
              className={`input${errors.deadline ? ' input--invalid' : ''}`}
              value={form.deadline}
              onChange={setField('deadline')}
            />
            {errors.deadline && <span className="field__error">{errors.deadline}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

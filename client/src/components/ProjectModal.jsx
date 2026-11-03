import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import Modal from './Modal';

const PROJECT_COLORS = [
  '#2DD4BF', '#4A9DE0', '#3FC07A', '#E0A23C', '#E5566F', '#8A8A8F',
];

/**
 * Create-or-edit dialog for projects.
 * `project` null  -> "New project" (POST /api/projects)
 * `project` given -> "Edit project" (PATCH /api/projects/:id)
 */
export default function ProjectModal({ project, onClose, onSaved }) {
  const { refresh } = useProjects();
  const editing = Boolean(project);

  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || PROJECT_COLORS[0],
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
      const data = editing
        ? await api.patch(`/api/projects/${project.id}`, form)
        : await api.post('/api/projects', form);
      await refresh();
      onSaved(data.project);
    } catch (err) {
      if (err.details) setErrors(err.details);
      else setAlert(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {alert && <div className="alert"><AlertTriangle size={15} />{alert}</div>}

        <div className="field">
          <label className="field__label" htmlFor="project-name">Name</label>
          <input
            id="project-name"
            className={`input${errors.name ? ' input--invalid' : ''}`}
            value={form.name}
            onChange={setField('name')}
            placeholder="e.g. Aurora Web App"
            maxLength={80}
            autoFocus
          />
          {errors.name && <span className="field__error">{errors.name}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="project-desc">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <textarea
            id="project-desc"
            className={`textarea${errors.description ? ' textarea--invalid' : ''}`}
            value={form.description}
            onChange={setField('description')}
            placeholder="What is this project about?"
            maxLength={500}
            rows={3}
          />
          {errors.description && <span className="field__error">{errors.description}</span>}
        </div>

        <div className="field">
          <span className="field__label">Color</span>
          <div className="color-row" role="radiogroup" aria-label="Project color">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={form.color === color}
                aria-label={`Color ${color}`}
                className={`color-swatch${form.color === color ? ' color-swatch--selected' : ''}`}
                style={{ background: color }}
                onClick={() => setForm((current) => ({ ...current, color }))}
              />
            ))}
          </div>
          {errors.color && <span className="field__error">{errors.color}</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

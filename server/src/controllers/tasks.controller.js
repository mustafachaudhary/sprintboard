// ============================================================
// Tasks controller
// ============================================================
const { HttpError, asyncHandler } = require('../utils/httpError');
const { validateTask, validateTaskUpdate } = require('../utils/validation');
const tasks = require('../services/tasks');
const projects = require('../services/projects');

// GET /api/tasks?search=&status=&priority=&overdue=&sort=  (My Tasks page)
const list = asyncHandler(async (req, res) => {
  const options = {
    search: req.query.search,
    status: req.query.status,
    priority: req.query.priority,
    overdue: req.query.overdue,
    sort: req.query.sort,
  };
  const rows = await tasks.listUserTasks(req.user.id, options);
  res.json({ tasks: rows });
});

// GET /api/projects/:projectId/tasks  (Kanban board)
const listForProject = asyncHandler(async (req, res) => {
  const project = await projects.getProjectById(req.params.projectId, req.user.id);
  if (!project) throw new HttpError(404, 'Project not found.');
  const rows = await tasks.listTasksByProject(project.id);
  res.json({ tasks: rows });
});

// GET /api/tasks/:id  (task detail with comments)
const getOne = asyncHandler(async (req, res) => {
  const task = await tasks.getTaskById(req.params.id, req.user.id);
  if (!task) throw new HttpError(404, 'Task not found.');
  res.json({ task });
});

// POST /api/tasks  { projectId, title, ... }
const create = asyncHandler(async (req, res) => {
  const result = validateTask(req.body);
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }

  // The task must be created inside one of the user's own projects.
  const projectId = Number(req.body.projectId);
  const project = await projects.getProjectById(projectId, req.user.id);
  if (!project) throw new HttpError(404, 'Project not found. Cannot create the task.');

  const task = await tasks.createTask({ projectId: project.id, ...result.values });
  res.status(201).json({ task });
});

// PATCH /api/tasks/:id  — handles edits AND Kanban status/position changes.
const update = asyncHandler(async (req, res) => {
  const result = validateTaskUpdate(req.body);
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }
  if (Object.keys(result.values).length === 0) {
    throw new HttpError(400, 'No valid fields to update were provided.');
  }

  const task = await tasks.updateTask(req.params.id, req.user.id, result.values);
  if (!task) throw new HttpError(404, 'Task not found.');
  res.json({ task });
});

// DELETE /api/tasks/:id
const remove = asyncHandler(async (req, res) => {
  const deleted = await tasks.deleteTask(req.params.id, req.user.id);
  if (!deleted) throw new HttpError(404, 'Task not found.');
  res.status(204).end();
});

module.exports = { list, listForProject, getOne, create, update, remove };

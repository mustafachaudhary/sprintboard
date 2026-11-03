// ============================================================
// Projects controller
// ============================================================
const { HttpError, asyncHandler } = require('../utils/httpError');
const { validateProject } = require('../utils/validation');
const projects = require('../services/projects');

// GET /api/projects
const list = asyncHandler(async (req, res) => {
  const rows = await projects.listProjects(req.user.id);
  res.json({ projects: rows });
});

// GET /api/projects/:id
const getOne = asyncHandler(async (req, res) => {
  const project = await projects.getProjectById(req.params.id, req.user.id);
  if (!project) {
    // 404 (not 403) so we never reveal whether someone else's project exists.
    throw new HttpError(404, 'Project not found.');
  }
  res.json({ project });
});

// POST /api/projects
const create = asyncHandler(async (req, res) => {
  const result = validateProject(req.body);
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }
  const project = await projects.createProject({ userId: req.user.id, ...result.values });
  res.status(201).json({ project });
});

// PATCH /api/projects/:id
const update = asyncHandler(async (req, res) => {
  // Partial validation: only the fields the request provides are checked,
  // so a PATCH that just renames the project does not need a color too.
  const result = validateProject(req.body, { partial: true });
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }
  if (Object.keys(result.values).length === 0) {
    throw new HttpError(400, 'No valid fields to update were provided.');
  }

  const project = await projects.updateProject(req.params.id, req.user.id, result.values);
  if (!project) throw new HttpError(404, 'Project not found.');
  res.json({ project });
});

// DELETE /api/projects/:id — also deletes its tasks and comments (CASCADE).
const remove = asyncHandler(async (req, res) => {
  const deleted = await projects.deleteProject(req.params.id, req.user.id);
  if (!deleted) throw new HttpError(404, 'Project not found.');
  res.status(204).end();
});

module.exports = { list, getOne, create, update, remove };

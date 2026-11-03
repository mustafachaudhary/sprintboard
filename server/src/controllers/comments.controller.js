// ============================================================
// Comments controller
// ============================================================
const { HttpError, asyncHandler } = require('../utils/httpError');
const { validateComment } = require('../utils/validation');
const comments = require('../services/comments');
const tasks = require('../services/tasks');

// Every comment route first proves the user owns the task the comments
// belong to (getTaskById already filters by owner), then works with comments.
async function getOwnedTaskOr404(req) {
  const task = await tasks.getTaskById(req.params.taskId, req.user.id);
  if (!task) throw new HttpError(404, 'Task not found.');
  return task;
}

// GET /api/tasks/:taskId/comments
const list = asyncHandler(async (req, res) => {
  await getOwnedTaskOr404(req);
  const rows = await comments.listComments(req.params.taskId);
  res.json({ comments: rows });
});

// POST /api/tasks/:taskId/comments
const create = asyncHandler(async (req, res) => {
  const task = await getOwnedTaskOr404(req);
  const result = validateComment(req.body);
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }
  const comment = await comments.createComment({
    taskId: task.id,
    authorId: req.user.id,
    content: result.values.content,
  });
  res.status(201).json({ comment });
});

module.exports = { list, create };

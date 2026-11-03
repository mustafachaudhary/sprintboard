// ============================================================
// tasks service — all SQL for the tasks table
// ============================================================
// Tasks belong to projects, and projects belong to users. So every task
// query JOINS projects and filters by the owner's id. That join is what
// makes cross-user access impossible, even if someone guesses task ids.
const { query } = require('../db/pool');
const { STATUSES } = require('../utils/validation');

// Every task of a project (for the Kanban board), with its comment count.
function listTasksByProject(projectId) {
  return query(
    `SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority,
            to_char(t.deadline, 'YYYY-MM-DD') AS deadline, t.position, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
            (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id)::int AS "commentCount"
     FROM tasks t
     WHERE t.project_id = $1
     ORDER BY t.position, t.id`,
    [projectId]
  );
}

// Search / filter / sort across ALL of the user's tasks (My Tasks page).
// Supported options:
//   search   — case-insensitive match on the task title
//   status   — one status, or "overdue" is handled separately below
//   priority — low | medium | high | urgent
//   overdue  — "true" keeps only undone tasks past their deadline
//   sort     — created | deadline | priority (default: created)
function listUserTasks(userId, options = {}) {
  const conditions = ['p.user_id = $1'];
  const values = [userId];

  if (options.search) {
    values.push(`%${options.search}%`);
    conditions.push(`t.title ILIKE $${values.length}`);
  }
  if (options.status && STATUSES.includes(options.status)) {
    values.push(options.status);
    conditions.push(`t.status = $${values.length}`);
  }
  if (options.priority) {
    values.push(options.priority);
    conditions.push(`t.priority = $${values.length}`);
  }
  if (options.overdue === 'true') {
    conditions.push(`t.status <> 'done' AND t.deadline < CURRENT_DATE`);
  }

  const orderBy = {
    deadline: 't.deadline ASC NULLS LAST, t.created_at DESC',
    priority: `CASE t.priority
                 WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
                 WHEN 'medium' THEN 2 ELSE 3 END ASC,
               t.deadline ASC NULLS LAST`,
    created: 't.created_at DESC',
  }[options.sort] || 't.created_at DESC';

  return query(
    `SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority,
            to_char(t.deadline, 'YYYY-MM-DD') AS deadline, t.position, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
            p.name AS "projectName", p.color AS "projectColor",
            (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id)::int AS "commentCount"
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT 200`,
    values
  );
}

// One task with its project info — null when missing OR owned by someone else.
function getTaskById(taskId, userId) {
  return query(
    `SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority,
            to_char(t.deadline, 'YYYY-MM-DD') AS deadline, t.position, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
            p.name AS "projectName", p.color AS "projectColor"
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND p.user_id = $2`,
    [taskId, userId]
  ).then((rows) => rows[0] || null);
}

function createTask({ projectId, title, description, priority, deadline }) {
  // New tasks go to the bottom of the "Todo" column: find the current
  // largest position in that column and jump 100 past it.
  return query(
    `INSERT INTO tasks (project_id, title, description, priority, deadline, status, position)
     VALUES ($1, $2, $3, $4, $5, 'todo',
             (SELECT COALESCE(MAX(position), 0) + 100 FROM tasks WHERE project_id = $1 AND status = 'todo'))
     RETURNING id, project_id AS "projectId", title, description, status, priority,
               to_char(deadline, 'YYYY-MM-DD') AS deadline, position,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [projectId, title, description, priority, deadline]
  ).then((rows) => rows[0]);
}

// Same dynamic-SET pattern as updateProject in the projects service.
function buildUpdateSet(fields) {
  const columns = Object.keys(fields);
  const setClauses = columns.map((column, index) => `${column} = $${index + 1}`);
  setClauses.push('updated_at = now()');
  return { setSql: setClauses.join(', '), values: columns.map((c) => fields[c]) };
}

function updateTask(taskId, userId, fields) {
  const { setSql, values } = buildUpdateSet(fields);
  return query(
    `UPDATE tasks t SET ${setSql}
     FROM projects p
     WHERE t.project_id = p.id AND t.id = $${values.length + 1} AND p.user_id = $${values.length + 2}
     RETURNING t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority,
               to_char(t.deadline, 'YYYY-MM-DD') AS deadline, t.position, t.created_at AS "createdAt", t.updated_at AS "updatedAt"`,
    [...values, taskId, userId]
  ).then((rows) => rows[0] || null);
}

function deleteTask(taskId, userId) {
  return query(
    `DELETE FROM tasks t
     USING projects p
     WHERE t.project_id = p.id AND t.id = $1 AND p.user_id = $2
     RETURNING t.id`,
    [taskId, userId]
  ).then((rows) => rows.length > 0);
}

module.exports = {
  listTasksByProject,
  listUserTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};

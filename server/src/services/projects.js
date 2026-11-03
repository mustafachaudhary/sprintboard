// ============================================================
// projects service — all SQL for the projects table
// ============================================================
// IMPORTANT: every query filters by user_id. That is the ownership rule —
// a user can only ever read or change rows that belong to them.
const { query } = require('../db/pool');

// All of the user's projects, plus how many tasks each contains and how
// many of those are done (used for the progress bar on project cards).
function listProjects(userId) {
  return query(
    `SELECT p.id, p.name, p.description, p.color, p.created_at AS "createdAt",
            COUNT(t.id)::int AS "taskCount",
            COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS "completedCount"
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [userId]
  );
}

// A single project — or null if it does not exist or belongs to someone else.
function getProjectById(projectId, userId) {
  return query(
    `SELECT id, user_id AS "userId", name, description, color, created_at AS "createdAt"
     FROM projects
     WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  ).then((rows) => rows[0] || null);
}

function createProject({ userId, name, description, color }) {
  return query(
    `INSERT INTO projects (user_id, name, description, color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, color, created_at AS "createdAt"`,
    [userId, name, description, color]
  ).then((rows) => rows[0]);
}

// Generic "update only the fields the request actually provided" helper.
// It builds the SET clause dynamically but every value still goes through
// a numbered placeholder — never string-concatenated into the SQL.
function buildUpdateSet(fields) {
  const columns = Object.keys(fields);
  const setClauses = columns.map((column, index) => `${column} = $${index + 1}`);
  setClauses.push('updated_at = now()');
  return { setSql: setClauses.join(', '), values: columns.map((c) => fields[c]) };
}

function updateProject(projectId, userId, fields) {
  const { setSql, values } = buildUpdateSet(fields);
  return query(
    `UPDATE projects SET ${setSql}
     WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
     RETURNING id, name, description, color, created_at AS "createdAt"`,
    [...values, projectId, userId]
  ).then((rows) => rows[0] || null);
}

function deleteProject(projectId, userId) {
  // RETURNING lets us tell "deleted" apart from "nothing matched",
  // because the rows array is only non-empty when a row was actually removed.
  return query(
    'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
    [projectId, userId]
  ).then((rows) => rows.length > 0);
}

module.exports = {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};

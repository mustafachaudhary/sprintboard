// ============================================================
// comments service — all SQL for the comments table
// ============================================================
const { query } = require('../db/pool');

function listComments(taskId) {
  return query(
    `SELECT c.id, c.task_id AS "taskId", c.content, c.created_at AS "createdAt",
            c.author_id AS "authorId", u.name AS "authorName"
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.task_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [taskId]
  );
}

function createComment({ taskId, authorId, content }) {
  return query(
    `INSERT INTO comments (task_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, task_id AS "taskId", content, created_at AS "createdAt", author_id AS "authorId"`,
    [taskId, authorId, content]
  ).then((rows) => rows[0]);
}

module.exports = { listComments, createComment };

// ============================================================
// stats service — dashboard numbers, all computed by PostgreSQL
// ============================================================
// Nothing here is hardcoded: every number comes from live COUNT queries.
// COUNT(*) FILTER (WHERE ...) is PostgreSQL's conditional aggregation —
// it counts only the rows matching the condition, in a single table scan.
const { query } = require('../db/pool');

async function getDashboardStats(userId) {
  const [summary] = await query(
    `SELECT
       (SELECT COUNT(*) FROM projects WHERE user_id = $1)::int AS "totalProjects",
       COUNT(t.id)::int AS "totalTasks",
       COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS "completedTasks",
       COUNT(t.id) FILTER (WHERE t.status <> 'done')::int AS "pendingTasks",
       COUNT(t.id) FILTER (WHERE t.status <> 'done' AND t.deadline < CURRENT_DATE)::int AS "overdueTasks"
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE p.user_id = $1`,
    [userId]
  );

  return {
    ...summary,
    // Percentage 0-100 for the progress bar (0 when there are no tasks).
    completionRate: summary.totalTasks > 0
      ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
      : 0,
  };
}

// The "recent activity" list: the user's most recently touched tasks.
function getRecentTasks(userId, limit = 6) {
  return query(
    `SELECT t.id, t.title, t.status, t.priority,
            to_char(t.deadline, 'YYYY-MM-DD') AS deadline, t.updated_at AS "updatedAt",
            p.id AS "projectId", p.name AS "projectName", p.color AS "projectColor"
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE p.user_id = $1
     ORDER BY t.updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

/**
 * Tasks completed per day for the last `days` days — the sprint's pulse.
 * Only days with completions come back from SQL; the controller fills the
 * gaps with honest zeros so the series is complete for the chart.
 */
async function getCompletionSeries(userId, days = 14) {
  const rows = await query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COUNT(t.id)::int AS count
     FROM generate_series(
            CURRENT_DATE - ($2::int - 1),
            CURRENT_DATE,
            '1 day'
          ) AS d(day)
     LEFT JOIN tasks t
            ON t.status = 'done'
           AND t.updated_at::date = d.day
           AND t.project_id IN (SELECT id FROM projects WHERE user_id = $1)
     GROUP BY d.day
     ORDER BY d.day`,
    [userId, days]
  );
  return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

/**
 * The "needs you" lists for the overview rail: undone tasks past their
 * deadline (soonest first) and tasks waiting in review (most recently
 * touched first). Both are ownership-scoped through the projects join.
 */
async function getAttentionTasks(userId) {
  const overdue = await query(
    `SELECT t.id, t.title, to_char(t.deadline, 'YYYY-MM-DD') AS deadline,
            p.id AS "projectId", p.name AS "projectName", p.color AS "projectColor"
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE p.user_id = $1 AND t.status <> 'done' AND t.deadline < CURRENT_DATE
     ORDER BY t.deadline ASC
     LIMIT 4`,
    [userId]
  );
  const inReview = await query(
    `SELECT t.id, t.title,
            p.id AS "projectId", p.name AS "projectName", p.color AS "projectColor"
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE p.user_id = $1 AND t.status = 'in_review'
     ORDER BY t.updated_at DESC
     LIMIT 3`,
    [userId]
  );
  return { overdue, inReview };
}

module.exports = { getDashboardStats, getRecentTasks, getCompletionSeries, getAttentionTasks };

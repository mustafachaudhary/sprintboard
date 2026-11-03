// ============================================================
// Dashboard controller — one endpoint for the whole overview page
// ============================================================
const { asyncHandler } = require('../utils/httpError');
const stats = require('../services/stats');

// GET /api/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const [statsData, recentTasks, completionSeries, attention] = await Promise.all([
    stats.getDashboardStats(req.user.id),
    stats.getRecentTasks(req.user.id, 5),
    stats.getCompletionSeries(req.user.id, 14),
    stats.getAttentionTasks(req.user.id),
  ]);
  res.json({ stats: statsData, recentTasks, completionSeries, attention });
});

module.exports = { getDashboard };

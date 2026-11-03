// ============================================================
// API router — every backend endpoint in one view
// ============================================================
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const auth = require('../controllers/auth.controller');
const projects = require('../controllers/projects.controller');
const tasks = require('../controllers/tasks.controller');
const comments = require('../controllers/comments.controller');
const dashboard = require('../controllers/dashboard.controller');

const router = express.Router();

// ---- Authentication (public: no session needed yet) ----
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);

// ---- Everything below requires a logged-in user ----
router.use(requireAuth);

router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);

router.get('/dashboard', dashboard.getDashboard);

router.get('/projects', projects.list);
router.post('/projects', projects.create);
router.get('/projects/:id', projects.getOne);
router.patch('/projects/:id', projects.update);
router.delete('/projects/:id', projects.remove);

router.get('/projects/:projectId/tasks', tasks.listForProject);
router.get('/tasks', tasks.list);
router.post('/tasks', tasks.create);
router.get('/tasks/:id', tasks.getOne);
router.patch('/tasks/:id', tasks.update);
router.delete('/tasks/:id', tasks.remove);

router.get('/tasks/:taskId/comments', comments.list);
router.post('/tasks/:taskId/comments', comments.create);

module.exports = router;

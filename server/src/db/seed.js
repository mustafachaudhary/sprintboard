// ============================================================
// Demo data seeder — `npm run db:seed` (or `npm run db:reset` + seed)
// ============================================================
// Creates the demo account and a realistic workspace so the app looks alive
// the moment someone opens it. Dates are computed relative to *now*, so the
// board always shows fresh "overdue / due soon" examples.
//
// DEMO LOGIN (demo account only — never use these credentials in production):
//   email:    demo@sprintboard.app
//   password: demo1234
// IMPORTANT: load .env before any module that opens database connections
// (the pool reads DATABASE_URL the moment it is constructed).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const bcrypt = require('bcryptjs');
const { query, withTransaction, pool } = require('./pool');

const DEMO_EMAIL = 'demo@sprintboard.app';
const DEMO_PASSWORD = 'demo1234';

// Returns a YYYY-MM-DD string n days from today (negative = past).
function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// Returns a timestamptz string n days (plus optional hours) in the past,
// used to give tasks believable created/updated timestamps.
function pastStamp(daysAgo, hourOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(9 + hourOffset, 24, 0, 0);
  return date.toISOString();
}

// Each task: [projectIndex, title, status, priority, deadlineDaysFromNow, position, description, completedDaysAgo?]
// The optional 8th field back-dates a done task's updated_at, so the demo
// pulse chart tells a story of steady shipping: quiet at the start of the
// window, a push in the last few days.
const TASKS = [
  // --- Aurora Web App (the flagship product) ---
  [0, 'Design the onboarding flow wireframes', 'done', 'medium', -14, 100,
    'Three-step onboarding: welcome, workspace name, first project. Hand off to engineering once reviewed.', 13],
  [0, 'Write API integration tests for auth', 'done', 'medium', -6, 200,
    'Covers registration, login, session restore and ownership rules.', 11],
  [0, 'Implement session persistence', 'done', 'high', -9, 300,
    'Store sessions in PostgreSQL so logins survive server restarts.', 9],
  [0, 'Build Kanban drag-and-drop', 'in_review', 'urgent', 1, 100,
    'Native HTML5 drag-and-drop with a keyboard-accessible status select as fallback.', 1],
  [0, 'Add overdue task filtering', 'in_progress', 'medium', 3, 200,
    'Filter bar on the My Tasks page needs an "overdue only" toggle.', 2],
  [0, 'Polish empty states across the app', 'in_progress', 'low', 8, 300,
    'Every list needs a friendly empty state with a call to action.', 1],
  [0, 'Audit color contrast for WCAG AA', 'todo', 'medium', 12, 100,
    'Run the palette through a contrast checker, fix any text below 4.5:1.'],
  [0, 'Reduce initial bundle size', 'todo', 'low', 20, 200,
    'Check what Vite is shipping; consider lazy-loading routes.'],
  [0, 'Prepare v1.1 release notes', 'todo', 'low', 25, 300, ''],

  // --- Marketing Site ---
  [1, 'Copy for the homepage hero', 'done', 'high', -4, 100,
    'Short, benefit-first headline plus a single supporting sentence.', 6],
  [1, 'SEO metadata for all pages', 'done', 'medium', 5, 200,
    'Title tags, descriptions and Open Graph images for every page.', 4],
  [1, 'Screenshot carousel for features page', 'in_progress', 'medium', 2, 100,
    'Six product screenshots with short captions.', 1],
  [1, 'Set up contact form endpoint', 'todo', 'low', 15, 300, ''],
  [1, 'Fix mobile navigation overlap', 'todo', 'urgent', -2, 400,
    'The hamburger menu overlaps the logo on screens under 360px wide.'],

  // --- Mobile App v2 ---
  [2, 'Choose navigation architecture', 'done', 'high', 0, 100,
    'Bottom tabs win: simpler, thumb-reachable, fewer nested screens.', 2],
  [2, 'Push notification prototypes', 'done', 'medium', 10, 200,
    'Three prototypes reviewed; the digest model tested best.', 2],
  [2, 'Offline caching for task lists', 'in_progress', 'urgent', 4, 100,
    'Cache the last fetched board so the app opens instantly on flaky connections.', 1],
  [2, 'Biometric unlock screen', 'in_review', 'low', 30, 200,
    'Face ID and fingerprint, with a PIN fallback.', 3],
  [2, 'Dark mode audit on small screens', 'todo', 'medium', -4, 300,
    'Contrast and touch targets below 400px need a pass.'],

  // --- Platform & Infra ---
  [3, 'Set up automated database backups', 'done', 'urgent', -7, 100,
    'Nightly pg_dump to object storage with 14-day retention.', 8],
  [3, 'Migrate logging to structured JSON', 'done', 'medium', 22, 200,
    'One line per event, request ids included, shipped to the aggregator.', 2],
  [3, 'Write deployment runbook', 'done', 'medium', 6, 100,
    'Step-by-step deploy doc so anyone on the team can ship.', 0],
  [3, 'Add rate limiting to auth endpoints', 'in_progress', 'high', 9, 200,
    'Throttle repeated failed logins per IP and per account.', 5],
  [3, 'Review cloud cost dashboard', 'todo', 'low', 28, 100, ''],
  [3, 'Patch PostgreSQL minor version', 'todo', 'urgent', -1, 300,
    'Security patch released upstream — schedule the maintenance window.'],
];

// Comments: [projectIndex, taskTitle, content, daysAgo]
const COMMENTS = [
  [0, 'Build Kanban drag-and-drop', 'Movement between columns feels smooth now. The insertion indicator makes drop targets obvious.', 2],
  [0, 'Build Kanban drag-and-drop', 'Do we persist the column position too, or just the status? Recruiters will notice if cards snap back to the end.', 1],
  [0, 'Implement session persistence', 'Confirmed: sessions survive a server restart since they live in the sessions table.', 7],
  [1, 'Fix mobile navigation overlap', 'Reproduced on a 360px viewport. Z-index issue with the header, patch incoming.', 1],
  [2, 'Offline caching for task lists', 'Stale-while-revalidate seems like the right model. Board renders from cache, then refreshes.', 3],
  [3, 'Patch PostgreSQL minor version', 'Window scheduled for tonight 02:00 UTC. Backups verified first.', 0],
];

async function main() {
  const existing = await query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (existing.length > 0) {
    console.log(`Demo user ${DEMO_EMAIL} already exists — seeding skipped.`);
    console.log('Run `npm run db:reset` first if you want a fresh database.');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, created_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Demo User', DEMO_EMAIL, passwordHash, pastStamp(45)]
    );
    const userId = userResult.rows[0].id;

    // projectIndex -> database id
    const projectIds = [];
    const projects = [
      ['Aurora Web App', 'The flagship web product: dashboard, boards and task management.', '#2DD4BF', 40],
      ['Marketing Site', 'Public website: homepage, feature pages and SEO work.', '#4A9DE0', 32],
      ['Mobile App v2', 'Second major release of the mobile client with offline support.', '#E0A23C', 26],
      ['Platform & Infra', 'Backend, database and deployment work that keeps everything running.', '#8A8A8F', 60],
    ];
    for (const [name, description, color, createdDaysAgo] of projects) {
      const result = await client.query(
        `INSERT INTO projects (user_id, name, description, color, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
        [userId, name, description, color, pastStamp(createdDaysAgo)]
      );
      projectIds.push(result.rows[0].id);
    }

    const taskIdByTitle = new Map();
    for (const [projectIndex, title, status, priority, deadline, position, description, completedDaysAgo] of TASKS) {
      const createdDaysAgo = Math.max(
        3 + (deadline < 0 ? -deadline : 12) + (position % 3),
        (completedDaysAgo ?? 0) + 3 // created comfortably before it was finished
      );
      // Done tasks get their back-dated completion moment; a small hour
      // offset keeps multiple same-day completions in a believable order.
      const updatedDaysAgo = completedDaysAgo ?? Math.max(0, createdDaysAgo - 2);
      const hourOffset = position % 5;
      const result = await client.query(
        `INSERT INTO tasks (project_id, title, description, status, priority, deadline, position, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          projectIds[projectIndex], title, description, status, priority,
          deadline === null ? null : daysFromNow(deadline), position,
          pastStamp(createdDaysAgo), pastStamp(updatedDaysAgo, hourOffset),
        ]
      );
      taskIdByTitle.set(title, result.rows[0].id);
    }

    for (const [projectIndex, title, content, daysAgo] of COMMENTS) {
      await client.query(
        `INSERT INTO comments (task_id, author_id, content, created_at)
         VALUES ($1, $2, $3, $4)`,
        [taskIdByTitle.get(title), userId, content, pastStamp(daysAgo)]
      );
    }

    console.log(`Seeded 1 demo user, ${projects.length} projects, ${TASKS.length} tasks, ${COMMENTS.length} comments.`);
  });

  console.log('');
  console.log('  Demo login (demo account only):');
  console.log(`    email:    ${DEMO_EMAIL}`);
  console.log(`    password: ${DEMO_PASSWORD}`);
  console.log('');
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error('Seeding failed:', error.message || error);
    pool.end().then(() => process.exit(1));
  });

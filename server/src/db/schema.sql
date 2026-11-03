-- ============================================================
-- SprintBoard database schema
-- Run by src/db/setup.js inside the "sprintboard" database.
--
-- Design notes:
-- - All ids are SERIAL (auto-incrementing integers): easy to read and debug.
-- - Every child row references its parent with ON DELETE CASCADE, so
--   deleting a project removes its tasks and their comments automatically.
-- - status / priority are constrained by CHECK constraints at the DB level,
--   so invalid values can never be stored even if app validation missed one.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  color       VARCHAR(7)  NOT NULL DEFAULT '#7B8CFF', -- hex color like #7B8CFF
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       VARCHAR(140) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  status      VARCHAR(20)  NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  priority    VARCHAR(10)  NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  deadline    DATE,                              -- nullable: not every task has one
  position    REAL         NOT NULL DEFAULT 0,   -- sort order inside a Kanban column
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER       NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);

-- Sessions (express-session + connect-pg-simple). Declared here so a fresh
-- `npm run db:setup` produces a complete database; the session store's own
-- auto-creation stays enabled as a safety net.
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar       NOT NULL,
  "sess"   json          NOT NULL,
  "expire" timestamp(6)  NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

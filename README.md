# SprintBoard

A focused project-management and issue-tracking application with a polished
dark interface — projects, tasks, Kanban boards with drag-and-drop, deadlines,
priorities, comments and a live dashboard. Built as a complete, realistic
full-stack portfolio project.

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="SprintBoard dashboard" width="820" />
</p>

| | |
|---|---|
| ![Board](docs/screenshots/board.png) | ![Projects](docs/screenshots/projects.png) |
| *Kanban board with drag-and-drop* | *Project overview with live progress* |

---

## Features

**Authentication**
- Register, log in, log out; persistent sessions stored in PostgreSQL
- Passwords hashed with bcrypt (never stored in plaintext)
- Every route and every row of data is protected per user

**Dashboard**
- Live statistics from the database: projects, tasks, completed, in-flight, overdue
- Completion percentage with a progress bar
- "Recent activity" feed of the most recently updated tasks

**Projects**
- Full CRUD with name, description, color and per-project progress
- Each project gets its own Kanban board

**Tasks**
- Full CRUD with title, description, priority (Low → Urgent), deadline and status
- Kanban board: **Todo → In Progress → In Review → Done**
- Drag-and-drop between columns **plus** an accessible dropdown alternative
- Column positions persist (fractional-position ordering) in PostgreSQL

**Search & filtering**
- Search tasks by title (debounced as you type)
- Filter by status, priority, or "overdue only"
- Sort by creation date, deadline or priority

**Comments**
- Comment threads on every task with author and timestamps

**Polish**
- Original dark visual identity (custom CSS, no UI framework)
- Loading, empty, error and success (toast) states everywhere
- Fully responsive: desktop, tablet and mobile (off-canvas sidebar)

## Technologies

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite | Fast dev experience, standard modern tooling |
| Routing | React Router 7 | Client-side routes with protected-route gating |
| Styling | Custom CSS (design tokens) | Full control, zero framework weight |
| Backend | Node.js + Express 5 | Simple, well-documented HTTP API |
| Database | PostgreSQL + `pg` | Relational data, parameterized SQL |
| Sessions | `express-session` + `connect-pg-simple` | Server-side sessions that survive restarts |
| Passwords | `bcryptjs` | Pure-JS bcrypt (no native build step) |
| Icons | `lucide-react` | Free, tree-shakeable SVG icons |
| Testing | Jest + Supertest | API integration tests against a real test database |
| Local DB | `embedded-postgres` (dev only) | Real PostgreSQL 17 binaries, no system install or root needed |

No paid services, APIs or accounts are required. Everything runs locally.

## Screenshots

| Dashboard | Kanban board |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Board](docs/screenshots/board.png) |

| All tasks (overdue filter) | Mobile board |
|---|---|
| ![Tasks](docs/screenshots/tasks.png) | ![Mobile](docs/screenshots/mobile-board.png) |

## Quick start

Prerequisites: **Node.js 18+** and npm. (No PostgreSQL install needed —
see "How the database runs" below.)

```bash
# 1. Install dependencies (root, server and client)
npm install && npm install --prefix server && npm install --prefix client

# 2. Configure environment (a ready dev .env ships in server/.env)
cp server/.env server/.env            # or edit server/.env values

# 3. Create the schema + seed realistic demo data
npm run db:setup
npm run db:seed

# 4. Run everything (embedded PostgreSQL + API + frontend)
npm run dev
```

Then open **http://localhost:5173**.

> If npm blocks install scripts (`embedded-postgres`, `esbuild`), approve and
> rebuild once:
> ```bash
> npm install-scripts approve @embedded-postgres/linux-x64 && npm rebuild --prefix server @embedded-postgres/linux-x64
> npm install-scripts approve esbuild && npm rebuild --prefix client esbuild
> ```

### Demo credentials

> **Demo account — for trying the app only.** Never use these credentials
> anywhere real; they are public and the data is disposable seed data.

```
email:    demo@sprintboard.app
password: demo1234
```

The login page also has a one-click **"Sign in as Demo User"** button.
Reseed any time with `npm run db:reset && npm run db:seed`.

## How the database runs (zero-install PostgreSQL)

`server/scripts/postgres.js` starts **real PostgreSQL 17 binaries** shipped by
the `embedded-postgres` npm package, running as your own user with its data
directory in `server/.pgdata` (gitignored). The application itself only sees
an ordinary PostgreSQL server through `DATABASE_URL` — nothing in the app code
knows about the embedded setup.

Prefer a real install, Docker or a free hosted database (e.g. Neon)? Just
change `DATABASE_URL` in `server/.env`:

```
DATABASE_URL=postgres://user:password@host:5432/sprintboard
```

…then run `npm run db:setup && npm run db:seed` against it. Everything else
works identically.

## Environment variables

Copy `server/.env.example` to `server/.env` (a working development copy is
already included):

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://sprintboard:sprintboard_dev_password@localhost:54329/sprintboard` |
| `SESSION_SECRET` | Secret used to sign session cookies | a long random string (`openssl rand -hex 32`) |
| `PORT` | API port (Vite proxies `/api` here in dev) | `3001` |
| `NODE_ENV` | `development` / `production` / `test` | `development` |

## npm scripts

| Where | Script | What it does |
|---|---|---|
| root | `npm run dev` | Starts embedded PostgreSQL + API (watch mode) + Vite dev server together |
| root | `npm run db:setup` | Creates the database and applies the schema |
| root | `npm run db:seed` | Inserts the demo user + sample data |
| root | `npm run db:reset` | Drops and recreates an empty database |
| root | `npm test` | Runs the backend test suite |
| root | `npm run build` | Production build of the React app into `client/dist` |
| root | `npm start` | Runs the API server (serves the built app in production) |
| server | `npm run postgres` (`keep`/`ensure`) | Starts embedded PostgreSQL (foreground / background-if-needed) |

## Testing

```bash
npm test          # from the repository root (or: npm test --prefix server)
```

The suite (39 tests, 5 files) runs against a separate `sprintboard_test`
database that is created and schema-initialized automatically:

- **auth.test.js** — registration (hashing verified in the DB), duplicate email, login success/failure, session restore, logout invalidation
- **projects.test.js** — full CRUD, partial PATCH, validation errors, 401 protection
- **tasks.test.js** — CRUD, Kanban status+position persistence (read back from the DB), search/status/priority/overdue filters, priority sorting
- **ownership.test.js** — a second user gets 404 on every attempt to read, modify or delete the first user's project, task or comments
- **comments.test.js** — create/list comments, author info, length validation

## Production build & run

```bash
npm run build    # builds client/dist
npm start        # Express serves the API + the built frontend on PORT (3001)
```

One process now serves everything at `http://localhost:3001` — the API under
`/api`, and the SPA with client-side routing fallback for any other GET.

## Deployment (free tiers)

The app is a standard Express + PostgreSQL deployment:

1. **Database** — create a free PostgreSQL database (e.g. [Neon](https://neon.tech),
   [Supabase](https://supabase.com) or [Aiven](https://aiven.io) free tiers)
   and run the schema (`server/src/db/schema.sql`) on it.
2. **App** — deploy `server/` to any Node host with a free tier
   (Render, Railway, Fly.io, Koyeb). Set the environment variables:
   - `DATABASE_URL` (the hosted database URL, with `?sslmode=require` if the provider asks)
   - `SESSION_SECRET` (a fresh random value)
   - `NODE_ENV=production`
3. **Build step** — install the client dependencies and run `npm run build`;
   the server serves `client/dist` automatically. Or use two services
   (static host for the client + API host) with the Vite build pointing at
   the API URL.
4. HTTPS is provided by the platform; the session cookie is marked `secure`
   automatically in production and `trust proxy` is enabled for correct
   headers behind the platform's proxy.

The embedded PostgreSQL is a *local development convenience only* — do not
use it in deployment; free hosted PostgreSQL takes its place.

## API overview

All endpoints are JSON under `/api`. Authentication uses an httpOnly session
cookie; every route except `register`/`login` requires it, and every resource
is scoped to the logged-in user.

| Method | Endpoint | Description | Success |
|---|---|---|---|
| POST | `/api/auth/register` | Create account (name, email, password) | 201 |
| POST | `/api/auth/login` | Log in | 200 |
| POST | `/api/auth/logout` | Destroy session | 204 |
| GET | `/api/auth/me` | Current user from session | 200 |
| GET | `/api/dashboard` | Stats + recent activity | 200 |
| GET | `/api/projects` | List projects with task counts | 200 |
| POST | `/api/projects` | Create project | 201 |
| GET | `/api/projects/:id` | One project | 200 |
| PATCH | `/api/projects/:id` | Update fields (partial) | 200 |
| DELETE | `/api/projects/:id` | Delete project + cascade tasks/comments | 204 |
| GET | `/api/projects/:id/tasks` | Board column data for one project | 200 |
| GET | `/api/tasks` | All tasks; `?search=&status=&priority=&overdue=&sort=` | 200 |
| POST | `/api/tasks` | Create task (`projectId` in body) | 201 |
| GET | `/api/tasks/:id` | Task with project info | 200 |
| PATCH | `/api/tasks/:id` | Update fields incl. `status`/`position` (Kanban moves) | 200 |
| DELETE | `/api/tasks/:id` | Delete task | 204 |
| GET | `/api/tasks/:id/comments` | List comments | 200 |
| POST | `/api/tasks/:id/comments` | Add comment | 201 |

Errors always return `{ "error": "message" }` (plus `"details": { field: "message" }`
for validation failures) with proper status codes: 400 validation, 401 no
session, 404 missing **or not yours**, 409 duplicate email, 500 unexpected.

## Database schema

```
users (1) ──< projects (1) ──< tasks (1) ──< comments
              (user_id)       (project_id)   (task_id, author_id → users)
```

| Table | Columns |
|---|---|
| `users` | `id` PK, `name`, `email` UNIQUE, `password_hash`, `created_at` |
| `projects` | `id` PK, `user_id` FK→users ON DELETE CASCADE, `name`, `description`, `color`, timestamps |
| `tasks` | `id` PK, `project_id` FK→projects ON DELETE CASCADE, `title`, `description`, `status` CHECK, `priority` CHECK, `deadline` DATE, `position` REAL, timestamps |
| `comments` | `id` PK, `task_id` FK→tasks ON DELETE CASCADE, `author_id` FK→users, `content`, `created_at` |
| `session` | server-side sessions (`sid`, `sess`, `expire`) — declared in `schema.sql`, used by connect-pg-simple |

Design notes:
- `ON DELETE CASCADE` everywhere: deleting a project removes its tasks and
  their comments in one statement.
- `status` and `priority` are constrained at the database level, so invalid
  values can never be stored even if application validation missed one.
- `deadline` is a plain DATE; "overdue" is computed in SQL as
  `deadline < CURRENT_DATE AND status <> 'done'`.
- `position` is a float used for Kanban ordering — moving a card stores the
  midpoint between its new neighbours (see `BoardPage.jsx`).

## Repository structure

```
SprintBoard/
├── package.json              # root scripts (dev, db setup, test, build)
├── docs/screenshots/         # README screenshots
├── server/
│   ├── scripts/postgres.js   # embedded PostgreSQL runner (dev only)
│   └── src/
│       ├── index.js          # entry: loads .env, starts listening
│       ├── app.js            # Express app factory (middleware, sessions, static)
│       ├── routes/index.js   # every endpoint in one table-of-contents file
│       ├── controllers/      # request → validate → service → response
│       ├── services/         # ALL SQL lives here (parameterized)
│       ├── middleware/       # requireAuth, central error handler
│       ├── utils/            # HttpError + input validators
│       ├── db/               # pool, schema.sql, setup/reset/seed scripts
│       └── tests/            # Jest + Supertest suite (sprintboard_test DB)
└── client/
    └── src/
        ├── api/client.js     # fetch wrapper + ApiError handling
        ├── context/          # Auth, Toast, Projects providers
        ├── components/       # layout, modals, drawer, cards, states…
        ├── pages/            # Login, Register, Dashboard, Projects, Board, Tasks
        └── styles/           # base tokens, components, pages (custom CSS)
```

## Learning

**[LEARNING_GUIDE.md](LEARNING_GUIDE.md)** explains the whole architecture:
how the pieces communicate, how auth and sessions work step by step, how the
Kanban drag-and-drop persists, how ownership is enforced, a codebase tour,
interview questions, and a suggested order for rebuilding it yourself.

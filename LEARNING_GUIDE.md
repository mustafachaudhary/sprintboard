# SprintBoard — Learning Guide

This guide explains how every part of SprintBoard works and why it was built
that way. Read it with the code open next to you. Sections build on each
other, but each one links to the exact files you should have open.

---

## Table of contents

1. [The big picture](#1-the-big-picture)
2. [How the frontend talks to the backend](#2-how-the-frontend-talks-to-the-backend)
3. [How the React app is organized](#3-how-the-react-app-is-organized)
4. [How state management works](#4-how-state-management-works)
5. [Authentication, step by step](#5-authentication-step-by-step)
6. [How sessions work](#6-how-sessions-work)
7. [Express routes and middleware](#7-express-routes-and-middleware)
8. [How the PostgreSQL tables relate](#8-how-the-postgresql-tables-relate)
9. [How CRUD operations work](#9-how-crud-operations-work)
10. [How Kanban drag-and-drop is saved](#10-how-kanban-drag-and-drop-is-saved)
11. [Anatomy of an API request and response](#11-anatomy-of-an-api-request-and-response)
12. [How authorization prevents data leaks](#12-how-authorization-prevents-data-leaks)
13. [Validation and error handling](#13-validation-and-error-handling)
14. [How to debug the application](#14-how-to-debug-the-application)
15. [Codebase tour](#15-codebase-tour)
16. [Interview preparation](#16-interview-preparation)
17. [Build it yourself](#17-build-it-yourself)

---

## 1. The big picture

SprintBoard is a classic three-tier web application:

```
┌─────────────────────┐        HTTP + JSON          ┌─────────────────────┐         SQL          ┌──────────────┐
│  React (client/)    │ ──────────────────────────▶ │  Express (server/)  │ ───────────────────▶ │  PostgreSQL  │
│  "what you see"     │ ◀────────────────────────── │  "decides + checks" │ ◀─────────────────── │  "remembers" │
└─────────────────────┘        HTTP + JSON          └─────────────────────┘         rows         └──────────────┘
       Vite dev server :5173            Express API :3001                 embedded/real Postgres
```

- **The frontend** never talks to the database. It only sends HTTP requests
  to `/api/...` endpoints and renders whatever JSON comes back.
- **The backend** owns every rule that matters: who is logged in, who owns
  which row, what counts as valid input. It is the only process that runs SQL.
- **PostgreSQL** stores users, projects, tasks, comments *and the sessions*.

Why this shape? Because it matches how real products are built and hosted:
the frontend is static files (cheap to serve anywhere), the backend is one
Node process, and the database is a managed service. Each tier can be
replaced or scaled independently.

**One important detail:** in production, Express *also* serves the built
frontend (`client/dist`) — one process, one port. In development, Vite serves
the frontend on 5173 and forwards `/api/*` requests to Express on 3001. See
`client/vite.config.js` (`server.proxy`) and `server/src/app.js`
(`express.static` + SPA fallback).

### The embedded PostgreSQL trick

`server/scripts/postgres.js` is dev-only tooling. It runs real PostgreSQL 17
binaries (from the `embedded-postgres` npm package) as your user, with data
in `server/.pgdata`. **The application code has no idea this exists** — it
just connects to `DATABASE_URL` like it would to any Postgres server. If you
swap in a Docker container or a hosted free tier, zero app code changes.

## 2. How the frontend talks to the backend

Open `client/src/api/client.js`. Every network call in the app goes through
one function, `request(method, url, body)`:

```js
const response = await fetch(url, options);   // browser sends the session cookie automatically
```

It does four jobs:

1. **Serializes** the body to JSON and sets `Content-Type`.
2. **Parses** the response (204 means "no content" — return `null`).
3. **Converts errors**: a non-2xx response becomes a thrown `ApiError`
   carrying `status`, `message` and optional `details` (per-field validation
   errors). UI code can catch it and show the right thing.
4. **Notifies on session death**: if any protected call gets a 401, it calls
   the `onUnauthorized` handler, which `AuthContext` registered — clearing the
   user so the protected routes redirect to `/login`.

Then it exports tiny helpers: `api.get(url)`, `api.post(url, body)`,
`api.patch(url, body)`, `api.delete(url)`.

**Why a wrapper instead of raw `fetch` everywhere?** One place to add headers,
one error format, one place to handle "session expired". If you later add
retries, loading flags or auth tokens, you change one file.

## 3. How the React app is organized

Open `client/src/`.

```
main.jsx            → mounts React, wires providers: Router > Auth > Toast
App.jsx             → the route table + route guards
context/            → global state (who is logged in, projects cache, toasts)
components/         → reusable pieces (Modal, Badges, TaskCard, TaskDetail…)
pages/              → one component per URL, they own data fetching
styles/             → plain CSS, design tokens in base.css
utils/format.js     → date/label helpers (no state)
hooks/useDebounce.js→ one custom hook (search input)
api/client.js       → the fetch wrapper (section 2)
```

**Pages vs components:** a *page* owns a URL and its data loading
(DashboardPage fetches `/api/dashboard`). A *component* is presentational or
tightly scoped (TaskModal handles one form). If a piece would be useful on
two pages, it lives in `components/`.

**Routing** (`App.jsx`) has three kinds of routes:

- `PublicOnlyRoute` → `/login`, `/register` (logged-in users get bounced to `/`)
- `ProtectedRoute` → everything else, wrapped in `AppLayout` (sidebar + topbar)
- `*` → redirect home

`ProtectedRoute` reads `user` from AuthContext. While the first session check
is still running (`initializing === true`) it renders a spinner instead of the
login page — that prevents the "flash of login screen" on refresh.

**Nesting:** all private pages render inside `AppLayout`'s `<Outlet/>`, so the
sidebar/topbar exist once and every page just renders its content.

## 4. How state management works

There is deliberately **no Redux/Zustand**. State lives in three places:

**1. Component state (`useState`) — the default.**
Form values, open/closed modals, drag state. If only one component cares,
keep it local (see `ProjectModal.jsx`).

**2. Context for genuinely global state** — `client/src/context/`:

| Context | Holds | Used by |
|---|---|---|
| `AuthContext` | `user`, `initializing`, `login/register/logout` | App.jsx guards, Sidebar, pages |
| `ProjectsContext` | the project list + `taskVersion` counter | Sidebar, ProjectsPage, TaskModal, BoardPage, TasksPage |
| `ToastContext` | toast queue + `showToast()` | any component that reports success/error |

`ProjectsContext` is the most interesting one (`context/ProjectsContext.jsx`).
Several UI areas need the project list, so it is fetched **once** and shared.
It also solves a cross-page refresh problem: when you create a task from the
top bar while the Kanban board is open, the board needs to know. It calls
`bumpTaskVersion()` — a number in context — and every page whose fetch
`useEffect` depends on `taskVersion` re-fetches automatically:

```js
useEffect(() => { load(); }, [load, taskVersion]);
```

This is a simple "version key" pattern: instead of two components talking to
each other, they both watch a shared counter.

**3. Server state — fetched fresh.** Lists on pages are always re-fetched
from the API; the client never invents data. After a mutation, pages either
re-fetch (TasksPage) or patch the local array with the server's response
(BoardPage's `handleTaskSaved`) — and in both cases the DB remains the truth.

## 5. Authentication, step by step

Open these: `server/src/controllers/auth.controller.js`,
`server/src/middleware/auth.js`, `client/src/context/AuthContext.jsx`.

**Registering**

1. User submits the form → `AuthContext.register()` → `POST /api/auth/register`
   with `{ name, email, password }`.
2. `validateRegistration` (server/src/utils/validation.js) trims inputs and
   checks shape. Bad input → `400` with `details: { field: message }`.
3. The controller checks the email is not taken (`409` otherwise).
4. `bcrypt.hash(password, 10)` — the plaintext password exists only in this
   function's memory. bcrypt adds a random salt and runs 10 rounds; the
   stored `password_hash` looks like `$2b$10$...` and cannot be reversed.
5. `users.createUser(...)` inserts the row (SQL in `services/users.js`).
6. `req.session.userId = user.id` — **this line logs the user in** (see §6).
7. Response: `201 { user }` (no hash!) + `Set-Cookie` header.

**Logging in**

1. `POST /api/auth/login` → find user by email.
2. `bcrypt.compare(password, user.passwordHash)` — bcrypt re-hashes the
   attempt with the stored salt and compares in constant time.
3. On failure: `401 "Incorrect email or password."` — the **same** message for
   "no such user" and "wrong password", so attackers can't probe which emails
   are registered.
4. On success: same `req.session.userId = user.id` as register.

**Every request after that**

1. The browser attaches the session cookie automatically.
2. `requireAuth` middleware (mounted in `routes/index.js` after the public
   auth routes) reads `req.session.userId`, loads the user from the DB,
   attaches it as `req.user`, and continues — or throws `401`.
3. Controllers only ever use `req.user.id`, never anything the client claims
   about who they are.

**On the client**: `AuthContext` runs `GET /api/auth/me` once on page load.
200 → session still valid, user restored (that's why refreshing keeps you
logged in). 401 → not logged in. Login/register just set this same context.

**Logging out**: `POST /api/auth/logout` → `req.session.destroy()` deletes the
session row; the cookie becomes useless even if it still exists in the
browser. Client clears `user` state.

## 6. How sessions work

Open `server/src/app.js` (the `session({...})` block) and
`server/src/db/schema.sql` (no sessions table — it's auto-created).

- `express-session` creates a session object per visitor, stored **in
  PostgreSQL** via `connect-pg-simple` (table `session`: one row per session,
  containing `sid`, the JSON `sess`, and `expire`).
- The browser never receives the session contents — only `Set-Cookie:
  sprintboard.sid=s%3A<random>.<signature>`, which is an **id + HMAC
  signature**. The signature (made with `SESSION_SECRET`) means a tampered
  cookie is rejected without even hitting the DB.
- Because `httpOnly: true` is set, JavaScript on the page **cannot read the
  cookie** — an XSS attack can't steal the session. `sameSite: 'lax'` blocks
  most CSRF (other sites can't trigger authenticated POSTs), and
  `secure: 'auto'` marks it HTTPS-only in production.
- Storing sessions in the database (instead of server memory) means: restart
  the server and nobody gets logged out; run multiple server processes and
  they all share the same sessions. That's exactly what real apps do.

The session only stores `userId` — one small field. Everything else (name,
email) is read fresh from `users` on each request, so renaming yourself takes
effect immediately.

## 7. Express routes and middleware

Open `server/src/routes/index.js` — it is the entire API surface, and it
shows the middleware idea perfectly:

```js
router.post('/auth/register', auth.register);   // public
router.post('/auth/login',    auth.login);      // public

router.use(requireAuth);                        // ← everything below is protected

router.get('/dashboard', dashboard.getDashboard);
router.get('/projects', projects.list);
...
```

`router.use(requireAuth)` is a "gate" in the middle of the file: any request
matching a route registered after that line must pass `requireAuth` first.
Middleware is just functions with the signature `(req, res, next)` that either
call `next()` to continue or throw/respond to stop.

The full request pipeline (all defined in `app.js`):

```
request
 → express.json()               parse JSON bodies (400 on malformed JSON)
 → session middleware           load/create session from the cookie
 → express.static(...)          serve built frontend files
 → routes/index.js              API: requireAuth gate → controller
 → SPA fallback                 GET /something → client/dist/index.html
 → notFound                     404 for unknown API routes
 → errorHandler                 the single exit point for every error
```

Each **controller** follows the same three-beat rhythm — see
`controllers/tasks.controller.js`:

```js
const result = validateTaskUpdate(req.body);   // 1. validate input
if (!result.valid) throw new HttpError(400, ..., result.errors);
const task = await tasks.updateTask(...);       // 2. call a service (SQL)
if (!task) throw new HttpError(404, ...);
res.json({ task });                             // 3. respond
```

Controllers never write SQL; **services** (`services/*.js`) own all queries.
That separation means you can read every SQL statement in one folder, and
controllers stay focused on HTTP.

## 8. How the PostgreSQL tables relate

Open `server/src/db/schema.sql`.

```
users ──1:N──▶ projects ──1:N──▶ tasks ──1:N──▶ comments
   ▲              (user_id)       (project_id)    (task_id)
   └───────────────────────────── author_id ───────┘
```

- Every child row holds a **foreign key** to its parent, and every FK says
  `ON DELETE CASCADE`: remove a project → its tasks vanish → their comments
  vanish. No orphan rows, no manual cleanup, all enforced *by the database*.
- `users.email` has a `UNIQUE` constraint — the DB itself rejects duplicates.
- `tasks.status` / `tasks.priority` have `CHECK` constraints listing the
  allowed values. Even a bug that tried to save `status='banana'` would be
  rejected by Postgres.
- Indexes (`idx_tasks_project_id` etc.) keep lookups fast as data grows.
- `tasks.position` is `REAL` (a float) — see §10 for why.
- The `session` table is created automatically by the session store.

**How to see it yourself:**

```bash
psql "postgres://sprintboard:sprintboard_dev_password@localhost:54329/sprintboard"
\dt                              -- list tables
SELECT * FROM tasks LIMIT 5;     -- peek at data
```

## 9. How CRUD operations work

Each entity follows the same layered flow — here is "update a task" end to end:

```
UI (TaskDetail drawer, Save)
  → api.patch(`/api/tasks/${id}`, form)          client/src/api/client.js
  → PATCH /api/tasks/:id                         routes/index.js (requireAuth ran first)
  → tasks.update (controller)                    validate → call service → respond
  → tasks.updateTask (service)                   build UPDATE ... SET ... WHERE id=$n AND owner
  → PostgreSQL row updated, RETURNING new row
  → { task } JSON back → page state updated → toast
```

Reading it in the code:

- **Create**: `controllers/*.controller.js` validate → `services/*.createX`
  uses `INSERT ... RETURNING` so the DB hands back the full new row (including
  its generated `id`).
- **Read**: `GET /api/tasks` accepts query params (`?search=&status=...`).
  The service builds the WHERE clause from *whitelisted* options and passes
  every value as a numbered placeholder `$1, $2...` — never string
  concatenation (that's how SQL injection happens).
- **Update**: `buildUpdateSet` (services/projects.js, services/tasks.js)
  dynamically builds `SET name = $1, color = $2 ...` but only for fields the
  request actually provided — so `PATCH { name }` changes only the name.
- **Delete**: `DELETE ... RETURNING id` — if zero rows came back, nothing
  matched (wrong id or not yours) and the controller returns 404.

**The dashboard** (`services/stats.js`) is a nice SQL study: it uses
`COUNT(*) FILTER (WHERE ...)` to compute total/completed/pending/overdue in
**one query**, plus a subquery for the project count. Nothing is counted in
JavaScript — the database is the calculator.

## 10. How Kanban drag-and-drop is saved

Open `client/src/pages/BoardPage.jsx` (the `moveTask` function) and
`client/src/components/TaskCard.jsx`.

**The drag side** uses the browser's native HTML5 drag events — no library:

1. Each card has `draggable` and `onDragStart`, which stores the task id:
   `event.dataTransfer.setData('text/plain', String(task.id))`.
2. Columns track hover state (`onDragEnter`/`onDragLeave`/`onDragOver`) to
   highlight themselves (`.column--drag-over`).
3. `onDrop` on the column reads the id back and calls `moveTask(taskId, newStatus)`.

**The persistence problem:** SQL `ORDER BY` needs a sort key, but you don't
want to rewrite the position of every card in a column each time one moves.
The trick used here: `position` is a **float**, and a moved card takes the
*midpoint between its new neighbours*:

```
Before:  A=100, B=200, C=300        drag B between A and C
After:   A=100, C=250, B=...        wait — we compute B's new position = (100 + 300) / 2 = 200
```

Only **one row** changes, no matter how long the column is. New cards get
`MAX(position) + 100`. Floats give you ~7 million midpoint insertions before
precision runs out — far beyond any real board.

**Optimistic UI:** `moveTask` updates React state *first* (the card appears
in the new column instantly), then PATCHes `{ status, position }`. If the
request fails, it restores the pre-drag snapshot (`setTasks(snapshot)`) and
shows an error toast — the UI never lies quietly.

**The accessible alternative:** cards are real `<button>`s (focusable,
Enter/Space opens details), and the TaskDetail drawer has a plain status
`<select>` that PATCHes status the same way. Keyboard/screen-reader users are
never blocked by drag-only UI.

**Also tested automatically:** `tests/tasks.test.js` includes a "moves a task
between Kanban columns" test that PATCHes `{status, position}` and then reads
the task back from the DB to prove it persisted.

## 11. Anatomy of an API request and response

Let's fully trace "create a task from the top bar":

```
1. TaskModal form submitted
   POST /api/tasks  body: {"title":"Ship it","projectId":5,"priority":"high",...}

2. Vite proxy (dev) forwards localhost:5173/api/* → localhost:3001

3. express.json() parses the body into req.body

4. session middleware finds the user via the cookie

5. routes/index.js: matches POST /tasks (behind requireAuth)

6. tasks.create controller:
   - validateTask()         → title required, priority in enum, date format…
   - projects.getProjectById(projectId, req.user.id)   → is this MY project?
   - tasks.createTask()     → INSERT ... RETURNING

7. Response: 201
   {"task":{"id":41,"title":"Ship it","status":"todo","priority":"high",
            "deadline":null,"position":100,...}}

8. TaskModal calls onSaved → BoardPage appends the task to its state
   → ProjectsContext.bumpTaskVersion() tells other open pages to refresh
```

Conventions to notice:

- **Success responses wrap data in a named key** (`{user}`, `{projects}`,
  `{task}`, `{stats, recentTasks}`) — self-documenting and easy to extend.
- **Errors** are always `{"error": "message"}` (+ `details` for field errors).
- **Status codes mean things**: 201 created, 204 deleted, 400 bad input,
  401 not logged in, 404 missing-or-not-yours, 409 conflict, 500 oops.

## 12. How authorization prevents data leaks

The rule: **ownership is part of every SQL WHERE clause.** There is no
separate "check permission" step to forget.

Look at `services/tasks.js`:

```js
SELECT t.*, p.name AS "projectName" ...
FROM tasks t JOIN projects p ON p.id = t.project_id
WHERE t.id = $1 AND p.user_id = $2      -- ← ownership lives here
```

A task has no `user_id` column — its owner is *reached through* its project.
So every task query joins `projects` and filters on `p.user_id`. Same for
comments (via their task → project). This means:

- User B requesting user A's task id → the query matches **zero rows** →
  controller returns **404**, not 403. Why 404? Because "403 Forbidden"
  confirms the resource exists; "404 Not Found" reveals nothing. Security
  through indistinguishability.
- `POST /api/tasks` validates that the target `projectId` belongs to the user
  before inserting — you can't create a task inside someone else's project.
- Writes follow the same pattern: `UPDATE ... WHERE t.id = $1 AND p.user_id = $2`.

`tests/ownership.test.js` proves all of this: user B attempts to read, patch,
delete and comment on user A's resources — every attempt must be 404, and
`GET /api/tasks` must never include A's rows.

## 13. Validation and error handling

**Validation happens twice, on purpose:**

1. **Client-side** (RegisterPage's `validate()`, maxLength attributes,
   required selects) — instant feedback, fewer round trips. UX only.
2. **Server-side** (`server/src/utils/validation.js`) — the authority. The
   server never trusts the client: curl can POST anything, so every endpoint
   re-checks everything before touching the DB.

Each validator returns either `{valid: true, values}` (with trimmed/cleaned
input — e.g. email lowercased) or `{valid: false, errors: {field: message}}`.
Controllers turn `errors` into `400` + `details`, and the UI maps
`error.details` straight onto form fields (`TaskModal`'s catch block) — so
server messages appear inline under the right input.

**Errors funnel through one handler** (`server/src/middleware/errors.js`):

- `HttpError(status, message, details)` — thrown by controllers/middleware
  for *expected* failures. The handler sends exactly that status/message.
- Anything else (a typo, a DB outage) → logged with `console.error` for the
  developer, and the client gets a generic `500` — internals never leak.
- Express 5 also auto-forwards rejected async handlers here (we wrap anyway
  with `asyncHandler` for clarity).

**The database is the last line of defense:** CHECK constraints, UNIQUE and
NOT NULL reject anything that slipped past validation, and the error handler
turns those into 500s you'll see in the server log immediately.

## 14. How to debug the application

**Start everything, then look at three places in this order:**

1. **The browser console** (F12) — React errors, failed requests. The Network
   tab shows each API call: status code, payload, response. A red 400/500
   with a JSON body usually tells you the whole story.
2. **The API server terminal** — every unexpected error is logged there with
   a stack trace (`[error] ...` from the error handler). `console.log` in any
   controller/service shows up here.
3. **The database** — is the data what you think it is?

```bash
psql "postgres://sprintboard:sprintboard_dev_password@localhost:54329/sprintboard"
SELECT id, title, status, position FROM tasks WHERE project_id = 5;
```

**Common scenarios:**

| Symptom | First thing to check |
|---|---|
| 401 on every call | Is the cookie being sent? (Network tab → request headers). Is `server/.env` loaded? |
| `ECONNREFUSED 5432` (wrong port) | `DATABASE_URL` wrong/unset — the pool falls back to Postgres defaults |
| `relation ... does not exist` | Schema not applied → `npm run db:setup` |
| Form shows nothing happened | Open Network tab: was it a 400 with `details`? Those render inline |
| Drag-and-drop reverts | Look for the error toast — the PATCH failed and the board restored its snapshot |
| Vite page stale | Hard-refresh; check the Vite terminal for HMR errors |
| Tests fail with connection errors | Embedded Postgres not running → `node server/scripts/postgres.js ensure` |

**Test as a magnifying glass:** when something misbehaves, reproduce it in a
Jest test (copy the closest existing test). It pins the bug, then proves the
fix — and stays as a regression test.

## 15. Codebase tour

### Root

| Path | Purpose |
|---|---|
| `package.json` | Root scripts: `npm run dev` runs postgres + server + client together via `concurrently` |
| `.gitignore` | Ignores `node_modules`, `server/.pgdata`, `.env`, build output |
| `README.md` | Setup, API docs, schema, deployment |
| `LEARNING_GUIDE.md` | This file |
| `docs/screenshots/` | Images used by the README |
| `.env.example` | Template of every environment variable |

### `server/` — the API

| Path | Purpose |
|---|---|
| `scripts/postgres.js` | Dev-only: starts embedded PostgreSQL (`keep` = foreground, `ensure` = background if not running) |
| `src/index.js` | Entry point: loads `.env`, starts listening. Nothing else. |
| `src/app.js` | `createApp()`: JSON parsing, sessions, routes, static serving, error handling. Exported as a factory so tests can import it without binding a port. |
| `src/routes/index.js` | Every endpoint + where `requireAuth` kicks in |
| `src/controllers/` | One file per entity. Validate → call service → respond. |
| `src/services/` | **All SQL.** `users.js`, `projects.js`, `tasks.js`, `comments.js`, `stats.js` (dashboard) |
| `src/middleware/auth.js` | `requireAuth` — loads the session user or throws 401 |
| `src/middleware/errors.js` | `notFound` + the central `errorHandler` |
| `src/utils/httpError.js` | `HttpError` class + `asyncHandler` wrapper |
| `src/utils/validation.js` | Every input validator, all the rules in one place |
| `src/db/pool.js` | The pg connection `Pool` + `query()`/`withTransaction()` helpers |
| `src/db/schema.sql` | Table definitions — read this first when studying the data model |
| `src/db/setup.js` | Creates the DB if missing + applies the schema (idempotent) |
| `src/db/seed.js` | Demo user + realistic sample data (relative dates so overdue examples always exist) |
| `src/db/reset.js` | Drop + recreate empty |
| `tests/` | Jest + Supertest: `helpers.js` (test DB switch, truncate, login helper), `global-setup.js`, and five suites |
| `jest.config.js` | Test runner config (separate `sprintboard_test` database) |

### `client/` — the React app

| Path | Purpose |
|---|---|
| `vite.config.js` | React plugin + `/api` proxy to Express |
| `index.html` | Single HTML page (SPA) — loads fonts + `src/main.jsx` |
| `src/main.jsx` | Mounts React, orders the providers |
| `src/App.jsx` | Route table + `ProtectedRoute`/`PublicOnlyRoute` guards |
| `src/api/client.js` | fetch wrapper, `ApiError`, 401 hook |
| `src/context/AuthContext.jsx` | Session restore, login/register/logout state |
| `src/context/ProjectsContext.jsx` | Shared project list + `taskVersion` refresh signal |
| `src/context/ToastContext.jsx` | Success/error notifications |
| `src/hooks/useDebounce.js` | Debounced value (search inputs) |
| `src/utils/format.js` | Labels, date formatting, overdue logic, initials |
| `src/components/AppLayout.jsx` | Shell: sidebar + topbar + `<Outlet/>` + global New Task |
| `src/components/Sidebar.jsx` | Navigation, project list, account menu/logout |
| `src/components/Modal.jsx` / `ConfirmDialog.jsx` | Dialog plumbing (Escape, backdrop, focus) |
| `src/components/States.jsx` | `Loading`, `EmptyState`, `ErrorState` |
| `src/components/Badges.jsx` | Status/priority pills |
| `src/components/TaskCard.jsx` | Draggable Kanban card |
| `src/components/TaskModal.jsx` | Create-task form (project select or fixed project) |
| `src/components/TaskDetail.jsx` | Drawer: view/edit/status/deadline + comments + delete |
| `src/components/ProjectModal.jsx` | Create/edit project with color picker |
| `src/pages/LoginPage.jsx` | Login + brand panel + demo-account button |
| `src/pages/RegisterPage.jsx` | Registration with client-side checks |
| `src/pages/DashboardPage.jsx` | Stats, progress, recent activity |
| `src/pages/ProjectsPage.jsx` | Project cards grid, create/edit/delete |
| `src/pages/BoardPage.jsx` | **The Kanban board** — columns, DnD, filters, drawer |
| `src/pages/TasksPage.jsx` | All tasks list: search, filters, sort |
| `src/styles/base.css` | Design tokens (colors/radii/shadows), reset, utilities |
| `src/styles/components.css` | Button/input/badge/modal/toast styles |
| `src/styles/pages.css` | Layout shell, auth pages, dashboard, board, list |

## 16. Interview preparation

**Q: Walk me through what happens when a user logs in.**
A: The client POSTs credentials to `/api/auth/login`. The server validates
input, looks the user up by email, and uses `bcrypt.compare` to check the
password against the stored hash. On success it stores the user's id in
`req.session`, which express-session persists as a row in a PostgreSQL
`sessions` table and references via a signed, httpOnly cookie. Every later
request carries that cookie; a `requireAuth` middleware resolves it back to a
full user row before any handler runs. Passwords are never stored or logged
in plaintext, and failed logins return a generic message so the API doesn't
reveal which emails exist.

**Q: Why server-side sessions instead of JWTs?**
A: For a single-server app, sessions are simpler and more secure by default:
the token is an opaque, signed id, revocation is a DB delete (logout kills the
row immediately), and no token payload is exposed to client JavaScript.
JWTs shine for stateless scaling across services — a trade-off I can explain,
but this app doesn't need it. I also deliberately stored sessions in
PostgreSQL rather than memory, so restarts don't log users out.

**Q: How do you prevent SQL injection?**
A: Every query uses parameterized placeholders (`$1, $2...`) via node-postgres
— values are never concatenated into SQL strings. Even the dynamic UPDATE
builder (`buildUpdateSet`) generates only column names from a fixed whitelist
and passes values as parameters. Input validation adds a second layer, and
CHECK constraints a third.

**Q: How do you stop one user reading another user's data?**
A: Ownership is encoded in the queries themselves. Every SELECT/UPDATE/DELETE
joins up to the owner and filters `WHERE ... user_id = <session user>`, so a
foreign id simply matches zero rows, which I return as 404 (indistinguishable
from "doesn't exist", so id-guessing leaks nothing). There's no separate
"check access" function that a new route could forget to call. My
`ownership.test.js` suite verifies this from a second user's perspective.

**Q: How does the drag-and-drop persist?**
A: Cards carry a float `position`. On drop I reorder the local array
optimistically, compute the midpoint between the new neighbours, and PATCH
just that task with `{status, position}`. Only one row is written regardless
of board size. If the PATCH fails, the board reverts from a pre-drag
snapshot and shows an error toast. There's also a keyboard-accessible status
dropdown, so drag isn't the only way to move work.

**Q: Why is the dashboard not hardcoded? What if a recruiter asks "did you
fake the numbers"?**
A: `GET /api/dashboard` runs one SQL query with `COUNT(*) FILTER (WHERE ...)`
aggregates over the user's real rows; the React page only renders whatever
arrives. Deleting tasks changes the numbers on the next load — the seed script
just makes it look alive on first run.

**Q: How is validation organized?**
A: Twice, on purpose. Client-side gives instant inline feedback; the server
re-validates everything (it must — API clients can bypass the UI). One
validator module returns either cleaned values or per-field messages; the
controllers turn those into 400 responses with `details`, and forms map
`details` back onto inputs. The DB adds CHECK/UNIQUE/NOT NULL as the final
guard.

**Q: What would you build next / improve?**
A: Concrete, honest answers: rate-limit auth endpoints and add CSRF tokens
for defense-in-depth; add pagination to the tasks endpoint (currently capped
at 200); extract shared types between client and server; add E2E tests with
Playwright; move `position` re-normalization into a background job for very
active columns. Naming real trade-offs matters more than claiming perfection.

**Q: What was the hardest bug?** (Have a real story ready.)
A good one from this build: the dashboard showed empty status labels because
a bulk edit (a `sed` over the SQL files) accidentally removed `t.status,
t.priority` from one query's SELECT list. The page didn't crash — React
rendered `undefined` as empty — so it was silent. I found it by inspecting the
rendered DOM, checked the API response, then traced it to the service. Lesson:
silently-empty data usually means the field never arrived; verify the API
payload before blaming the UI.

## 17. Build it yourself

Rebuilding from a blank folder is the real test of understanding. Suggested
order — each step produces something runnable:

1. **Data layer first.** Write `schema.sql` (4 tables, FKs, CHECKs). Create a
   `pool.js` and a `setup.js` that applies the schema. Verify with psql.
2. **Express skeleton.** `app.js` with `express.json()`, a test route, and the
   error middleware. Get `{"error": ...}` shaped 404s working.
3. **Auth.** `users` service + register/login controllers + bcrypt +
   express-session (memory store is fine at first). Protect one dummy route
   with `requireAuth`. Test everything with curl and cookie jars.
4. **Sessions in PostgreSQL** — swap in `connect-pg-simple`, restart the
   server, confirm you stay logged in.
5. **Projects CRUD.** Service → controller → route. Then **tasks CRUD**
   (the ownership-scoped WHERE clauses from §12 go in immediately — retrofitting
   security is how it gets missed).
6. **React shell.** Vite + Router + AuthContext + login page + ProtectedRoute.
   Proxy `/api`. Get the sidebar rendering from real data.
7. **Board.** Render columns from `GET /api/projects/:id/tasks`. Add card
   drag with the midpoint-position PATCH (§10). Add the status dropdown.
8. **Dashboard** with the FILTER-aggregate query.
9. **Search/filter/sort** on the tasks list (SQL-side, not client-side —
   that's the interview-worthy choice).
10. **Comments**, then **polish**: empty/error/loading states, toasts,
    responsive CSS.
11. **Tests** as you go (auth first), and the seed script last — it's most
    useful when it can showcase a finished app.

If you can do steps 1–7 without opening this project, you've understood it.
Where you get stuck, come back, read the matching section, and *note what you
missed* — that note is worth more than the feature.

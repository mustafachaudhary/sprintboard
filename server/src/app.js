// ============================================================
// Express application factory
// ============================================================
// The app is built in a function instead of a top-level file so tests can
// import it (supertest) without the server actually listening on a port.
const path = require('path');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const { pool } = require('./db/pool');
const apiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Behind a reverse proxy (hosting platforms), trust it so secure cookies
  // and client IPs behave correctly.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Parse JSON request bodies (reject bodies larger than 100 KB).
  app.use(express.json({ limit: '100kb' }));

  // ---- Sessions ----
  // Sessions are stored in PostgreSQL (connect-pg-simple), not in server
  // memory: logins survive restarts and work across multiple processes.
  // The browser only ever receives a signed, httpOnly session id cookie.
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
      name: 'sprintboard.sid',
      secret: process.env.SESSION_SECRET || 'dev-only-secret-do-not-use-in-prod',
      resave: false,             // don't rewrite unchanged sessions
      saveUninitialized: false,  // don't create sessions for anonymous visitors
      cookie: {
        httpOnly: true,          // JavaScript in the browser cannot read it
        sameSite: 'lax',         // sent on same-site requests; blocks most CSRF
        secure: 'auto',          // secure over HTTPS in production, plain over http
        maxAge: 1000 * 60 * 60 * 24 * 7, // one week
      },
    })
  );

  // ---- API ----
  app.use('/api', apiRouter);

  // ---- Production: serve the built React app from client/dist ----
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // SPA fallback: any GET that is not /api and not a real file returns
  // index.html so React Router can handle the URL client-side.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    return next();
  });

  // ---- Errors (must be registered last) ----
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

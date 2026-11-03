// ============================================================
// Embedded PostgreSQL runner (local development only)
// ============================================================
// Installing PostgreSQL system-wide requires root access, so for local
// development we use the `embedded-postgres` npm package: it ships real
// PostgreSQL 17 binaries and runs them as your own user with a data
// directory inside the project (server/.pgdata, gitignored).
//
// The application code does not know or care about this — it connects to a
// completely ordinary PostgreSQL server via DATABASE_URL. Point DATABASE_URL
// at any other PostgreSQL server (local install, Docker, a free hosted tier)
// and everything works identically.
//
// Usage:
//   node scripts/postgres.js keep    -> start it and stay running (used by `npm run dev`)
//   node scripts/postgres.js ensure  -> start it in the background if it is not
//                                       already up, then exit (used by setup/test)
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

// Default local connection settings — they match the .env.example values.
// Each can be overridden with environment variables.
const PORT = Number(process.env.PG_PORT || 54329);
const USER = process.env.PG_USER || 'sprintboard';
const PASSWORD = process.env.PG_PASSWORD || 'sprintboard_dev_password';
const DATABASE = process.env.PG_DATABASE || 'sprintboard';
const DATA_DIR = path.join(__dirname, '..', '.pgdata');

// Check whether something is already accepting connections on the port.
function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startEmbedded({ stayAlive }) {
  // The package is ESM-style, so the class arrives as the module's default export.
  const EmbeddedPostgres = require('embedded-postgres').default;
  const fs = require('fs');

  // initialise() runs `initdb` — only needed the very first time.
  const needsInit = !fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true, // keep the data directory between runs
  });

  if (needsInit) {
    console.log(`[postgres] first run: initialising data directory at ${DATA_DIR} ...`);
    await pg.initialise();
  }

  console.log(`[postgres] starting PostgreSQL 17 on port ${PORT} ...`);
  await pg.start();

  // The embedded server starts an empty cluster — make sure our app database
  // exists (harmless if it does, it just reports a notice).
  try {
    await pg.createDatabase(DATABASE);
    console.log(`[postgres] created database "${DATABASE}"`);
  } catch {
    // Database already exists — that is the normal case after the first run.
  }

  console.log(`[postgres] ready: postgres://${USER}:***@localhost:${PORT}/${DATABASE}`);

  if (!stayAlive) return;

  // In "keep" mode we stay in the foreground until Ctrl+C, then shut the
  // database down cleanly so the data directory is not left in recovery state.
  const shutdown = async () => {
    console.log('\n[postgres] shutting down ...');
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main() {
  const mode = process.argv[2] || 'ensure';

  if (await isPortOpen(PORT)) {
    console.log(`[postgres] already running on port ${PORT} — nothing to do.`);
    return;
  }

  if (mode === 'ensure') {
    // Start a detached "keep" child so the database outlives this short-lived
    // command (npm setup / test scripts), then wait until it accepts queries.
    console.log('[postgres] not running — starting it in the background ...');
    const child = spawn(process.execPath, [__filename, 'keep'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(500);
      if (await isPortOpen(PORT)) {
        console.log('[postgres] is up and accepting connections.');
        return;
      }
    }
    console.error('[postgres] ERROR: timed out waiting for the database to start.');
    process.exit(1);
  }

  await startEmbedded({ stayAlive: true });
}

main().catch((error) => {
  console.error('[postgres] failed:', error.message);
  process.exit(1);
});

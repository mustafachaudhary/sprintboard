// Full local reset: drops the app database and recreates it empty.
// `npm run db:reset` from the project root, then `npm run db:seed` for demo data.
// IMPORTANT: load .env before creating any database clients.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { Client } = require('pg');

const url = new URL(process.env.DATABASE_URL || 'postgres://sprintboard:sprintboard_dev_password@localhost:54329/sprintboard');
const databaseName = url.pathname.replace('/', '');

// Same trick as setup.js: swap the path to target the maintenance database.
function maintenanceUrl() {
  const copy = new URL(url.toString());
  copy.pathname = '/postgres';
  return copy.toString();
}

async function main() {
  const maintenance = new Client({ connectionString: maintenanceUrl() });
  await maintenance.connect();

  // Terminating existing connections is required before a DROP can succeed
  // (the running API server keeps a pool of open connections).
  await maintenance.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName]
  );
  await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await maintenance.query(`CREATE DATABASE "${databaseName}"`);
  await maintenance.end();
  console.log(`Database "${databaseName}" dropped and recreated empty.`);
}

main().catch((error) => {
  console.error('Reset failed:', error.message);
  process.exit(1);
});

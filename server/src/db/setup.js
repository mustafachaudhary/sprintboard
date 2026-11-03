// Creates the database schema (tables + indexes) if it does not exist yet.
// Safe to run multiple times — every statement is "IF NOT EXISTS".
//
// Connects to the maintenance database "postgres" first (which always exists),
// then creates the app database if missing, then runs schema.sql inside it.
// IMPORTANT: load .env before creating any database clients.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const fs = require('fs');
const { Client } = require('pg');

const url = new URL(process.env.DATABASE_URL || 'postgres://sprintboard:sprintboard_dev_password@localhost:54329/sprintboard');
const databaseName = url.pathname.replace('/', '');

// A maintenance connection points at the always-present "postgres" database.
// (Note: url.origin is unusable for postgres:// URLs, so we swap the path.)
function maintenanceUrl() {
  const copy = new URL(url.toString());
  copy.pathname = '/postgres';
  return copy.toString();
}

async function main() {
  // 1. Connect to the maintenance database.
  const maintenance = new Client({ connectionString: maintenanceUrl() });
  await maintenance.connect();

  // 2. Create the app database if it does not exist yet.
  const exists = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (exists.rowCount === 0) {
    await maintenance.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`Created database "${databaseName}".`);
  } else {
    console.log(`Database "${databaseName}" already exists.`);
  }
  await maintenance.end();

  // 3. Run the schema file.
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const app = new Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  await app.query(schema);
  await app.end();
  console.log('Schema applied: users, projects, tasks, comments are ready.');
}

main().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});

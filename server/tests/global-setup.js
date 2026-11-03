// Runs once before the whole test suite: make sure the sprintboard_test
// database exists and has the schema. The tests then truncate tables between
// cases (see tests/helpers.js).
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

module.exports = async function globalSetup() {
  // Dev settings from scripts/postgres.js are the defaults here too.
  const url = new URL(
    process.env.DATABASE_URL ||
      'postgres://sprintboard:sprintboard_dev_password@localhost:54329/sprintboard'
  );
  const testDbName = 'sprintboard_test';

  const maintenanceUrl = new URL(url.toString());
  maintenanceUrl.pathname = '/postgres';
  const maintenance = new Client({ connectionString: maintenanceUrl.toString() });
  await maintenance.connect();
  const exists = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDbName]);
  if (exists.rowCount === 0) {
    await maintenance.query(`CREATE DATABASE "${testDbName}"`);
  }
  await maintenance.end();

  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
  // The express-session store creates its "session" table on first use in the
  // real app — the tests wipe data before that, so create it up front.
  const sessionTable = `
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `;
  const testDbUrl = new URL(url.toString());
  testDbUrl.pathname = `/${testDbName}`;
  const testDb = new Client({ connectionString: testDbUrl.toString() });
  await testDb.connect();
  await testDb.query(schema);
  await testDb.query(sessionTable);
  await testDb.end();
};

// Shared PostgreSQL connection pool.
//
// A "pool" keeps a small set of open database connections and reuses them for
// every query. Creating a fresh TCP connection per query would be slow, so we
// create ONE pool for the whole app and import it wherever we run SQL.
//
// DATABASE_URL looks like:
//   postgres://username:password@localhost:5432/database
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Terminate a hanging query after 10 seconds instead of blocking forever.
  statement_timeout: 10_000,
});

// Small helper so every query module can `await query(sql, params)` and get
// the rows directly — we never need pg's extra metadata fields in this app.
async function query(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// `withTransaction` runs a callback inside a transaction: either every query
// in it succeeds (COMMIT) or all of them are undone (ROLLBACK). We use it for
// multi-step writes like creating a seeded dataset.
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };

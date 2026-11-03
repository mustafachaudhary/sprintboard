// ============================================================
// users service — all SQL for the users table
// ============================================================
const { query } = require('../db/pool');

function getUserByEmail(email) {
  return query(
    'SELECT id, name, email, password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE email = $1',
    [email]
  ).then((rows) => rows[0] || null);
}

function getUserById(id) {
  return query(
    'SELECT id, name, email, password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE id = $1',
    [id]
  ).then((rows) => rows[0] || null);
}

function createUser({ name, email, passwordHash }) {
  return query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at AS "createdAt"`,
    [name, email, passwordHash]
  ).then((rows) => rows[0]);
}

module.exports = { getUserByEmail, getUserById, createUser };

// ============================================================
// Shared test helpers
// ============================================================
// IMPORTANT: .env must load (and DATABASE_URL must be switched to the test
// database) BEFORE requiring anything that builds the pg pool.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const url = new URL(process.env.DATABASE_URL);
url.pathname = '/sprintboard_test';
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';

const supertest = require('supertest');
const { pool, query } = require('../src/db/pool');
const { createApp } = require('../src/app');

const app = createApp();

// Wipe every table between tests so each case starts clean.
// RESTART IDENTITY resets the auto-increment counters too.
async function truncateAll() {
  await query(
    `TRUNCATE comments, tasks, projects, users RESTART IDENTITY CASCADE;
     DELETE FROM session;`
  );
}

/**
 * Registers + logs in a throwaway user. Returns the user object and the
 * session cookie string for authenticated requests.
 */
async function createUser(name, email, password) {
  const response = await supertest(app)
    .post('/api/auth/register')
    .send({ name, email, password });
  if (response.status !== 201) {
    throw new Error(`Test user registration failed: ${JSON.stringify(response.body)}`);
  }
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  return { user: response.body.user, cookie };
}

/** Convenience: create a user AND a project, returning both. */
async function createUserWithProject(name, email, password, projectName) {
  const { user, cookie } = await createUser(name, email, password);
  const response = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: projectName, description: 'Test project', color: '#7B8CFF' });
  return { user, cookie, project: response.body.project };
}

module.exports = { app, request: supertest, query, pool, truncateAll, createUser, createUserWithProject };

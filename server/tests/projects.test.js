// ============================================================
// Project CRUD + authentication protection
// ============================================================
const { app, request, truncateAll, createUser, createUserWithProject } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  const { pool } = require('./helpers');
  await pool.end();
});

describe('protected routes', () => {
  it.each(['GET /api/projects', 'POST /api/projects'])('returns 401 without a session: %s', async (route) => {
    const [method, url] = route.split(' ');
    const response = await request(app)[method.toLowerCase()](url).send({});
    expect(response.status).toBe(401);
  });
});

describe('project CRUD', () => {
  it('creates, lists, updates and deletes a project', async () => {
    const { cookie } = await createUser('Ada', 'crud@example.com', 'password123');

    // CREATE
    const created = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({ name: 'Apollo', description: 'Moon shot', color: '#4FD1C5' });
    expect(created.status).toBe(201);
    const projectId = created.body.project.id;

    // LIST
    const list = await request(app).get('/api/projects').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.projects).toHaveLength(1);
    expect(list.body.projects[0]).toMatchObject({ name: 'Apollo', taskCount: 0, completedCount: 0 });

    // UPDATE (partial PATCH: only the name)
    const patched = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookie)
      .send({ name: 'Apollo XI' });
    expect(patched.status).toBe(200);
    expect(patched.body.project.name).toBe('Apollo XI');
    expect(patched.body.project.color).toBe('#4FD1C5'); // untouched

    // DELETE
    const deleted = await request(app).delete(`/api/projects/${projectId}`).set('Cookie', cookie);
    expect(deleted.status).toBe(204);

    const after = await request(app).get(`/api/projects/${projectId}`).set('Cookie', cookie);
    expect(after.status).toBe(404);
  });

  it('rejects invalid project data', async () => {
    const { cookie } = await createUser('Ada', 'valid@example.com', 'password123');
    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({ name: '', color: 'red' });

    expect(response.status).toBe(400);
    expect(response.body.details.name).toBeDefined();
    expect(response.body.details.color).toBeDefined();
  });

  it('returns 404 for a missing project id', async () => {
    const { cookie } = await createUser('Ada', 'missing@example.com', 'password123');
    const response = await request(app).get('/api/projects/9999').set('Cookie', cookie);
    expect(response.status).toBe(404);
  });
});

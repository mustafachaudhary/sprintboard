// ============================================================
// Ownership & authorization: user B must never touch user A's data
// ============================================================
const { app, request, truncateAll, createUserWithProject } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  const { pool } = require('./helpers');
  await pool.end();
});

describe('cross-user access is always 404 (never leaks existence)', () => {
  let ownerCookie;
  let strangerCookie;
  let project;
  let task;

  beforeEach(async () => {
    ({ cookie: ownerCookie, project } = await createUserWithProject(
      'Owner', 'owner@example.com', 'password123', 'Secret plan'
    ));
    ({ cookie: strangerCookie } = await createUserWithProject(
      'Stranger', 'stranger@example.com', 'password123', 'Their own thing'
    ));

    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', ownerCookie)
      .send({ projectId: project.id, title: 'Owner task' });
    task = created.body.task;
  });

  it("blocks GET of another user's project", async () => {
    const response = await request(app).get(`/api/projects/${project.id}`).set('Cookie', strangerCookie);
    expect(response.status).toBe(404);
  });

  it("blocks PATCH of another user's project", async () => {
    const response = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', strangerCookie)
      .send({ name: 'Hacked' });
    expect(response.status).toBe(404);
  });

  it("blocks DELETE of another user's project", async () => {
    const response = await request(app).delete(`/api/projects/${project.id}`).set('Cookie', strangerCookie);
    expect(response.status).toBe(404);
  });

  it("blocks PATCH of another user's task (status flip)", async () => {
    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('Cookie', strangerCookie)
      .send({ status: 'done' });
    expect(response.status).toBe(404);
  });

  it("blocks DELETE of another user's task", async () => {
    const response = await request(app).delete(`/api/tasks/${task.id}`).set('Cookie', strangerCookie);
    expect(response.status).toBe(404);
  });

  it("blocks reading another user's task comments", async () => {
    const response = await request(app).get(`/api/tasks/${task.id}/comments`).set('Cookie', strangerCookie);
    expect(response.status).toBe(404);
  });

  it("blocks commenting on another user's task", async () => {
    const response = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Cookie', strangerCookie)
      .send({ content: 'sneaky comment' });
    expect(response.status).toBe(404);
  });

  it('never lists another user\u2019s tasks in GET /api/tasks', async () => {
    const response = await request(app).get('/api/tasks').set('Cookie', strangerCookie);
    expect(response.status).toBe(200);
    expect(response.body.tasks.map((t) => t.id)).not.toContain(task.id);
  });

  it('rejects creating a task inside another user\u2019s project', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Cookie', strangerCookie)
      .send({ projectId: project.id, title: 'Infiltrate' });
    expect(response.status).toBe(404);
  });
});

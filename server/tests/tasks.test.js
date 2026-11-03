// ============================================================
// Task CRUD, Kanban status changes, search/filter/sort
// ============================================================
const { app, request, truncateAll, createUserWithProject } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  const { pool } = require('./helpers');
  await pool.end();
});

// Two days ago as YYYY-MM-DD — guaranteed to be "overdue".
function pastDate() {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

describe('task CRUD', () => {
  let cookie;
  let project;

  beforeEach(async () => {
    ({ cookie, project } = await createUserWithProject('Ada', 'tasks@example.com', 'password123', 'Apollo'));
  });

  it('creates a task with defaults (Todo, Medium, position 100)', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: project.id, title: 'Write docs' });

    expect(response.status).toBe(201);
    expect(response.body.task).toMatchObject({
      title: 'Write docs',
      status: 'todo',
      priority: 'medium',
      position: 100,
      deadline: null,
    });
  });

  it('rejects invalid task data', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: project.id, title: '', priority: 'mega' });

    expect(response.status).toBe(400);
    expect(response.body.details.title).toBeDefined();
    expect(response.body.details.priority).toBeDefined();
  });

  it('updates a task via PATCH (edit fields)', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: project.id, title: 'First draft' });

    const updated = await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Final draft', priority: 'high', deadline: '2026-12-01' });

    expect(updated.status).toBe(200);
    expect(updated.body.task).toMatchObject({
      title: 'Final draft',
      priority: 'high',
      deadline: '2026-12-01',
    });
  });

  it('moves a task between Kanban columns (status + position persist)', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: project.id, title: 'Drag me' });

    const moved = await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set('Cookie', cookie)
      .send({ status: 'in_progress', position: 150 });

    expect(moved.status).toBe(200);
    expect(moved.body.task.status).toBe('in_progress');
    expect(moved.body.task.position).toBe(150);

    // Read it back to prove the change was persisted, not just echoed.
    const refetched = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .set('Cookie', cookie);
    const task = refetched.body.tasks.find((t) => t.title === 'Drag me');
    expect(task.status).toBe('in_progress');
    expect(task.position).toBe(150);
  });

  it('rejects an unknown status', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: project.id, title: 'Bad status' });

    const updated = await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set('Cookie', cookie)
      .send({ status: 'archived' });

    expect(updated.status).toBe(400);
  });

  it('deletes a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: project.id, title: 'Delete me' });

    const deleted = await request(app).delete(`/api/tasks/${created.body.task.id}`).set('Cookie', cookie);
    expect(deleted.status).toBe(204);

    const list = await request(app).get(`/api/projects/${project.id}/tasks`).set('Cookie', cookie);
    expect(list.body.tasks).toHaveLength(0);
  });
});

describe('search, filters and sorting (GET /api/tasks)', () => {
  let cookie;
  let project;

  beforeEach(async () => {
    ({ cookie, project } = await createUserWithProject('Ada', 'filter@example.com', 'password123', 'Filters'));
    const post = (body) => request(app).post('/api/tasks').set('Cookie', cookie).send({ projectId: project.id, ...body });

    await post({ title: 'Implement drag-and-drop', priority: 'urgent' });
    await post({ title: 'Write documentation', priority: 'low', deadline: pastDate() });
    await post({ title: 'Design onboarding', priority: 'medium' });
    // Mark "Design onboarding" done.
    const list = await (await request(app).get(`/api/projects/${project.id}/tasks`).set('Cookie', cookie)).body;
    const designTask = list.tasks.find((t) => t.title === 'Design onboarding');
    await request(app)
      .patch(`/api/tasks/${designTask.id}`)
      .set('Cookie', cookie)
      .send({ status: 'done' });
  });

  it('searches by title (case-insensitive)', async () => {
    const response = await request(app).get('/api/tasks?search=DRAG').set('Cookie', cookie);
    expect(response.body.tasks.map((t) => t.title)).toEqual(['Implement drag-and-drop']);
  });

  it('filters by status', async () => {
    const response = await request(app).get('/api/tasks?status=done').set('Cookie', cookie);
    expect(response.body.tasks.map((t) => t.title)).toEqual(['Design onboarding']);
  });

  it('filters by priority', async () => {
    const response = await request(app).get('/api/tasks?priority=urgent').set('Cookie', cookie);
    expect(response.body.tasks).toHaveLength(1);
    expect(response.body.tasks[0].priority).toBe('urgent');
  });

  it('filters overdue (undone + past deadline)', async () => {
    const response = await request(app).get('/api/tasks?overdue=true').set('Cookie', cookie);
    expect(response.body.tasks.map((t) => t.title)).toEqual(['Write documentation']);
  });

  it('sorts by priority (urgent first)', async () => {
    const response = await request(app).get('/api/tasks?sort=priority').set('Cookie', cookie);
    expect(response.body.tasks[0].priority).toBe('urgent');
    expect(response.body.tasks[response.body.tasks.length - 1].priority).toBe('low');
  });
});

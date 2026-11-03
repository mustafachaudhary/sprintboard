// ============================================================
// Comments: create, list, validate
// ============================================================
const { app, request, truncateAll, createUserWithProject } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  const { pool } = require('./helpers');
  await pool.end();
});

describe('comments', () => {
  let cookie;
  let task;

  beforeEach(async () => {
    const setup = await createUserWithProject('Ada', 'comments@example.com', 'password123', 'Chat');
    cookie = setup.cookie;
    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ projectId: setup.project.id, title: 'Discuss this' });
    task = created.body.task;
  });

  it('creates a comment and returns it with author info', async () => {
    const response = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Cookie', cookie)
      .send({ content: 'Looks good to me' });

    expect(response.status).toBe(201);
    expect(response.body.comment).toMatchObject({ content: 'Looks good to me', taskId: task.id });
  });

  it('lists comments oldest first', async () => {
    await request(app).post(`/api/tasks/${task.id}/comments`).set('Cookie', cookie).send({ content: 'First' });
    await request(app).post(`/api/tasks/${task.id}/comments`).set('Cookie', cookie).send({ content: 'Second' });

    const response = await request(app).get(`/api/tasks/${task.id}/comments`).set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.comments.map((c) => c.content)).toEqual(['First', 'Second']);
    expect(response.body.comments[0].authorName).toBe('Ada');
  });

  it('rejects an empty comment', async () => {
    const response = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Cookie', cookie)
      .send({ content: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.details.content).toBeDefined();
  });

  it('rejects comments longer than 1000 characters', async () => {
    const response = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Cookie', cookie)
      .send({ content: 'x'.repeat(1001) });

    expect(response.status).toBe(400);
  });

  it('returns 404 for comments on a nonexistent task', async () => {
    const response = await request(app)
      .post('/api/tasks/9999/comments')
      .set('Cookie', cookie)
      .send({ content: 'hi' });
    expect(response.status).toBe(404);
  });
});

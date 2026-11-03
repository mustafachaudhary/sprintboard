// ============================================================
// Authentication: registration, login, session, logout
// ============================================================
const { app, request, truncateAll, createUser } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  const { pool } = require('./helpers');
  await pool.end();
});

describe('POST /api/auth/register', () => {
  it('creates an account, hashes the password and starts a session', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'supersecret1' });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie']).toBeDefined();

    // The stored password must be a bcrypt hash, never the plaintext.
    const { query } = require('./helpers');
    const [row] = await query('SELECT password_hash FROM users WHERE email = $1', ['ada@example.com']);
    expect(row.password_hash).not.toBe('supersecret1');
    expect(row.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt signature
  });

  it('rejects invalid input with per-field messages', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: '123' });

    expect(response.status).toBe(400);
    expect(response.body.details).toHaveProperty('name');
    expect(response.body.details).toHaveProperty('email');
    expect(response.body.details).toHaveProperty('password');
  });

  it('rejects a duplicate email with 409', async () => {
    await createUser('Ada', 'dupe@example.com', 'password123');
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Second Ada', email: 'dupe@example.com', password: 'password123' });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already exists/i);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await createUser('Ada', 'login@example.com', 'password123');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('login@example.com');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects a wrong password with a generic 401', async () => {
    await createUser('Ada', 'wrongpw@example.com', 'password123');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpw@example.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
    // Must not reveal whether the email exists.
    expect(response.body.error).toBe('Incorrect email or password.');
  });

  it('rejects an unknown email with the same generic 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever123' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Incorrect email or password.');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid session', async () => {
    const { cookie, user } = await createUser('Ada', 'me@example.com', 'password123');
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(user.id);
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 without a session cookie', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('destroys the session so /me returns 401 afterwards', async () => {
    const { cookie } = await createUser('Ada', 'bye@example.com', 'password123');

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(401);
  });
});

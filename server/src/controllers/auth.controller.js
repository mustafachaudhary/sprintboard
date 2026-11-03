// ============================================================
// Auth controller — register, login, logout, me
// ============================================================
const bcrypt = require('bcryptjs');
const { HttpError, asyncHandler } = require('../utils/httpError');
const { validateRegistration, validateLogin } = require('../utils/validation');
const users = require('../services/users');

// How many times bcrypt runs its hashing loop. 10-12 is the standard range:
// slow enough to make brute-forcing expensive, fast enough for login.
const BCRYPT_ROUNDS = 10;

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const result = validateRegistration(req.body);
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }

  const { name, email, password } = result.values;

  const existing = await users.getUserByEmail(email);
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  // The plain password exists only in this function's memory; the hash is
  // what gets stored (bcrypt includes the random salt inside the hash).
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await users.createUser({ name, email, passwordHash });

  // Log the user in immediately by creating their session.
  req.session.userId = user.id;

  res.status(201).json({ user });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const result = validateLogin(req.body);
  if (!result.valid) {
    throw new HttpError(400, 'Please fix the highlighted fields.', result.errors);
  }

  const { email, password } = result.values;
  const user = await users.getUserByEmail(email);

  // One generic message for both "no such user" and "wrong password" so we
  // don't tell an attacker which emails have accounts.
  const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordMatches) {
    throw new HttpError(401, 'Incorrect email or password.');
  }

  req.session.userId = user.id;
  delete user.passwordHash;
  res.json({ user });
});

// POST /api/auth/logout
const logout = (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
};

// GET /api/auth/me — the client calls this on page load to restore the
// session (the browser sends the session cookie automatically).
const me = (req, res) => {
  res.json({ user: req.user });
};

module.exports = { register, login, logout, me };

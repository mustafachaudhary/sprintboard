// ============================================================
// Authentication middleware
// ============================================================
// requireAuth runs BEFORE any protected route handler. It answers two
// questions:
//   1. Does this request carry a valid session with a logged-in user id?
//   2. Does that user still exist in the database?
// If both hold, the fresh user row is attached to req.user for the rest of
// the request. Otherwise the request is rejected with 401.

const { HttpError, asyncHandler } = require('../utils/httpError');
const { getUserById } = require('../services/users');

const requireAuth = asyncHandler(async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    throw new HttpError(401, 'You need to be logged in to do that.');
  }

  const user = await getUserById(userId);
  if (!user) {
    // Session points at a user that no longer exists (e.g. deleted account).
    req.session.destroy(() => {});
    throw new HttpError(401, 'Your session is no longer valid. Please log in again.');
  }

  // Never send the password hash to route handlers or the client.
  delete user.passwordHash;
  req.user = user;
  next();
});

module.exports = { requireAuth };

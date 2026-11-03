// ============================================================
// HTTP helpers shared by controllers and middleware
// ============================================================

/**
 * An error that carries an HTTP status code.
 * Controllers throw these for expected failures ("email already taken"),
 * and the central error handler turns them into JSON responses.
 * Anything else (a bug, a database outage) falls through as a 500.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // optional: { fieldName: 'message' } for forms
  }
}

/**
 * Wraps an async route handler so rejections reach the error middleware.
 * (Express 5 already forwards rejected promises, but an explicit wrapper
 * keeps the code obvious and works the same in any Express version.)
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { HttpError, asyncHandler };

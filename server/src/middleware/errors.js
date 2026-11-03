// ============================================================
// Centralised error handling
// ============================================================
// Every error thrown or passed to next() in the app ends up here, so error
// responses always have the same JSON shape:
//   { "error": "Human readable message", "details": { field: "message" } }

// 404 for unknown /api routes (mounted after all real routes).
function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
function errorHandler(error, req, res, next) {
  // If a response already went out, we can only delegate to Express's
  // default handler — sending a second response would crash.
  if (res.headersSent) return next(error);

  // Malformed JSON in the request body.
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }

  // Expected, deliberate errors (HttpError thrown by controllers/services).
  if (error.status) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  // Unexpected errors: log them for the developer, hide internals from users.
  console.error('[error]', error);
  return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}

module.exports = { notFound, errorHandler };

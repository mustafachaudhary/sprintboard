// ============================================================
// API client — the single place the frontend talks to the backend
// ============================================================
// Every call goes through `request`, which:
//   1. Sends JSON and expects JSON back.
//   2. Lets the browser attach the session cookie automatically.
//   3. Converts non-2xx responses into thrown ApiError objects that pages
//      can catch and show (with per-field details when the server sends them).
//   4. Tells the AuthContext when a session expired so the app can redirect
//      to /login.

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || null;
  }
}

// Set by AuthContext so this module can raise the "logged out" event
// without a circular import.
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, url, body) {
  const options = {
    method,
    headers: {},
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    // Network failure (server down, no connection).
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  // 204 No Content: nothing to parse.
  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body — leave data as null.
  }

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized && !url.startsWith('/api/auth/')) {
      onUnauthorized();
    }
    throw new ApiError(
      response.status,
      data?.error || `Request failed (${response.status}).`,
      data?.details
    );
  }

  return data;
}

// Convenience verbs used across the app.
export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  patch: (url, body) => request('PATCH', url, body),
  delete: (url) => request('DELETE', url),
};

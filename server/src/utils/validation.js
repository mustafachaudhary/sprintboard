// ============================================================
// Server-side input validation
// ============================================================
// Every request body is checked here BEFORE it touches the database.
// Each validator returns:
//   { valid: true,  values: <cleaned values> }
//   { valid: false, errors: { fieldName: 'message', ... } }
// Cleaning means: trimmed strings, lowercased email, normalised dates.

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PROJECT_COLORS = [
  '#2DD4BF', '#4A9DE0', '#3FC07A', '#E0A23C', '#E5566F', '#8A8A8F',
];

// Simple but strict-enough email shape: something@something.something
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts "2026-03-14" only (what <input type="date"> submits).
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Accepts "#7B8CFF" or "#7b8cff".
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// ---- Auth -------------------------------------------------

function validateRegistration(body) {
  const errors = {};
  const name = cleanString(body.name);
  const email = cleanString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length < 1) errors.name = 'Please tell us your name.';
  else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer.';

  if (!EMAIL_PATTERN.test(email)) errors.email = 'Please enter a valid email address.';

  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (password.length > 200) errors.password = 'Password must be 200 characters or fewer.';

  return Object.keys(errors).length === 0
    ? { valid: true, values: { name, email, password } }
    : { valid: false, errors };
}

function validateLogin(body) {
  const errors = {};
  const email = cleanString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!EMAIL_PATTERN.test(email)) errors.email = 'Please enter a valid email address.';
  if (password.length === 0) errors.password = 'Please enter your password.';

  return Object.keys(errors).length === 0
    ? { valid: true, values: { email, password } }
    : { valid: false, errors };
}

// ---- Projects ----------------------------------------------

/**
 * Validates project data.
 * partial=false (create): all fields required/defaulted.
 * partial=true  (update): only the fields present in the body are validated
 *                         and returned, so a PATCH can change one field.
 */
function validateProject(body, { partial = false } = {}) {
  const errors = {};
  const values = {};

  if (!partial || body.name !== undefined) {
    const name = cleanString(body.name);
    if (name.length < 1) errors.name = 'Project name is required.';
    else if (name.length > 80) errors.name = 'Project name must be 80 characters or fewer.';
    else values.name = name;
  }
  if (!partial || body.description !== undefined) {
    const description = cleanString(body.description);
    if (description.length > 500) errors.description = 'Description must be 500 characters or fewer.';
    else values.description = description;
  }
  if (!partial || body.color !== undefined) {
    const color = cleanString(body.color) || PROJECT_COLORS[0];
    if (!COLOR_PATTERN.test(color)) errors.color = 'Color must be a hex value like #7B8CFF.';
    else values.color = color.toUpperCase();
  }

  return Object.keys(errors).length === 0
    ? { valid: true, values }
    : { valid: false, errors };
}

// ---- Tasks ---------------------------------------------------

function validateTask(body) {
  const errors = {};
  const title = cleanString(body.title);
  const description = cleanString(body.description);
  const priority = isBlank(body.priority) ? 'medium' : body.priority;
  const deadline = isBlank(body.deadline) ? null : body.deadline;

  if (title.length < 1) errors.title = 'Task title is required.';
  else if (title.length > 140) errors.title = 'Task title must be 140 characters or fewer.';

  if (description.length > 2000) errors.description = 'Description must be 2000 characters or fewer.';

  if (!PRIORITIES.includes(priority)) errors.priority = 'Priority must be low, medium, high or urgent.';

  if (deadline !== null && !DATE_PATTERN.test(String(deadline))) {
    errors.deadline = 'Deadline must be a date in YYYY-MM-DD format.';
  }

  return Object.keys(errors).length === 0
    ? { valid: true, values: { title, description, priority, deadline } }
    : { valid: false, errors };
}

/**
 * Validates a status change coming from the Kanban board / status dropdown.
 * `position` is optional: the board sends it when reordering within a column.
 */
function validateTaskUpdate(body) {
  const errors = {};
  const updates = {};

  if (body.title !== undefined) {
    const title = cleanString(body.title);
    if (title.length < 1) errors.title = 'Task title is required.';
    else if (title.length > 140) errors.title = 'Task title must be 140 characters or fewer.';
    else updates.title = title;
  }
  if (body.description !== undefined) {
    const description = cleanString(body.description);
    if (description.length > 2000) errors.description = 'Description must be 2000 characters or fewer.';
    else updates.description = description;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.status = 'Unknown status.';
    else updates.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) errors.priority = 'Unknown priority.';
    else updates.priority = body.priority;
  }
  if (body.deadline !== undefined) {
    if (isBlank(body.deadline)) updates.deadline = null;
    else if (!DATE_PATTERN.test(String(body.deadline))) errors.deadline = 'Deadline must be a date in YYYY-MM-DD format.';
    else updates.deadline = body.deadline;
  }
  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isFinite(position)) errors.position = 'Position must be a number.';
    else updates.position = position;
  }

  return Object.keys(errors).length === 0
    ? { valid: true, values: updates }
    : { valid: false, errors };
}

// ---- Comments -------------------------------------------------

function validateComment(body) {
  const errors = {};
  const content = cleanString(body.content);

  if (content.length < 1) errors.content = 'Comment cannot be empty.';
  else if (content.length > 1000) errors.content = 'Comment must be 1000 characters or fewer.';

  return Object.keys(errors).length === 0
    ? { valid: true, values: { content } }
    : { valid: false, errors };
}

module.exports = {
  STATUSES,
  PRIORITIES,
  PROJECT_COLORS,
  validateRegistration,
  validateLogin,
  validateProject,
  validateTask,
  validateTaskUpdate,
  validateComment,
};

// ============================================================
// Small formatting / labeling helpers shared across pages
// ============================================================

export const STATUS_LABELS = {
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'done'];

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

/** "2026-03-14" -> "Mar 14" (same year) or "Mar 14, 2027". */
export function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** ISO timestamp -> "Mar 14, 09:24" style short label. */
export function formatDateTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Human deadline chip text: overdue / today / tomorrow / in N days / date.
 * `null` when the task has no deadline (callers hide the chip then).
 * Done tasks can technically be "past deadline" — but calling finished work
 * overdue is misleading, so they just show the plain date.
 */
export function describeDeadline(deadline, status) {
  if (!deadline) return null;
  if (status === 'done') return { text: formatDate(deadline), overdue: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${deadline}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((due - today) / dayMs);

  if (days < -1) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === -1) return { text: 'Yesterday', overdue: true };
  if (days === 0) return { text: 'Due today', overdue: true }; // still open, day is here
  if (days === 1) return { text: 'Tomorrow', overdue: false };
  if (days <= 7) return { text: `In ${days}d`, overdue: false };
  return { text: formatDate(deadline), overdue: false };
}

/** First letter of each word, for the sidebar avatar. */
export function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Turns a 4-digit number into "1.2k" for tight displays. */
export function compactNumber(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

import { PRIORITY_LABELS, STATUS_LABELS } from '../utils/format';

/** Status badge: Todo / In Progress / In Review / Done with tinted pill. */
export function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status] || status}</span>;
}

/** Priority badge with its colored dot. */
export function PriorityBadge({ priority }) {
  return (
    <span className={`badge badge--${priority} badge--priority`}>
      <span className={`dot dot--${priority}`} aria-hidden="true" />
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

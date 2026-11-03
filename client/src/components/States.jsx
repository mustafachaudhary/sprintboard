/** Loading block with a centered spinner (and optional label). */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

/** Friendly empty state: icon, title, hint and an optional action button. */
export function EmptyState({ icon, title, hint, action }) {
  return (
    <div className="state-block">
      {icon && <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{icon}</div>}
      <div className="state-block__title">{title}</div>
      {hint && <div className="state-block__hint">{hint}</div>}
      {action}
    </div>
  );
}

/** Error block with a retry button. */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-block">
      <div className="state-block__title">Something went wrong</div>
      <div className="state-block__hint">{message}</div>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

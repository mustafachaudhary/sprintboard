/** SprintBoard logo mark — three bars suggesting board columns. */
export default function Logo({ size = 30 }) {
  return (
    <svg className="sidebar__logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#1a1a1d" stroke="#2e2e33" />
      <rect x="6.5" y="8" width="5" height="16" rx="2.5" fill="#2DD4BF" />
      <rect x="13.5" y="8" width="5" height="10" rx="2.5" fill="#8FE8DC" />
      <rect x="20.5" y="8" width="5" height="6" rx="2.5" fill="#1FA594" />
    </svg>
  );
}

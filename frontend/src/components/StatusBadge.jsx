const VARIANTS = {
  ok: { className: 'badge badge--ok', label: 'Operational' },
  pending: { className: 'badge badge--pending', label: 'Checking' },
  error: { className: 'badge badge--error', label: 'Unavailable' },
};

/**
 * Small coloured pill reporting a service state.
 *
 * The state is conveyed by the text, not only by colour, so it still reads
 * correctly without colour perception.
 */
export default function StatusBadge({ status, label }) {
  const variant = VARIANTS[status] ?? VARIANTS.pending;

  return (
    <span className={variant.className}>
      <span className="badge__dot" aria-hidden="true" />
      {label ?? variant.label}
    </span>
  );
}

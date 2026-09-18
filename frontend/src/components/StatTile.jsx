/**
 * Headline figure with a label, icon, value, unit, and optional trend indicator.
 *
 * Uses tabular figures so numerical values render cleanly without layout jitter.
 */
export default function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  trend,
  trendDirection = 'up',
}) {
  return (
    <div className="stat-tile">
      <div className="stat-tile__header">
        <span>{label}</span>
        {Icon && (
          <span className="stat-tile__icon" aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
      </div>

      <div className="stat-tile__value tabular">
        {value}
        {unit && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              marginLeft: 'var(--space-1)',
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {(hint || trend) && (
        <div className="stat-tile__subtext">
          {trend && (
            <span className={`stat-tile__trend stat-tile__trend--${trendDirection}`}>
              {trendDirection === 'up' ? '↑' : '↓'} {trend}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}

import { Sparkles, ArrowUpRight } from 'lucide-react';

export default function AiInsightCard({
  title = 'Carbon Intelligence Snapshot',
  insights = [],
  metrics = [],
  actionText,
  onAction,
}) {
  return (
    <div className="ai-card">
      <div className="ai-card__badge">
        <Sparkles size={14} aria-hidden="true" />
        <span>CarbonIQ Intelligence</span>
      </div>

      {title && <h2 className="ai-card__title">{title}</h2>}

      {insights.length > 0 ? (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {insights.map((insight, idx) => (
            <p key={idx} className="ai-card__text">
              {insight}
            </p>
          ))}
        </div>
      ) : (
        <p className="ai-card__text">
          Continuous satellite monitoring indicates optimal canopy density and steady carbon stock
          accumulation across all active project sites.
        </p>
      )}

      {metrics.length > 0 && (
        <div className="ai-card__metrics">
          {metrics.map((m, idx) => (
            <div key={idx}>
              <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                {m.label}
              </div>
              <div
                className="tabular"
                style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}
              >
                {m.value}
              </div>
              {m.subtext && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>
                  {m.subtext}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {actionText && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <button type="button" className="button button--secondary" onClick={onAction}>
            <span>{actionText}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

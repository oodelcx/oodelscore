interface ThemeCardData {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  trend?: "up" | "down" | "flat" | null;
}

const TREND_ARROW: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "→" };

/**
 * A single theme's card in the "Top themes" row — ranked, with a
 * proportional sentiment bar instead of a plain "3 positive · 1 neutral"
 * text line, so the split reads at a glance.
 */
export function ThemeCard({ rank, theme }: { rank: number; theme: ThemeCardData }) {
  const { positive, neutral, negative } = theme.sentimentBreakdown;
  const total = positive + neutral + negative;
  const posPct = total ? (positive / total) * 100 : 0;
  const neuPct = total ? (neutral / total) * 100 : 0;
  const negPct = total ? (negative / total) * 100 : 0;

  return (
    <div className="theme-card">
      <div className="theme-card-rank">{String(rank).padStart(2, "0")}</div>
      <div className="theme-card-body">
        <div className="theme-card-head">
          <span className="theme-card-name">{theme.theme}</span>
          {theme.trend && (
            <span className={`theme-trend theme-trend-${theme.trend}`} title={`Trending ${theme.trend}`}>
              {TREND_ARROW[theme.trend]}
            </span>
          )}
        </div>
        <div className="theme-card-count">
          {theme.frequency} mention{theme.frequency === 1 ? "" : "s"}
        </div>
        <div className="theme-sentiment-bar" role="img" aria-label={`${positive} positive, ${neutral} neutral, ${negative} negative`}>
          {posPct > 0 && <span className="theme-seg theme-seg-pos" style={{ width: `${posPct}%` }} />}
          {neuPct > 0 && <span className="theme-seg theme-seg-neu" style={{ width: `${neuPct}%` }} />}
          {negPct > 0 && <span className="theme-seg theme-seg-neg" style={{ width: `${negPct}%` }} />}
        </div>
        <div className="theme-sentiment-legend">
          <span className="theme-legend-item">
            <i className="theme-dot theme-dot-pos" />
            {positive}
          </span>
          <span className="theme-legend-item">
            <i className="theme-dot theme-dot-neu" />
            {neutral}
          </span>
          <span className="theme-legend-item">
            <i className="theme-dot theme-dot-neg" />
            {negative}
          </span>
        </div>
      </div>
    </div>
  );
}

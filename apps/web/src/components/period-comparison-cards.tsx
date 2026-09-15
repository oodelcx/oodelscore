export interface Comparison {
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  changePercent: number | null;
}

export interface Comparisons {
  week: Comparison;
  month: Comparison;
  quarter: Comparison;
  year: Comparison;
}

/** Self-benchmarking: this period vs the one before it. Shared by Business and Group Overview. */
export function PeriodComparisonCards({ comparisons }: { comparisons: Comparisons }) {
  return (
    <>
      <div className="section-title">Comparative performance</div>
      <div className="grid grid-4" style={{ marginBottom: 8 }}>
        {(["week", "month", "quarter", "year"] as const).map((period) => {
          const c = comparisons[period];
          return (
            <div className="card" key={period}>
              <div className="metric-label">This {period}</div>
              <div className="metric-val">{c.starAverage !== null ? `${c.starAverage}/5` : "—"}</div>
              <div className={`metric-note ${c.changePercent !== null ? (c.changePercent >= 0 ? "up" : "down") : ""}`}>
                {c.changePercent === null
                  ? "No prior period data yet"
                  : `${c.changePercent >= 0 ? "↑" : "↓"} ${Math.abs(c.changePercent)}% vs last ${period} · ${c.responseCount} responses`}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

interface ExPulseScore {
  period: string;
  compositeScore: number;
  level: 1 | 2 | 3 | 4 | 5;
  enps: number | null;
  dimensions: {
    awareness: number;
    response: number;
    ownership: number;
    culture: number;
    outcome: number;
  };
}

interface DriverResult {
  categoryId: string;
  name: string;
  categoryAverage: number;
  correlation: number | null;
  sampleSize: number;
  confidence: "reliable" | "low" | "insufficient";
  classification: "priority" | "strength" | "moderate";
}

const CLASSIFICATION_LABELS: Record<DriverResult["classification"], string> = {
  priority: "Priority — pulling the score down",
  strength: "Strength — worth protecting",
  moderate: "Moderate influence",
};

interface PeriodComparison {
  npsScore: number | null;
  responseCount: number;
  enpsPointChange: number | null;
}

interface PeriodComparisons {
  week: PeriodComparison;
  month: PeriodComparison;
  quarter: PeriodComparison;
  year: PeriodComparison;
}

function formatPointChange(change: number | null): string {
  if (change === null) return "—";
  if (change > 0) return `+${change}`;
  return String(change);
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1 — Starting out",
  2: "Level 2 — Building the basics",
  3: "Level 3 — Established",
  4: "Level 4 — Mature",
  5: "Level 5 — Leading",
};

export default function BusinessExPulseClient() {
  const [score, setScore] = useState<ExPulseScore | null>(null);
  const [history, setHistory] = useState<ExPulseScore[]>([]);
  const [drivers, setDrivers] = useState<DriverResult[]>([]);
  const [periodComparisons, setPeriodComparisons] = useState<PeriodComparisons | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/business/ex-pulse").then(async (r) => ({ ok: r.ok, data: await r.json() })),
      fetch("/api/business/ex-driver-analysis").then(async (r) => ({ ok: r.ok, data: await r.json() })),
    ])
      .then(([pulseRes, driverRes]) => {
        if (!pulseRes.ok) {
          setForbidden(true);
          return;
        }
        setScore(pulseRes.data.score);
        setHistory(pulseRes.data.history ?? []);
        setPeriodComparisons(pulseRes.data.periodComparisons ?? null);
        if (driverRes.ok) setDrivers(driverRes.data.drivers ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-head">
          <h1>EX Pulse</h1>
        </div>
        <p className="subtitle">Loading…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <div className="page-head">
          <h1>EX Pulse</h1>
        </div>
        <div className="callout">Colleague Experience is not enabled for this account.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>EX Pulse</h1>
        <p className="subtitle" style={{ margin: 0 }}>
          Colleague Experience's own maturity score — same 5-dimension mechanic as CX Pulse, plus eNPS as the
          standing headline metric. Recomputed nightly.
        </p>
      </div>

      {!score ? (
        <div className="callout">
          No score computed yet. This fills in after the nightly recompute job runs against real colleague responses.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div className="callout" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{score.compositeScore}</div>
              <div className="subtitle" style={{ margin: 0 }}>{LEVEL_LABELS[score.level]}</div>
            </div>
            <div className="callout" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{score.enps !== null ? score.enps : "—"}</div>
              <div className="subtitle" style={{ margin: 0 }}>eNPS</div>
            </div>
          </div>

          {periodComparisons && (
            <div className="callout" style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>Own-history benchmark</h3>
              <p className="subtitle" style={{ marginTop: 0 }}>
                eNPS this period vs. the same-length period before it — your own history, not another company's.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                {(
                  [
                    ["week", "This week"],
                    ["month", "This month"],
                    ["quarter", "This quarter"],
                    ["year", "This year"],
                  ] as const
                ).map(([key, label]) => {
                  const p = periodComparisons[key];
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>
                        {p.npsScore !== null ? p.npsScore : "—"}
                        {p.enpsPointChange !== null && (
                          <span
                            style={{ fontSize: 13, fontWeight: 500, marginLeft: 6, color: p.enpsPointChange >= 0 ? "#1a7f37" : "#c62828" }}
                          >
                            {formatPointChange(p.enpsPointChange)}
                          </span>
                        )}
                      </div>
                      <div className="subtitle" style={{ margin: 0 }}>
                        {label} ({p.responseCount} response{p.responseCount === 1 ? "" : "s"})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="callout" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Dimensions</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {Object.entries(score.dimensions).map(([key, value]) => (
                <div key={key}>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
                  <div className="subtitle" style={{ margin: 0, textTransform: "capitalize" }}>{key}</div>
                </div>
              ))}
            </div>
          </div>

          {drivers.length > 0 && (
            <div className="callout" style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>What's driving this</h3>
              <p className="subtitle" style={{ marginTop: 0 }}>
                Which categories correlate most strongly with the rest of a colleague's ratings — not just their raw
                average. Last 90 days.
              </p>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Average</th>
                    <th>Correlation</th>
                    <th>Responses</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.categoryId}>
                      <td>{d.name}</td>
                      <td>{d.categoryAverage}</td>
                      <td>{d.correlation !== null ? d.correlation.toFixed(2) : "—"}</td>
                      <td>
                        {d.sampleSize}
                        {d.confidence !== "reliable" && (
                          <span className="subtitle"> ({d.confidence === "low" ? "low confidence" : "not enough data"})</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            d.classification === "priority" ? "pill-red" : d.classification === "strength" ? "pill-green" : "pill-gray"
                          }`}
                        >
                          {CLASSIFICATION_LABELS[d.classification]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history.length > 1 && (
            <div className="callout">
              <h3 style={{ marginTop: 0 }}>Recent history</h3>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Score</th>
                    <th>Level</th>
                    <th>eNPS</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.period}>
                      <td>{new Date(h.period).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td>
                      <td>{h.compositeScore}</td>
                      <td>{h.level}</td>
                      <td>{h.enps !== null ? h.enps : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/business/ex-pulse")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setForbidden(true);
          return;
        }
        setScore(data.score);
        setHistory(data.history ?? []);
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

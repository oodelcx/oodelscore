"use client";

import { useEffect, useState } from "react";

interface Dimensions {
  awareness: number;
  response: number;
  ownership: number;
  culture: number;
  outcome: number;
}
interface ScoreDoc {
  period: string;
  dimensions: Dimensions;
  compositeScore: number;
  level: number;
}
interface MaturityData {
  score: ScoreDoc | null;
  history: ScoreDoc[];
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];
const DIMENSION_LABELS: { key: keyof Dimensions; label: string; color: string }[] = [
  { key: "awareness", label: "Awareness", color: "#0F6E56" },
  { key: "response", label: "Response", color: "#7F77DD" },
  { key: "ownership", label: "Ownership", color: "#EF9F27" },
  { key: "culture", label: "Culture", color: "#E24B4A" },
  { key: "outcome", label: "Outcome", color: "#5DCAA5" },
];

export default function MaturityPage() {
  const [data, setData] = useState<MaturityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/group/maturity")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load CX Pulse.</p>;

  return (
    <div>
      <h1>CX Pulse</h1>
      <p className="subtitle">Your organization&apos;s maturity in acting on feedback, across five dimensions.</p>

      {data.score ? (
        <>
          <div className="level-badge" style={{ marginBottom: 20 }}>
            Level {data.score.level} · {LEVEL_LABELS[data.score.level]} ({data.score.compositeScore}/100)
          </div>

          {DIMENSION_LABELS.map((d) => (
            <div className="dim-row" key={d.key}>
              <div style={{ width: 110, flexShrink: 0, fontSize: 13.5 }}>{d.label}</div>
              <div className="dim-track">
                <div className="dim-fill" style={{ width: `${data.score!.dimensions[d.key]}%`, background: d.color }} />
              </div>
              <div style={{ width: 40, textAlign: "right", fontSize: 13 }}>{data.score!.dimensions[d.key]}</div>
            </div>
          ))}
        </>
      ) : (
        <div className="card empty">
          <div className="icon">📈</div>
          <div style={{ fontWeight: 500, color: "var(--text)" }}>Not scored yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Runs nightly once there&apos;s enough activity to measure.</div>
        </div>
      )}

      {data.history.length > 1 && (
        <>
          <div className="section-title">History</div>
          <table className="clean">
            <thead>
              <tr>
                <th>Month</th>
                <th>Composite</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.period}>
                  <td>{new Date(h.period).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</td>
                  <td>{h.compositeScore}</td>
                  <td>
                    Level {h.level} · {LEVEL_LABELS[h.level]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

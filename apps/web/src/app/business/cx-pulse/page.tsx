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
  compositeScore: number;
  level: number;
  dimensions: Dimensions;
}
interface SiblingRow {
  businessId: string;
  name: string;
  compositeScore: number | null;
  level: number | null;
}
interface RegionData {
  own: ScoreDoc | null;
  ownHistory: ScoreDoc[];
  region: string | null;
  siblings: SiblingRow[];
  regionAverages: Record<string, number | null>;
  regionBusinessCount: number;
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];
const DIMENSION_LABELS: { key: keyof Dimensions; label: string }[] = [
  { key: "awareness", label: "Awareness" },
  { key: "response", label: "Response" },
  { key: "ownership", label: "Ownership" },
  { key: "culture", label: "Culture" },
  { key: "outcome", label: "Outcome" },
];

function trendPath(history: ScoreDoc[]): string | null {
  if (history.length < 2) return null;
  const width = 600;
  const height = 90;
  const step = width / (history.length - 1);
  return history.map((h, i) => `${(i * step).toFixed(1)},${(height - (h.compositeScore / 100) * height).toFixed(1)}`).join(" ");
}

export default function BranchCxPulsePage() {
  const [data, setData] = useState<RegionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/cx-pulse/region")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load CX Pulse.</p>;

  const history = [...data.ownHistory].reverse();
  const points = trendPath(history);

  return (
    <div>
      <h1>CX Pulse</h1>
      <p className="subtitle">
        Your score, trend, and the other branches in your region{data.region ? ` (${data.region})` : ""} — something a
        standalone business can&apos;t see.
      </p>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Your score</h3>
          <div className="metric-val" style={{ fontSize: 30, color: "var(--green)" }}>
            {data.own ? data.own.compositeScore : "—"}
          </div>
          <div className="metric-note">
            {data.own ? `CX Pulse: Level ${data.own.level} · ${LEVEL_LABELS[data.own.level]}` : "Not yet scored"}
          </div>
        </div>
        <div className="card">
          <h3>Region average</h3>
          <div className="metric-val" style={{ fontSize: 30 }}>
            {Math.round(DIMENSION_KEYS_AVG(data.regionAverages))}
          </div>
          <div className="metric-note">{data.regionBusinessCount} branches in your region</div>
        </div>
      </div>

      {points && (
        <>
          <div className="section-title">Your trend — last {history.length} months</div>
          <div className="card" style={{ marginBottom: 20 }}>
            <svg viewBox="0 0 600 90" width="100%" height="110" preserveAspectRatio="none">
              <polyline fill="none" stroke="var(--green)" strokeWidth="2" points={points} />
            </svg>
          </div>
        </>
      )}

      <div className="section-title">By dimension vs. your region</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="bars">
          {DIMENSION_LABELS.map((d) => (
            <div key={d.key}>
              <div className="bar-row">
                <div className="bar-label">You — {d.label}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${data.own?.dimensions[d.key] ?? 0}%`, background: "#0F6E56" }} />
                </div>
                <div className="bar-val">{data.own?.dimensions[d.key] ?? "—"}</div>
              </div>
              <div className="bar-row">
                <div className="bar-label">Region — {d.label}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${data.regionAverages[d.key] ?? 0}%`, background: "#7F77DD" }} />
                </div>
                <div className="bar-val">{data.regionAverages[d.key] ?? "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">Other branches in {data.region ?? "your region"}</div>
      <div className="card">
        <table className="clean">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Score</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {data.siblings.map((s) => (
              <tr key={s.businessId}>
                <td>{s.name}</td>
                <td>{s.compositeScore ?? "—"}</td>
                <td>
                  {s.level ? (
                    <span className="pill pill-blue">
                      L{s.level} · {LEVEL_LABELS[s.level]}
                    </span>
                  ) : (
                    <span className="pill pill-gray">Not scored yet</span>
                  )}
                </td>
              </tr>
            ))}
            {data.siblings.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
                  No other branches share your region yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DIMENSION_KEYS_AVG(averages: Record<string, number | null>): number {
  const values = Object.values(averages).filter((v): v is number => v !== null);
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

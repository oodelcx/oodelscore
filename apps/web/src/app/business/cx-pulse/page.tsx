"use client";

import { useEffect, useState } from "react";

interface Dimensions {
  awareness: number;
  response: number;
  ownership: number;
  culture: number;
  outcome: number;
}
interface RegionData {
  own: { compositeScore: number; level: number; dimensions: Dimensions } | null;
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

  return (
    <div>
      <h1>CX Pulse</h1>
      <p className="subtitle">Your score, benchmarked against your region — something a standalone business can&apos;t see.</p>

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
            {Math.round(
              DIMENSION_KEYS_AVG(data.regionAverages)
            )}
          </div>
          <div className="metric-note">{data.regionBusinessCount} branches</div>
        </div>
      </div>

      <div className="section-title">By dimension vs. your region</div>
      <div className="card">
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
    </div>
  );
}

function DIMENSION_KEYS_AVG(averages: Record<string, number | null>): number {
  const values = Object.values(averages).filter((v): v is number => v !== null);
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

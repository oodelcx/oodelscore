"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

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
interface OwnData {
  score: ScoreDoc | null;
  history: ScoreDoc[];
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

export default function StandaloneCxPulseClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [data, setData] = useState<OwnData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/cx-pulse")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load CX Pulse.</p>;

  const history = [...data.history].reverse();
  const points = trendPath(history);

  return (
    <div>
      <h1>
        CX Pulse
        <InfoTip text={tooltips["cx-pulse-composite"]} />
      </h1>
      <p className="subtitle">Your customer-experience maturity score and how it&apos;s trending over time.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Your score</h3>
        <div className="metric-val" style={{ fontSize: 30, color: "var(--green)" }}>
          {data.score ? data.score.compositeScore : "—"}
        </div>
        <div className="metric-note">
          {data.score ? `CX Pulse: Level ${data.score.level} · ${LEVEL_LABELS[data.score.level]}` : "Not yet scored"}
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

      <div className="section-title">
        By dimension
        <InfoTip text={tooltips["dimensions"]} />
      </div>
      <div className="card">
        <div className="bars">
          {DIMENSION_LABELS.map((d) => (
            <div key={d.key} className="bar-row">
              <div className="bar-label">{d.label}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${data.score?.dimensions[d.key] ?? 0}%`, background: "#0F6E56" }} />
              </div>
              <div className="bar-val">{data.score?.dimensions[d.key] ?? "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

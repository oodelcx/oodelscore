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
interface BranchRow {
  businessId: string;
  name: string;
  region: string | null;
  compositeScore: number | null;
  level: number | null;
}
interface ChecklistItem {
  label: string;
  done: boolean;
}
interface MaturityData {
  score: ScoreDoc | null;
  history: ScoreDoc[];
  branches: BranchRow[];
  groupAvgDimensions: Record<string, number | null>;
  checklist: ChecklistItem[];
  levelDescriptions?: string[];
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];
const FALLBACK_LEVEL_BLURBS = [
  "",
  "Feedback is collected but rarely reviewed.",
  "Managers see scores, but there's no routine action on them.",
  "Negative feedback gets actioned reliably.",
  "Named owners, playbooks, and closed loops on issues.",
  "Feedback drives measurable strategy shifts.",
];
const DIMENSION_LABELS: { key: keyof Dimensions; label: string; color: string }[] = [
  { key: "awareness", label: "Awareness", color: "#0F6E56" },
  { key: "response", label: "Response", color: "#7F77DD" },
  { key: "ownership", label: "Ownership", color: "#EF9F27" },
  { key: "culture", label: "Culture", color: "#E24B4A" },
  { key: "outcome", label: "Outcome", color: "#5DCAA5" },
];

function levelPillClass(level: number) {
  if (level >= 4) return "pill-green";
  if (level === 3) return "pill-amber";
  return "pill-red";
}

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

  const blurbs = data.levelDescriptions && data.levelDescriptions.length === 5 ? ["", ...data.levelDescriptions] : FALLBACK_LEVEL_BLURBS;

  return (
    <div>
      <h1>CX Pulse</h1>
      <p className="subtitle">Your organization&apos;s maturity in acting on feedback, across five dimensions.</p>

      {!data.score ? (
        <div className="card empty">
          <div className="icon">📈</div>
          <div style={{ fontWeight: 500, color: "var(--text)" }}>Not scored yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Runs nightly once there&apos;s enough activity to measure.</div>
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "minmax(240px, 300px) 1fr", marginBottom: 20, alignItems: "stretch" }}>
            <div className="card">
              <div className="metric-val" style={{ fontSize: 40, color: "var(--accent)" }}>
                {data.score.compositeScore}
                <span style={{ fontSize: 16, color: "var(--text-3)" }}>/100</span>
              </div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>
                Level {data.score.level} · {LEVEL_LABELS[data.score.level]}
              </div>
              <p className="subtitle" style={{ margin: "6px 0 0" }}>{blurbs[data.score.level]}</p>
            </div>
            <div className="grid grid-5">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={lvl}
                  className="card"
                  style={{
                    padding: "12px 10px",
                    background: lvl === data.score!.level ? "var(--accent-bg)" : "var(--card)",
                    border: lvl === data.score!.level ? "1px solid var(--accent)" : "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>0{lvl}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: lvl === data.score!.level ? "var(--accent)" : "var(--text)" }}>
                    {LEVEL_LABELS[lvl]}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4, lineHeight: 1.4 }}>{blurbs[lvl]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-title">By dimension</div>
          <div className="grid grid-5" style={{ marginBottom: 20 }}>
            {DIMENSION_LABELS.map((d) => {
              const value = data.score!.dimensions[d.key];
              const groupAvg = data.groupAvgDimensions[d.key];
              return (
                <div className="card" key={d.key} style={{ borderTop: `3px solid ${d.color}` }}>
                  <div className="metric-label">{d.label}</div>
                  <div className="metric-val">{value}</div>
                  <div className="dim-track-thin" style={{ marginTop: 8 }}>
                    <div className="dim-fill" style={{ width: `${value}%`, background: d.color }} />
                  </div>
                  <div className="metric-note" style={{ marginTop: 8 }}>
                    Branch avg: {groupAvg !== null ? groupAvg : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <div>
              <div className="section-title">What would move you to the next level</div>
              <div className="card">
                {data.checklist.map((c, i) => (
                  <div key={i} className="config-row" style={{ padding: "6px 0", borderBottom: i === data.checklist.length - 1 ? "none" : undefined }}>
                    <span style={{ marginRight: 8 }}>{c.done ? "✅" : "⬜"}</span>
                    <span style={{ color: c.done ? "var(--text-3)" : "var(--text)", textDecoration: c.done ? "line-through" : undefined }}>
                      {c.label}
                    </span>
                  </div>
                ))}
                {data.checklist.length === 0 && <p className="subtitle" style={{ margin: 0 }}>Nothing outstanding right now.</p>}
              </div>
            </div>

            <div>
              <div className="section-title">Branch-level maturity</div>
              <div className="card" style={{ padding: 0 }}>
                <table className="clean">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Score</th>
                      <th>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.branches.map((b) => (
                      <tr key={b.businessId}>
                        <td>
                          {b.name}
                          {b.region && <div className="card-sub">{b.region}</div>}
                        </td>
                        <td>{b.compositeScore ?? "—"}</td>
                        <td>
                          {b.level ? (
                            <span className={`pill ${levelPillClass(b.level)}`}>
                              L{b.level} · {LEVEL_LABELS[b.level]}
                            </span>
                          ) : (
                            <span className="pill pill-gray">Not scored</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.branches.length === 0 && (
                      <tr>
                        <td colSpan={3} className="subtitle">
                          No branches yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface Weights {
  awareness: number;
  response: number;
  ownership: number;
  culture: number;
  outcome: number;
}
interface Signal {
  ownerType: string;
  ownerId: string;
  name: string;
  level: number;
  signal: "at_risk" | "expansion_ready";
  branchSeatLimit?: number | null;
  activeBranchCount?: number;
}

const LEVEL_NAMES = ["Collecting", "Reacting", "Responding", "Improving", "Embedded"];

const DIMENSION_LABELS: { key: keyof Weights; label: string }[] = [
  { key: "awareness", label: "Awareness" },
  { key: "response", label: "Response" },
  { key: "ownership", label: "Ownership" },
  { key: "culture", label: "Culture" },
  { key: "outcome", label: "Outcome" },
];

export default function CxPulseAdminPage() {
  const [weights, setWeights] = useState<Weights | null>(null);
  const [pulseQuestions, setPulseQuestions] = useState("");
  const [levelDescriptions, setLevelDescriptions] = useState<string[]>(["", "", "", "", ""]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/cx-pulse-framework").then((r) => r.json()),
      fetch("/api/admin/cx-pulse-portfolio").then((r) => r.json()),
    ]).then(([frameworkData, portfolioData]) => {
      setWeights(frameworkData.framework?.weights ?? null);
      setPulseQuestions((frameworkData.framework?.pulseQuestions ?? []).join("\n"));
      const descs = frameworkData.framework?.levelDescriptions;
      if (Array.isArray(descs) && descs.length === 5) setLevelDescriptions(descs);
      setSignals(portfolioData.signals ?? []);
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!weights) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/cx-pulse-framework", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weights,
        pulseQuestions: pulseQuestions.split("\n").map((q) => q.trim()).filter(Boolean),
        levelDescriptions,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) setError(data.message);
  }

  if (loading) return <p className="subtitle">Loading…</p>;

  const total = weights ? Object.values(weights).reduce((sum, v) => sum + v, 0) : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CX Pulse</h1>
          <p className="subtitle">Framework weights, quarterly self-assessment questions, and portfolio signals.</p>
        </div>
      </div>

      {weights && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Dimension weights</h3>
          <p className="card-sub">Must sum to 100. Recomputed nightly — a change here applies from the next run.</p>
          <div className="field-row">
            {DIMENSION_LABELS.map((d) => (
              <div className="field" key={d.key}>
                <label>{d.label}</label>
                <input
                  type="number"
                  value={weights[d.key]}
                  onChange={(e) => setWeights((w) => (w ? { ...w, [d.key]: Number(e.target.value) } : w))}
                />
              </div>
            ))}
          </div>
          <p className="field-hint" style={{ color: total !== 100 ? "crimson" : undefined }}>
            Total: {total}
            {total !== 100 ? " — must equal 100" : ""}
          </p>
          <p className="field-hint">Quarterly self-assessment questions (one per line)</p>
          <textarea
            style={{ width: "100%", minHeight: 80 }}
            value={pulseQuestions}
            onChange={(e) => setPulseQuestions(e.target.value)}
          />

          <p className="field-hint" style={{ marginTop: 16 }}>
            Maturity ladder descriptions — shown under each level on the real CX Pulse page.
          </p>
          {LEVEL_NAMES.map((name, i) => (
            <div className="field" key={name} style={{ marginBottom: 8 }}>
              <label>
                Level {i + 1} · {name}
              </label>
              <input
                value={levelDescriptions[i] ?? ""}
                onChange={(e) =>
                  setLevelDescriptions((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
            </div>
          ))}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark" style={{ marginTop: 12 }} disabled={saving || total !== 100} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      <h3 className="section-label" style={{ marginTop: 0 }}>
        Portfolio signals
      </h3>
      <p className="card-sub">Accounts stuck at Level 1–2 (at risk) or Level 4–5 (expansion ready) for 3+ consecutive months.</p>
      <table className="clean">
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th>Level</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={`${s.ownerType}-${s.ownerId}`}>
              <td>{s.name}</td>
              <td>{s.ownerType === "business" ? "Business" : "Parent Org"}</td>
              <td>
                {s.ownerType === "parentOrg" && (
                  <>
                    {s.activeBranchCount ?? 0} of {s.branchSeatLimit ?? "∞"} branches used ·{" "}
                  </>
                )}
                Level {s.level} · {LEVEL_NAMES[s.level - 1] ?? ""}
              </td>
              <td>
                <span className={`pill ${s.signal === "at_risk" ? "pill-red" : "pill-green"}`}>
                  {s.signal === "at_risk" ? "At risk" : "Expansion ready"}
                </span>
              </td>
            </tr>
          ))}
          {signals.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
                No accounts have 3+ months of CX Pulse history yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

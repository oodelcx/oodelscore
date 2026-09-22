"use client";

import { useEffect, useState } from "react";

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

/**
 * Oversight only — which accounts are stuck at risk or ready to expand.
 * The framework weights/questions/ladder-description editor that used to
 * live on this page moved to Admin -> Content settings (Phase 4 item 17):
 * that's CMS copy, this is live account data, and the two shouldn't
 * compete for the same screen.
 */
export default function CxPulseAdminPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/cx-pulse-portfolio")
      .then((r) => r.json())
      .then((data) => setSignals(data.signals ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CX Pulse Oversight</h1>
          <p className="subtitle">
            Accounts stuck at Level 1–2 (at risk) or Level 4–5 (expansion ready) for 3+ consecutive months.
          </p>
        </div>
      </div>

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

      <p className="field-hint" style={{ marginTop: 16 }}>
        Framework weights, self-assessment questions, and ladder descriptions live on{" "}
        <a href="/admin/content">Content settings</a>.
      </p>
    </div>
  );
}

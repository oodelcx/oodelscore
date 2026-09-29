"use client";

import { useEffect, useState } from "react";

interface Impact {
  inputsComplete: boolean;
  atRiskCount: number;
  annualCustomerValue: number | null;
  revenueAtRisk: number | null;
  replacementCost: number | null;
  totalExposure: number | null;
  currencySymbol: string;
}
interface BranchRow {
  businessId: string;
  name: string;
  impact: Impact;
}
interface Data {
  windowDays: number;
  branches: BranchRow[];
  branchesConfigured: number;
  branchesTotal: number;
  totals: { atRiskCount: number; revenueAtRisk: number; replacementCost: number; totalExposure: number };
}

function fmt(value: number, currency = "£"): string {
  return `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Read-only org rollup — each branch enters its own figures on its own
 * Business Value page; this just sums what's already there. Branches with
 * incomplete inputs are called out rather than silently excluded.
 */
export default function GroupBusinessValueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/group/business-value")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setData(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="subtitle">Loading…</p>;

  const currency = data.branches[0]?.impact.currencySymbol ?? "£";

  return (
    <div>
      <h1>Business Value</h1>
      <p className="subtitle">
        Network-wide roll-up over the last {data.windowDays} days — each branch's own figures, summed. Branches
        that haven't filled theirs in yet contribute only their at-risk response count.
      </p>

      {data.branchesConfigured < data.branchesTotal && (
        <div className="callout-amber" style={{ marginBottom: 20 }}>
          {data.branchesTotal - data.branchesConfigured} of {data.branchesTotal} branch
          {data.branchesTotal - data.branchesConfigured === 1 ? "" : "es"} haven't entered their figures yet —
          the totals below undercount until they do.
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">At-risk responses ({data.windowDays}d)</div>
          <div className="metric-val">{data.totals.atRiskCount}</div>
        </div>
        <div className="card">
          <div className="metric-label">Revenue at risk</div>
          <div className="metric-val">{fmt(data.totals.revenueAtRisk, currency)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Replacement cost</div>
          <div className="metric-val">{fmt(data.totals.replacementCost, currency)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Total exposure</div>
          <div className="metric-val">{fmt(data.totals.totalExposure, currency)}</div>
        </div>
      </div>

      <div className="card">
        <h3>By branch</h3>
        <table className="clean">
          <thead>
            <tr>
              <th>Branch</th>
              <th>At-risk</th>
              <th>Total exposure</th>
              <th>Figures entered</th>
            </tr>
          </thead>
          <tbody>
            {data.branches.map((b) => (
              <tr key={b.businessId}>
                <td>{b.name}</td>
                <td>{b.impact.atRiskCount}</td>
                <td>{b.impact.totalExposure !== null ? fmt(b.impact.totalExposure, b.impact.currencySymbol) : "—"}</td>
                <td>
                  <span className={`pill ${b.impact.inputsComplete ? "pill-green" : "pill-gray"}`}>
                    {b.impact.inputsComplete ? "Yes" : "Not yet"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

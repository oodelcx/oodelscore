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
interface Inputs {
  avgTransactionValue: number | null;
  visitsPerYear: number | null;
  acquisitionCost: number | null;
  atRiskStarThreshold: number;
  currencySymbol: string;
}
interface BranchRow {
  businessId: string;
  name: string;
  inputs: Inputs;
  impact: Impact;
}
interface Data {
  windowDays: number;
  branches: BranchRow[];
  branchesConfigured: number;
  branchesTotal: number;
  totals: { atRiskCount: number; revenueAtRisk: number; replacementCost: number; totalExposure: number };
  canEdit: boolean;
}

function fmt(value: number, currency = "£"): string {
  return `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function num(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Org rollup with per-branch editing — the Group owner sets each branch's
 * figures from here (branches never edit their own, see the business
 * route's PATCH), instead of the old read-only-sum version.
 */
export default function GroupBusinessValueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Inputs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    fetch("/api/group/business-value")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setData(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(load, []);

  function openEdit(b: BranchRow) {
    setEditingId(b.businessId);
    setDraft({ ...b.inputs });
    setSaveError(null);
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/group/business-value", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: editingId, ...draft }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.message ?? "Failed to save");
      setEditingId(null);
      setDraft(null);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

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
              {data.canEdit && <th></th>}
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
                {data.canEdit && (
                  <td>
                    <button className="btn btn-sm" onClick={() => openEdit(b)}>
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && draft && (
        <div className="modal-overlay" onClick={() => !saving && setEditingId(null)}>
          <div className="modal card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit figures — {data.branches.find((b) => b.businessId === editingId)?.name}</h3>
            <p className="card-sub" style={{ margin: "0 0 12px" }}>
              These figures apply only to this branch. Nothing here connects to your actual finance systems.
            </p>

            <div className="field-row">
              <div className="field">
                <label>Currency symbol</label>
                <input
                  type="text"
                  value={draft.currencySymbol}
                  onChange={(e) => setDraft({ ...draft, currencySymbol: e.target.value })}
                  style={{ maxWidth: 80 }}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Average transaction value</label>
                <input
                  type="number"
                  value={draft.avgTransactionValue ?? ""}
                  onChange={(e) => setDraft({ ...draft, avgTransactionValue: num(e.target.value) })}
                  placeholder="e.g. 25"
                />
              </div>
              <div className="field">
                <label>Visits per customer per year</label>
                <input
                  type="number"
                  value={draft.visitsPerYear ?? ""}
                  onChange={(e) => setDraft({ ...draft, visitsPerYear: num(e.target.value) })}
                  placeholder="e.g. 12"
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Cost to acquire a replacement customer</label>
                <input
                  type="number"
                  value={draft.acquisitionCost ?? ""}
                  onChange={(e) => setDraft({ ...draft, acquisitionCost: num(e.target.value) })}
                  placeholder="e.g. 40"
                />
              </div>
              <div className="field">
                <label>At-risk star rating (at or below)</label>
                <select
                  value={draft.atRiskStarThreshold}
                  onChange={(e) => setDraft({ ...draft, atRiskStarThreshold: Number(e.target.value) })}
                >
                  <option value={1}>1 star</option>
                  <option value={2}>2 stars or fewer</option>
                  <option value={3}>3 stars or fewer</option>
                </select>
              </div>
            </div>

            {saveError && <p className="error-text">{saveError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-dark btn-sm" disabled={saving} onClick={saveEdit}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn btn-sm" disabled={saving} onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface Inputs {
  avgTransactionValue: number | null;
  visitsPerYear: number | null;
  acquisitionCost: number | null;
  atRiskStarThreshold: number;
  currencySymbol: string;
}
interface Impact {
  inputsComplete: boolean;
  atRiskCount: number;
  annualCustomerValue: number | null;
  revenueAtRisk: number | null;
  replacementCost: number | null;
  totalExposure: number | null;
  currencySymbol: string;
}

function fmt(value: number | null, currency: string): string {
  if (value === null) return "—";
  return `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function BusinessValueClient() {
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load() {
    fetch("/api/business/business-value")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setInputs(d.inputs);
        setImpact(d.impact);
        setWindowDays(d.windowDays);
        setCanEdit(!!d.canEdit);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(load, []);

  async function save() {
    if (!inputs) return;
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/business/business-value", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.message ?? "Failed to save");
      return;
    }
    setSaved(true);
    load();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!inputs || !impact) return <p className="subtitle">Loading…</p>;

  function num(v: string): number | null {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <div>
      <h1>Business Value</h1>
      <p className="subtitle">
        What negative feedback is actually worth — using figures you enter about your own business, nothing pulled
        from an accounting system. Recomputed every time you visit this page, over the last {windowDays} days.
      </p>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">At-risk responses ({windowDays}d)</div>
          <div className="metric-val">{impact.atRiskCount}</div>
        </div>
        <div className="card">
          <div className="metric-label">Est. annual value per customer</div>
          <div className="metric-val">{fmt(impact.annualCustomerValue, impact.currencySymbol)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Revenue at risk</div>
          <div className="metric-val">{fmt(impact.revenueAtRisk, impact.currencySymbol)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Total exposure</div>
          <div className="metric-val">{fmt(impact.totalExposure, impact.currencySymbol)}</div>
          <p style={{ fontSize: 11.5, color: "var(--text-2)", margin: "4px 0 0" }}>
            Revenue at risk + cost to replace {impact.atRiskCount} customer{impact.atRiskCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {!impact.inputsComplete && canEdit && (
        <div className="callout-amber" style={{ marginBottom: 20 }}>
          Fill in the fields below to see a computed £/$ figure — until then, only the at-risk response count is
          shown.
        </div>
      )}

      {!canEdit && (
        <div className="callout" style={{ marginBottom: 20 }}>
          These figures are set centrally — only the account owner (your parent organization's owner, for a branch)
          enters them. This page shows the resulting numbers, read-only.
        </div>
      )}

      {canEdit && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>Your figures</h3>
          <p className="card-sub" style={{ margin: "0 0 12px" }}>
            Entered once, reused every time this page recomputes. Nothing here connects to your actual finance
            systems — these are your own estimates.
          </p>

          <div className="field-row">
            <div className="field">
              <label>Currency symbol</label>
              <input
                type="text"
                value={inputs.currencySymbol}
                onChange={(e) => setInputs({ ...inputs, currencySymbol: e.target.value })}
                style={{ maxWidth: 80 }}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Average transaction value</label>
              <input
                type="number"
                value={inputs.avgTransactionValue ?? ""}
                onChange={(e) => setInputs({ ...inputs, avgTransactionValue: num(e.target.value) })}
                placeholder="e.g. 25"
              />
            </div>
            <div className="field">
              <label>Visits per customer per year</label>
              <input
                type="number"
                value={inputs.visitsPerYear ?? ""}
                onChange={(e) => setInputs({ ...inputs, visitsPerYear: num(e.target.value) })}
                placeholder="e.g. 12"
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Cost to acquire a replacement customer</label>
              <input
                type="number"
                value={inputs.acquisitionCost ?? ""}
                onChange={(e) => setInputs({ ...inputs, acquisitionCost: num(e.target.value) })}
                placeholder="e.g. 40"
              />
            </div>
            <div className="field">
              <label>At-risk star rating (at or below)</label>
              <select
                value={inputs.atRiskStarThreshold}
                onChange={(e) => setInputs({ ...inputs, atRiskStarThreshold: Number(e.target.value) })}
              >
                <option value={1}>1 star</option>
                <option value={2}>2 stars or fewer</option>
                <option value={3}>3 stars or fewer</option>
              </select>
            </div>
          </div>

          <button className="btn btn-dark btn-sm" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span style={{ marginLeft: 10, fontSize: 12.5, color: "var(--text-2)" }}>Saved.</span>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface RuleRow {
  _id: string;
  ruleType: string;
  metric: string;
  threshold: number | null;
  recipients: string[];
  active: boolean;
  isInherited?: boolean;
}

export default function BusinessAlertRulesPage() {
  const [ownRules, setOwnRules] = useState<RuleRow[]>([]);
  const [inheritedRules, setInheritedRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleType, setRuleType] = useState("fixed_threshold");
  const [metric, setMetric] = useState("star_average");
  const [threshold, setThreshold] = useState("");
  const [recipients, setRecipients] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/business/alert-rules")
      .then((res) => res.json())
      .then((data) => {
        setOwnRules(data.ownRules ?? []);
        setInheritedRules(data.inheritedRules ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createRule() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/alert-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleType,
        metric,
        threshold: threshold ? Number(threshold) : null,
        recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setThreshold("");
    setRecipients("");
    load();
  }

  async function toggleActive(rule: RuleRow) {
    await fetch(`/api/business/alert-rules/${rule._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    load();
  }

  async function removeRule(id: string) {
    await fetch(`/api/business/alert-rules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Alert Rules</h1>
          <p className="subtitle">Get notified when your metrics slip.</p>
        </div>
      </div>

      <div className="card">
        <h3>New rule</h3>
        <div className="field-row">
          <div className="field">
            <label>Type</label>
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
              <option value="fixed_threshold">Fixed threshold</option>
              <option value="nps_floor">NPS floor</option>
            </select>
          </div>
          <div className="field">
            <label>Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="star_average">Star average</option>
              <option value="nps">NPS</option>
            </select>
          </div>
          <div className="field">
            <label>Threshold</label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Recipients (comma-separated emails)</label>
          <input value={recipients} onChange={(e) => setRecipients(e.target.value)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createRule}>
          {creating ? "Creating…" : "+ Create rule"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <>
          <h3 className="section-label" style={{ marginTop: 0 }}>Your rules</h3>
          <table className="clean">
            <thead>
              <tr>
                <th>Type</th>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Recipients</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ownRules.map((r) => (
                <tr key={r._id}>
                  <td>{r.ruleType}</td>
                  <td>{r.metric}</td>
                  <td>{r.threshold ?? "—"}</td>
                  <td>{r.recipients.join(", ") || "—"}</td>
                  <td>
                    <span className={`pill ${r.active ? "pill-green" : "pill-gray"}`}>{r.active ? "Active" : "Paused"}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" style={{ marginRight: 8 }} onClick={() => toggleActive(r)}>
                      {r.active ? "Pause" : "Resume"}
                    </button>
                    <button className="icon-btn btn-danger" onClick={() => removeRule(r._id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
              {ownRules.length === 0 && (
                <tr>
                  <td colSpan={6} className="subtitle">
                    No rules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {inheritedRules.length > 0 && (
            <>
              <h3 className="section-label">Inherited from your organization (read-only)</h3>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Metric</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {inheritedRules.map((r) => (
                    <tr key={r._id}>
                      <td>{r.ruleType}</td>
                      <td>{r.metric}</td>
                      <td>{r.threshold ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}

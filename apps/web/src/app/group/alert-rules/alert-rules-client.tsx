"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

interface RuleRow {
  _id: string;
  scope: string;
  ruleType: string;
  metric: string;
  threshold: number | null;
  sensitivity: number | null;
  dropPercent: number | null;
  region: string;
  recipients: string[];
  delivery: string;
  active: boolean;
  firedCount: number;
}
interface BusinessRow {
  _id: string;
  name: string;
}

export default function GroupAlertRulesClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [orgRules, setOrgRules] = useState<RuleRow[]>([]);
  const [businessRules, setBusinessRules] = useState<RuleRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState("parentOrg_all");
  const [ruleType, setRuleType] = useState("fixed_threshold");
  const [metric, setMetric] = useState("star_average");
  const [threshold, setThreshold] = useState("");
  const [sensitivity, setSensitivity] = useState("2");
  const [dropPercent, setDropPercent] = useState("20");
  const [baselineWindowDays, setBaselineWindowDays] = useState("30");
  const [region, setRegion] = useState("");
  const [recipients, setRecipients] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/group/alert-rules")
      .then((res) => res.json())
      .then((data) => {
        setOrgRules(data.orgRules ?? []);
        setBusinessRules(data.businessRules ?? []);
        setBusinesses(data.businesses ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createRule() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/alert-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        ruleType,
        metric,
        region: scope === "parentOrg_region" ? region : undefined,
        threshold: ruleType === "fixed_threshold" || ruleType === "nps_floor" ? Number(threshold) : null,
        sensitivity: ruleType === "regional_outlier" ? Number(sensitivity) : null,
        dropPercent: ruleType === "sudden_drop" ? Number(dropPercent) : null,
        baselineWindowDays: ruleType === "sudden_drop" ? Number(baselineWindowDays) : null,
        recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setRecipients("");
    load();
  }

  async function removeRule(id: string) {
    await fetch(`/api/group/alert-rules/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(rule: RuleRow) {
    await fetch(`/api/group/alert-rules/${rule._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Alert Rules</h1>
          <p className="subtitle">Rules here cascade to every business in scope.</p>
        </div>
      </div>

      <div className="card" data-tour="alert-new-rule">
        <h3>New rule</h3>
        <div className="field-row">
          <div className="field">
            <label>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="parentOrg_all">All businesses</option>
              <option value="parentOrg_region">One region</option>
            </select>
          </div>
          {scope === "parentOrg_region" && (
            <div className="field">
              <label>Region</label>
              <input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Type</label>
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
              <option value="fixed_threshold">Fixed threshold</option>
              <option value="nps_floor">NPS floor</option>
              <option value="regional_outlier">Regional outlier</option>
              <option value="sudden_drop">Sudden drop</option>
            </select>
          </div>
        </div>

        {(ruleType === "fixed_threshold" || ruleType === "nps_floor") && (
          <div className="field-row">
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
        )}
        {ruleType === "regional_outlier" && (
          <div className="field">
            <label>
              Sensitivity (std deviations below the group average)
              <InfoTip text={tooltips["regional-outlier"]} />
            </label>
            <input type="number" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)} />
          </div>
        )}
        {ruleType === "sudden_drop" && (
          <div className="field-row">
            <div className="field">
              <label>
                Drop % vs baseline
                <InfoTip text={tooltips["sudden-drop"]} />
              </label>
              <input type="number" value={dropPercent} onChange={(e) => setDropPercent(e.target.value)} />
            </div>
            <div className="field">
              <label>Baseline window (days)</label>
              <input type="number" value={baselineWindowDays} onChange={(e) => setBaselineWindowDays(e.target.value)} />
            </div>
          </div>
        )}

        <div className="field">
          <label>
            Recipients (comma-separated emails)
            <InfoTip text={tooltips["recipients"]} />
          </label>
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
          <h3 className="section-label" style={{ marginTop: 0 }}>
            Your organization rules
            <InfoTip text={tooltips["org-rules"]} />
          </h3>
          <p className="section-sub">This is what produces the &quot;Flagged&quot; counts you see on Overview.</p>
          <table className="clean" data-tour="alert-rules-table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Type</th>
                <th>Condition</th>
                <th>Delivery</th>
                <th>Fired this week</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orgRules.map((r) => (
                <tr key={r._id}>
                  <td>{r.scope === "parentOrg_region" ? `Region: ${r.region}` : "All businesses"}</td>
                  <td>{r.ruleType.replace(/_/g, " ")}</td>
                  <td>{r.metric || "—"} {r.threshold ?? r.sensitivity ?? r.dropPercent ?? ""}</td>
                  <td>{r.delivery === "weekly_digest" ? "Weekly digest" : "Immediate email"}</td>
                  <td>
                    {r.firedCount > 0 ? (
                      <span className="pill pill-red">{r.firedCount} branch{r.firedCount === 1 ? "" : "es"} →</span>
                    ) : (
                      <span className="pill pill-green">0</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`pill ${r.active ? "pill-green" : "pill-gray"}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleActive(r)}
                      title="Click to toggle"
                    >
                      {r.active ? "On" : "Off"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="icon-btn btn-danger" onClick={() => removeRule(r._id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
              {orgRules.length === 0 && (
                <tr>
                  <td colSpan={7} className="subtitle">
                    No organization-wide rules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 className="section-label">
            Individual business rules (oversight)
            <InfoTip text={tooltips["business-rules-oversight"]} />
          </h3>
          <table className="clean">
            <thead>
              <tr>
                <th>Business</th>
                <th>Type</th>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Fired this week</th>
              </tr>
            </thead>
            <tbody>
              {businessRules.map((r) => (
                <tr key={r._id}>
                  <td>{businesses.find((b) => b._id === (r as unknown as { ownerId: string }).ownerId)?.name ?? "—"}</td>
                  <td>{r.ruleType.replace(/_/g, " ")}</td>
                  <td>{r.metric || "—"}</td>
                  <td>{r.threshold ?? "—"}</td>
                  <td>{r.firedCount}</td>
                </tr>
              ))}
              {businessRules.length === 0 && (
                <tr>
                  <td colSpan={5} className="subtitle">
                    No business-level rules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

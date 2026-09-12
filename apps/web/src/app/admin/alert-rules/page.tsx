"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AlertRuleRow {
  _id: string;
  scope: string;
  ownerId: string;
  ownerName: string;
  ownerType: "business" | "parentOrg";
  ruleType: string;
  metric: string;
  threshold: number | null;
  recipients: string[];
  active: boolean;
  suspiciousRecipients: string[];
}

export default function AlertRulesOversightPage() {
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/alert-rules")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load alert rules");
          return;
        }
        setRules(data.rules ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasSuspicious = rules.some((r) => r.suspiciousRecipients.length > 0);

  return (
    <div>
      <h1>Alert Rules Oversight</h1>
      <p className="subtitle">Every alert rule configured by any business or parent organization, platform-wide.</p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && (
        <>
          {hasSuspicious && (
            <div className="callout" style={{ background: "var(--amber-bg)", borderColor: "#f0dfb8", color: "var(--amber)" }}>
              One or more recipient addresses below appear on alert rules for more than one account — that looks like a stray
              default silently CC&apos;d on every alert rather than a real per-business contact (spec Section 13, bug #4). Rows
              affected are flagged in amber.
            </div>
          )}

          <table className="clean">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Owner</th>
                <th>Recipients</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r._id}>
                  <td>{r.ruleType}</td>
                  <td>
                    <span className="pill pill-gray">{r.metric || "—"}</span>
                  </td>
                  <td>{r.threshold ?? "—"}</td>
                  <td>
                    <Link href={r.ownerType === "business" ? `/admin/businesses/${r.ownerId}` : `/admin/parent-orgs/${r.ownerId}`}>
                      {r.ownerName} →
                    </Link>
                  </td>
                  <td>
                    {r.recipients.map((rec) => (
                      <div key={rec} style={{ color: r.suspiciousRecipients.includes(rec) ? "var(--amber)" : undefined }}>
                        {rec}
                        {r.suspiciousRecipients.includes(rec) && (
                          <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                            shared
                          </span>
                        )}
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`pill ${r.active ? "pill-green" : "pill-gray"}`}>{r.active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="subtitle">
                    No alert rules configured yet.
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

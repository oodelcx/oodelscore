"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Metrics {
  totalAccounts: number;
  businessCount: number;
  orgCount: number;
  platformMrr: number | null;
  pendingAiCount: number | null;
}
interface AttentionRow {
  label: string;
  issue: string;
  severity: "red" | "amber";
  href: string;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [attention, setAttention] = useState<AttentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load overview");
          return;
        }
        setMetrics(data.metrics);
        setAttention(data.needsAttention ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Platform overview</h1>
      <p className="subtitle">Your command center — every number here is where you go to act on it.</p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && metrics && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <Link href="/admin/accounts" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className="metric-label">Total accounts</div>
              <div className="metric-val">{metrics.totalAccounts}</div>
              <div className="metric-note">
                {metrics.businessCount} businesses · {metrics.orgCount} parent orgs →
              </div>
            </Link>
            <div className="card">
              <div className="metric-label">Businesses under management</div>
              <div className="metric-val">{metrics.businessCount}</div>
            </div>
            {metrics.platformMrr !== null ? (
              <Link href="/admin/billing" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div className="metric-label">Platform MRR</div>
                <div className="metric-val">${metrics.platformMrr.toFixed(2)}</div>
                <div className="metric-note">View subscriptions →</div>
              </Link>
            ) : (
              <div className="card">
                <div className="metric-label">Platform MRR</div>
                <div className="metric-val">—</div>
                <div className="metric-note">No billing oversight access</div>
              </div>
            )}
            {metrics.pendingAiCount !== null ? (
              <Link
                href="/admin/ai-queue"
                className="card"
                style={{ display: "block", textDecoration: "none", color: "var(--amber)", background: "var(--amber-bg)" }}
              >
                <div className="metric-label" style={{ color: "var(--amber)" }}>
                  AI reports pending
                </div>
                <div className="metric-val" style={{ color: "var(--amber)" }}>
                  {metrics.pendingAiCount}
                </div>
                <div className="metric-note" style={{ color: "var(--amber)" }}>
                  Review queue →
                </div>
              </Link>
            ) : (
              <div className="card">
                <div className="metric-label">AI reports pending</div>
                <div className="metric-val">—</div>
              </div>
            )}
          </div>

          <div className="section-title">Needs your attention</div>
          <p className="section-sub">Click any row to go straight to it.</p>
          <table className="clean" style={{ marginBottom: 26 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Issue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attention.map((row, i) => (
                <tr key={i} style={{ cursor: "pointer" }} onClick={() => (window.location.href = row.href)}>
                  <td>{row.label}</td>
                  <td>
                    <span className={`pill pill-${row.severity}`}>{row.issue}</span>
                  </td>
                  <td style={{ textAlign: "right", color: "var(--accent)" }}>Open →</td>
                </tr>
              ))}
              {attention.length === 0 && (
                <tr>
                  <td colSpan={3} className="subtitle">
                    Nothing needs attention right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title">Jump to</div>
          <div className="grid grid-2">
            <Link href="/admin/accounts" className="btn" style={{ textAlign: "left", padding: 14 }}>
              + New account
            </Link>
            <Link href="/admin/question-templates" className="btn" style={{ textAlign: "left", padding: 14 }}>
              + New Question Template
            </Link>
            <Link href="/admin/email-templates" className="btn" style={{ textAlign: "left", padding: 14 }}>
              Edit an email template
            </Link>
            <Link href="/admin/accounts" className="btn" style={{ textAlign: "left", padding: 14 }}>
              Manage roles &amp; permissions
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

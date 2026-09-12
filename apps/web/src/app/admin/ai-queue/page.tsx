"use client";

import { useEffect, useState } from "react";

interface ReportRow {
  _id: string;
  ownerName: string;
  ownerType: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  bodyMarkdown: string;
  status: "pending" | "approved" | "rejected";
  showChartOnDashboard: boolean;
}

type TabId = "pending" | "approved" | "rejected" | "all";

export default function AiInsightsQueuePage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("pending");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    fetch(`/api/admin/ai-insights?status=${tab}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load reports");
          return;
        }
        setReports(data.reports ?? []);
        setDrafts(Object.fromEntries((data.reports ?? []).map((r: ReportRow) => [r._id, r.bodyMarkdown])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [tab]);

  async function updateReport(id: string, body: Partial<ReportRow>) {
    const res = await fetch(`/api/admin/ai-insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "Failed to update report");
      return;
    }
    load();
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this report?")) return;
    const res = await fetch(`/api/admin/ai-insights/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "Failed to delete report");
      return;
    }
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>AI Insights Review Queue</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Nothing reaches a dashboard without your approval.
          </p>
        </div>
      </div>

      <div className="subtabs">
        {(["pending", "approved", "rejected", "all"] as TabId[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && reports.length === 0 && (
        <p className="subtitle">
          No reports {tab === "all" ? "" : `with status "${tab}" `}yet. The Claude Batch API insight-generation pipeline (spec
          Section 10) hasn&apos;t populated this collection yet — this queue is wired to the real{" "}
          <code>aiInsightReports</code> collection and will show reports as soon as something writes to it.
        </p>
      )}

      {!loading &&
        reports.map((r) => (
          <div className="card" key={r._id} style={{ marginBottom: 16 }}>
            <div className="page-head" style={{ marginBottom: 10 }}>
              <div className="btn-group">
                <span className="pill pill-purple">{r.ownerName}</span>
                <span
                  className={`pill ${r.status === "approved" ? "pill-green" : r.status === "rejected" ? "pill-red" : "pill-amber"}`}
                >
                  {r.status}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center" }}>
                  {new Date(r.periodStart).toLocaleDateString()} → {new Date(r.periodEnd).toLocaleDateString()}
                </span>
              </div>
              <div className="btn-group">
                {r.status !== "approved" && (
                  <button className="btn btn-sm" style={{ color: "var(--green)" }} onClick={() => updateReport(r._id, { status: "approved" })}>
                    ✓ Approve
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => updateReport(r._id, { status: "rejected" })}>
                    ✕ Reject
                  </button>
                )}
                <span className="icon-btn btn-danger" onClick={() => deleteReport(r._id)}>
                  🗑
                </span>
              </div>
            </div>
            <textarea
              style={{ width: "100%", minHeight: 90 }}
              value={drafts[r._id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [r._id]: e.target.value }))}
            />
            <div className="page-head" style={{ marginTop: 10, marginBottom: 0 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span
                  className={`toggle ${r.showChartOnDashboard ? "on" : ""}`}
                  onClick={() => updateReport(r._id, { showChartOnDashboard: !r.showChartOnDashboard })}
                />
                Show chart on dashboard
              </label>
              <button className="btn" onClick={() => updateReport(r._id, { bodyMarkdown: drafts[r._id] })}>
                Save Edits
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

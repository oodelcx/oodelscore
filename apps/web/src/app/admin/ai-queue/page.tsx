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
}

type TabId = "pending" | "approved" | "rejected" | "all";

export default function AiInsightsQueuePage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("pending");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  async function runGenerate() {
    if (
      !confirm(
        "This calls Claude to write a fresh weekly/monthly/quarterly/yearly report for every business and organization that has feedback this period — real API calls, real cost. Already-generated reports for the current period aren't regenerated. Continue?"
      )
    ) {
      return;
    }
    setGenerating(true);
    setGenerateResult(null);
    setError(null);
    const res = await fetch("/api/admin/ai-insights/generate", { method: "POST" });
    const data = await res.json().catch(() => null);
    setGenerating(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to generate reports");
      return;
    }
    setGenerateResult(`${data.reportsCreated} report(s) created, ${data.reportsSkipped} skipped (already existed or nothing to report).`);
    load();
  }

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
        <button className="btn btn-dark" disabled={generating} onClick={runGenerate}>
          {generating ? "Generating…" : "Generate now"}
        </button>
      </div>

      {generateResult && (
        <div className="callout" style={{ marginBottom: 14 }}>
          {generateResult}
        </div>
      )}

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
          No reports {tab === "all" ? "" : `with status "${tab}" `}yet. Reports generate automatically every Monday
          (weekly), the 1st of the month (monthly), the 1st of the quarter (quarterly), and Jan 1st (yearly) — or
          click &quot;Generate now&quot; above to run it immediately.
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
            <div className="page-head" style={{ marginTop: 10, marginBottom: 0, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => updateReport(r._id, { bodyMarkdown: drafts[r._id] })}>
                Save Edits
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

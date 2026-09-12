"use client";

import { useEffect, useState } from "react";

interface ResponseRow {
  _id: string;
  submittedAt: string;
  businessName: string;
  avgScore: number | null;
  npsScore: number | null;
  respondentEmail: string | null;
  respondentName: string | null;
  hasComment: boolean;
  comment: string | null;
  wouldHaveBeenAnomalous: boolean;
}

type FilterId = "all" | "anomaly" | "comment";

export default function FeedbackResponsesPage() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/feedback-responses?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load responses");
          return;
        }
        setResponses(data.responses ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [q]);

  async function deleteResponse(id: string) {
    if (!confirm("Delete this response permanently?")) return;
    const res = await fetch(`/api/admin/feedback-responses/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "Failed to delete response");
      return;
    }
    load();
  }

  const filtered = responses.filter((r) => {
    if (filter === "anomaly") return r.wouldHaveBeenAnomalous;
    if (filter === "comment") return r.hasComment;
    return true;
  });
  const anomalyCount = responses.filter((r) => r.wouldHaveBeenAnomalous).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feedback Responses</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Every response submitted across the platform.
          </p>
        </div>
        <input type="text" placeholder="Search by respondent or business…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="filters">
        <div className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All
        </div>
        <div className={`chip ${filter === "anomaly" ? "active" : ""}`} onClick={() => setFilter("anomaly")}>
          Legacy-bug affected ({anomalyCount})
        </div>
        <div className={`chip ${filter === "comment" ? "active" : ""}`} onClick={() => setFilter("comment")}>
          Has comment
        </div>
      </div>

      {anomalyCount > 0 && (
        <div className="callout" style={{ background: "var(--red-bg)", borderColor: "#f0c7c7", color: "var(--red)" }}>
          {anomalyCount} response(s) mix an NPS (0-10) answer with star ratings on the same submission. The Avg Score column
          shown here is star-only and correct — under the old bug (spec Section 13 #1), these same rows would have averaged the
          NPS answer in too and shown a score above 5.0 on a 1-5 scale. Click &quot;Legacy-bug affected&quot; to isolate them.
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Business</th>
              <th>Avg Score</th>
              <th>NPS</th>
              <th>Respondent</th>
              <th>Comment</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r._id}>
                <td>{new Date(r.submittedAt).toLocaleString()}</td>
                <td>{r.businessName}</td>
                <td style={r.wouldHaveBeenAnomalous ? { color: "var(--red)", fontWeight: 600 } : undefined}>
                  {r.avgScore !== null ? r.avgScore.toFixed(1) : "—"}
                  {r.wouldHaveBeenAnomalous && (
                    <span className="pill pill-red" style={{ marginLeft: 6 }}>
                      mixed NPS
                    </span>
                  )}
                </td>
                <td>{r.npsScore !== null ? r.npsScore.toFixed(1) : "—"}</td>
                <td>{r.respondentEmail ?? r.respondentName ?? "Anonymous"}</td>
                <td>{r.comment ?? "-"}</td>
                <td style={{ textAlign: "right" }}>
                  <span className="icon-btn btn-danger" onClick={() => deleteResponse(r._id)}>
                    🗑
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="subtitle">
                  No responses match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}


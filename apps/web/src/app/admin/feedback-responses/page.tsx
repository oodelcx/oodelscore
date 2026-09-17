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

const LIMIT = 50;

export default function FeedbackResponsesPage() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/admin/feedback-responses?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load responses");
          return;
        }
        setResponses(data.responses ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  // Search/date changes should always jump back to page 1 — otherwise a
  // narrower query could land on a page number past its own last page.
  // Debounced so typing in the search box doesn't fire a request per
  // keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (page === 1) load();
      else setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to]);

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
        <div className="btn-group">
          <input type="text" placeholder="Search by respondent or business…" value={q} onChange={(e) => setQ(e.target.value)} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        </div>
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
      <p className="subtitle" style={{ marginTop: -6, marginBottom: 14 }}>
        &quot;Legacy-bug affected&quot; and &quot;Has comment&quot; filter the page currently on screen — search and date range
        query the full result set across every page.
      </p>

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

      {!loading && total > 0 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="pagination-status">
            Page {page} of {totalPages} · {total} response{total === 1 ? "" : "s"}
          </span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}


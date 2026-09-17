"use client";

import { useEffect, useState } from "react";

interface AnswerRow {
  type: string;
  value: unknown;
}
interface ResponseRow {
  _id: string;
  answers: AnswerRow[];
  submittedAt: string;
  respondentEmail: string | null;
  demographics: { ageGroup: string; gender: string };
  flagged: boolean;
  feedbackPointId: string;
  feedbackPointName: string;
}
interface FeedbackPointOption {
  _id: string;
  name: string;
}

type FilterId = "all" | "negative" | "comment" | string;
type SortId = "newest" | "lowest";

const LIMIT = 25;

function starValue(r: ResponseRow): number | null {
  const star = r.answers.find((a) => a.type === "star_1_5" && typeof a.value === "number");
  return star ? (star.value as number) : null;
}
function comment(r: ResponseRow): string | null {
  const c = r.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && (a.value as string).trim());
  return c ? (c.value as string) : null;
}
function scoreColor(star: number | null): string {
  if (star === null) return "var(--text)";
  if (star >= 4) return "var(--green)";
  if (star === 3) return "var(--amber)";
  return "var(--red)";
}

export default function RawFeedbackPage() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [feedbackPoints, setFeedbackPoints] = useState<FeedbackPointOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loggingFor, setLoggingFor] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), filter, sort });
    fetch(`/api/business/responses?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setResponses(data.responses ?? []);
        setFeedbackPoints(data.feedbackPoints ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, sort]);

  function changeFilter(f: FilterId) {
    setFilter(f);
    setPage(1);
  }

  function changeSort(s: SortId) {
    setSort(s);
    setPage(1);
  }

  async function toggleFlag(r: ResponseRow) {
    await fetch(`/api/business/responses/${r._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: !r.flagged }),
    });
    load();
  }

  function startLogAction(r: ResponseRow) {
    setLoggingFor(r._id);
    setActionTitle(`Follow up: ${r.feedbackPointName}${comment(r) ? ` — "${comment(r)!.slice(0, 60)}"` : ""}`);
  }

  async function submitLogAction(r: ResponseRow) {
    if (!actionTitle.trim()) return;
    setActionSubmitting(true);
    await fetch("/api/business/action-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: actionTitle.trim(),
        description: comment(r) ?? "",
        priority: (starValue(r) ?? 5) <= 2 ? "high" : "medium",
        sourceResponseIds: [r._id],
      }),
    });
    setActionSubmitting(false);
    setLoggingFor(null);
    setLoggedIds((prev) => new Set(prev).add(r._id));
  }

  return (
    <div>
      <h1>Raw feedback</h1>
      <p className="subtitle">Every individual response — who said what, and when.</p>
      <div className="filters">
        {(["all", "negative", "comment"] as FilterId[]).map((f) => (
          <div key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => changeFilter(f)}>
            {f === "all" ? "All" : f === "negative" ? "Negative only" : "Has comment"}
          </div>
        ))}
        {feedbackPoints.map((fp) => (
          <div key={fp._id} className={`chip ${filter === fp._id ? "active" : ""}`} onClick={() => changeFilter(fp._id)}>
            {fp.name}
          </div>
        ))}
        <select style={{ marginLeft: "auto" }} value={sort} onChange={(e) => changeSort(e.target.value as SortId)}>
          <option value="newest">Newest first</option>
          <option value="lowest">Lowest score first</option>
        </select>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading &&
        responses.map((r) => {
          const star = starValue(r);
          const text = comment(r);
          return (
            <div className="fb-card" key={r._id}>
              <div className="fb-top">
                <div className="fb-meta">
                  <span className="pill pill-blue">{r.feedbackPointName}</span>
                  {new Date(r.submittedAt).toLocaleString()}
                  {r.respondentEmail ? ` · ${r.respondentEmail}` : ""}
                </div>
                <div className="fb-score" style={{ color: scoreColor(star) }}>
                  {star !== null ? `${star.toFixed(1)}/5` : "—"}
                </div>
              </div>
              {text && <div className="fb-comment">&quot;{text}&quot;</div>}
              <div className="fb-tags">
                {r.flagged && <span className="pill pill-red">Flagged</span>}
                {r.demographics.ageGroup && <span className="pill pill-gray">{r.demographics.ageGroup}</span>}
                {!text && <span className="pill pill-gray">No comment left</span>}
              </div>
              <div className="fb-actions">
                <span onClick={() => toggleFlag(r)}>{r.flagged ? "Unflag" : "Flag"}</span>
                {loggedIds.has(r._id) ? (
                  <span style={{ color: "var(--accent)", cursor: "default" }}>✓ Action logged</span>
                ) : (
                  <span onClick={() => startLogAction(r)}>Log action taken</span>
                )}
                <span onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                  {expanded === r._id ? "Hide breakdown" : "View full breakdown"}
                </span>
              </div>
              {loggingFor === r._id && (
                <div style={{ marginTop: 10, padding: 12, background: "var(--bg)", borderRadius: 8 }}>
                  <div className="field">
                    <label>Action item title</label>
                    <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} autoFocus />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="btn btn-dark btn-sm" disabled={actionSubmitting} onClick={() => submitLogAction(r)}>
                      {actionSubmitting ? "Logging…" : "Add to Action Board"}
                    </button>
                    <button className="btn btn-sm" onClick={() => setLoggingFor(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {expanded === r._id && (
                <table className="clean" style={{ marginTop: 10 }}>
                  <tbody>
                    {r.answers.map((a, i) => (
                      <tr key={i}>
                        <td>{a.type}</td>
                        <td style={{ textAlign: "right" }}>{String(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      {!loading && responses.length === 0 && <p className="subtitle">No feedback matches this filter.</p>}

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

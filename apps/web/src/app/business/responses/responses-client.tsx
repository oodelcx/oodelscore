"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

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
interface ResponseStats {
  total: number;
  avgStar: number | null;
  negative: number;
  flagged: number;
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

export default function RawFeedbackClient({ tooltips }: { tooltips: Record<string, string> }) {
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
  const [stats, setStats] = useState<ResponseStats | null>(null);

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
        setStats(data.stats ?? null);
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

      {stats && (
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="metric-label">Responses (filtered)</div>
            <div className="metric-val">{stats.total}</div>
          </div>
          <div className="card">
            <div className="metric-label">Average rating</div>
            <div className="metric-val">{stats.avgStar !== null ? `${stats.avgStar.toFixed(1)}★` : "—"}</div>
          </div>
          <div className="card" style={{ background: "var(--red-bg)" }}>
            <div className="metric-label" style={{ color: "var(--red)" }}>
              Negative (1-2★)
            </div>
            <div className="metric-val" style={{ color: "var(--red)" }}>
              {stats.negative}
            </div>
          </div>
          <div className="card">
            <div className="metric-label">Flagged</div>
            <div className="metric-val">{stats.flagged}</div>
          </div>
        </div>
      )}

      <div className="filters" data-tour="rf-filters">
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
      <div className="content-narrow">
      {!loading && (
        <div className="ab-list">
          {responses.map((r, index) => {
            const star = starValue(r);
            const text = comment(r);
            const isFirst = index === 0;
            return (
              <div className="card ab-card" data-tour={isFirst ? "rf-first-card" : undefined} key={r._id}>
                <div className="ab-card-head">
                  <div className="ab-title-block">
                    <div className="ab-badges">
                      {r.flagged && <span className="pill pill-red">Flagged</span>}
                      {r.demographics.ageGroup && <span className="pill pill-gray">{r.demographics.ageGroup}</span>}
                      {!text && <span className="pill pill-gray">No comment left</span>}
                    </div>
                    <div className="ab-title" style={{ fontSize: 20, color: scoreColor(star) }}>
                      {star !== null ? `${"★".repeat(Math.round(star))}${"☆".repeat(5 - Math.round(star))} ${star.toFixed(1)}/5` : "No rating"}
                    </div>
                    <div className="ab-meta-row">
                      <span className="pill pill-blue">{r.feedbackPointName}</span>
                      <span>{new Date(r.submittedAt).toLocaleString()}</span>
                      {r.respondentEmail && <span>{r.respondentEmail}</span>}
                    </div>
                  </div>
                </div>

                {text && <div className="fb-comment">&quot;{text}&quot;</div>}

                <div className="action-links">
                  <button type="button" className="btn btn-sm action-btn" onClick={() => toggleFlag(r)}>
                    {r.flagged ? "Unflag" : "Flag"}
                  </button>
                  <InfoTip text={tooltips["flag"]} />
                  {loggedIds.has(r._id) ? (
                    <span style={{ color: "var(--accent)", fontSize: "11.5px" }}>✓ Action logged</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm action-btn"
                      data-tour={isFirst ? "rf-first-log-action" : undefined}
                      onClick={() => startLogAction(r)}
                    >
                      Log action taken
                    </button>
                  )}
                  <InfoTip text={tooltips["log-action"]} />
                  <button
                    type="button"
                    className={`btn btn-sm action-btn${expanded === r._id ? " active" : ""}`}
                    onClick={() => setExpanded(expanded === r._id ? null : r._id)}
                  >
                    {expanded === r._id ? "Hide breakdown" : "View full breakdown"}
                  </button>
                </div>

                {loggingFor === r._id && (
                  <div className="ab-panel">
                    <div className="field" style={{ margin: 0 }}>
                      <label>Case title</label>
                      <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} autoFocus />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-dark btn-sm" disabled={actionSubmitting} onClick={() => submitLogAction(r)}>
                        {actionSubmitting ? "Logging…" : "Add to Case Management"}
                      </button>
                      <button className="btn btn-sm" onClick={() => setLoggingFor(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {expanded === r._id && (
                  <div className="ab-panel">
                    <table className="clean">
                      <tbody>
                        {r.answers.map((a, i) => (
                          <tr key={i}>
                            <td>{a.type}</td>
                            <td style={{ textAlign: "right" }}>{String(a.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {responses.length === 0 && <div className="ab-empty">No feedback matches this filter.</div>}
        </div>
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
    </div>
  );
}

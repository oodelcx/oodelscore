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
type ProductId = "customer_experience" | "colleague_experience";

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
  // Lets other pages (Feedback Points) link straight to one point's responses: /business/responses?filter=<id>.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("filter");
    if (initial) setFilter(initial);
  }, []);
  const [sort, setSort] = useState<SortId>("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loggingFor, setLoggingFor] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<ResponseStats | null>(null);
  const [belowFloor, setBelowFloor] = useState(false);
  const [product, setProduct] = useState<ProductId>("customer_experience");
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), filter, sort, product });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/business/responses?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const list: ResponseRow[] = data.responses ?? [];
        setResponses(list);
        setFeedbackPoints(data.feedbackPoints ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
        setStats(data.stats ?? null);
        setBelowFloor(data.belowAnonymityFloor === true);
        setSelectedId((current) => (current && list.some((r) => r._id === current) ? current : (list[0]?._id ?? null)));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, page, filter, sort, product, from, to]);

  function changeDateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setPage(1);
  }

  // Account-scoped enabled products must be known BEFORE the first data
  // fetch — otherwise a Colleague-Experience-only business always starts by
  // asking for (empty) Customer Experience data, showing a stale/wrong tab
  // and an empty page until a second render corrects it.
  useEffect(() => {
    fetch("/api/business/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.business?.enabledProducts ?? ["customer_experience"];
        const hasCx = products.includes("customer_experience");
        const hasCe = products.includes("colleague_experience");
        setCxEnabled(hasCx);
        setCeEnabled(hasCe);
        setProduct(hasCx ? "customer_experience" : "colleague_experience");
        setReady(true);
      });
  }, []);

  function changeProduct(p: ProductId) {
    setProduct(p);
    setPage(1);
    setFilter("all");
  }

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
        product,
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

      {cxEnabled && ceEnabled && (
        <div className="filters" style={{ marginBottom: 8 }}>
          <div className={`chip ${product === "customer_experience" ? "active" : ""}`} onClick={() => changeProduct("customer_experience")}>
            Customer Experience
          </div>
          <div className={`chip ${product === "colleague_experience" ? "active" : ""}`} onClick={() => changeProduct("colleague_experience")}>
            Colleague Experience
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
        <input type="date" style={{ marginLeft: "auto" }} value={from} onChange={(e) => changeDateRange(e.target.value, to)} />
        <input type="date" value={to} onChange={(e) => changeDateRange(from, e.target.value)} />
        {(from || to) && (
          <button type="button" className="btn btn-sm" onClick={() => changeDateRange("", "")}>
            Clear dates
          </button>
        )}
        <select value={sort} onChange={(e) => changeSort(e.target.value as SortId)}>
          <option value="newest">Newest first</option>
          <option value="lowest">Lowest score first</option>
        </select>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && responses.length === 0 && (
        <div className="ab-empty">
          {belowFloor
            ? "To protect anonymity, individual colleague responses are not shown until at least 5 have been received."
            : "No feedback matches this filter."}
        </div>
      )}

      {!loading && responses.length > 0 && (
        <div className="rf-layout">
          <div className="rf-list">
            {responses.map((r, index) => {
              const star = starValue(r);
              const text = comment(r);
              return (
                <div
                  key={r._id}
                  className={`rf-row${selectedId === r._id ? " active" : ""}`}
                  data-tour={index === 0 ? "rf-first-card" : undefined}
                  onClick={() => setSelectedId(r._id)}
                >
                  <div className="rf-row-score" style={{ color: scoreColor(star) }}>
                    {star !== null ? `${star.toFixed(1)}★` : "No rating"}
                    {r.flagged && <span style={{ marginLeft: 6 }}>🚩</span>}
                  </div>
                  <div className="rf-row-meta">
                    <span>{r.feedbackPointName}</span>
                    <span>·</span>
                    <span>{new Date(r.submittedAt).toLocaleDateString()}</span>
                  </div>
                  {text && <div className="rf-row-snippet">&quot;{text}&quot;</div>}
                </div>
              );
            })}
          </div>

          <div className="rf-detail">
            {(() => {
              const r = responses.find((row) => row._id === selectedId);
              if (!r) return <div className="rf-detail-empty">Select a response on the left to see the full detail.</div>;
              const star = starValue(r);
              const text = comment(r);
              const isFirst = responses[0]?._id === r._id;
              return (
                <div className="card ab-card">
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

                  <div className="ab-panel" style={{ marginTop: 14 }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Full breakdown</h3>
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
                </div>
              );
            })()}
          </div>
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
  );
}

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
  businessName: string;
  flagged: boolean;
}

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

export default function GroupRawFeedbackPage() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [negativeOnly, setNegativeOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      filter: negativeOnly ? "negative" : "all",
    });
    fetch(`/api/group/raw-feedback?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setResponses(data.responses ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, negativeOnly]);

  function setFilter(negative: boolean) {
    setNegativeOnly(negative);
    setPage(1);
  }

  return (
    <div>
      <h1>Raw feedback</h1>
      <p className="subtitle">Every response across your network — who said what, and where.</p>
      <div className="filters">
        <div className={`chip ${!negativeOnly ? "active" : ""}`} onClick={() => setFilter(false)}>
          All
        </div>
        <div className={`chip ${negativeOnly ? "active" : ""}`} onClick={() => setFilter(true)}>
          Negative only
        </div>
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
                  <span className="pill pill-blue">{r.businessName}</span>
                  {new Date(r.submittedAt).toLocaleString()}
                </div>
                <div className="fb-score" style={{ color: scoreColor(star) }}>
                  {star !== null ? `${star.toFixed(1)}/5` : "—"}
                </div>
              </div>
              {text && <div className="fb-comment">&quot;{text}&quot;</div>}
              {r.flagged && (
                <div className="fb-tags">
                  <span className="pill pill-red">Flagged</span>
                </div>
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

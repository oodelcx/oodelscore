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
  businessName: string;
  flagged: boolean;
}
interface ResponseStats {
  total: number;
  avgStar: number | null;
  negative: number;
  flagged: number;
}

const LIMIT = 25;
type ProductId = "customer_experience" | "colleague_experience";

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

export default function GroupRawFeedbackClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [negativeOnly, setNegativeOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ResponseStats | null>(null);
  const [product, setProduct] = useState<ProductId>("customer_experience");
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  // Account-scoped enabled products must be known BEFORE the first data
  // fetch — otherwise a Colleague-Experience-only account always starts by
  // asking for (empty) Customer Experience data, showing a stale/wrong tab
  // and an empty page until a second render corrects it.
  useEffect(() => {
    fetch("/api/group/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.org?.enabledProducts ?? ["customer_experience"];
        const hasCx = products.includes("customer_experience");
        const hasCe = products.includes("colleague_experience");
        setCxEnabled(hasCx);
        setCeEnabled(hasCe);
        setProduct(hasCx ? "customer_experience" : "colleague_experience");
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      filter: negativeOnly ? "negative" : "all",
      product,
    });
    fetch(`/api/group/raw-feedback?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setResponses(data.responses ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
        setStats(data.stats ?? null);
      })
      .finally(() => setLoading(false));
  }, [ready, page, negativeOnly, product]);

  function setFilter(negative: boolean) {
    setNegativeOnly(negative);
    setPage(1);
  }

  function changeProduct(p: ProductId) {
    setProduct(p);
    setPage(1);
  }

  return (
    <div>
      <h1>Raw feedback</h1>
      <p className="subtitle">Every response across your network — who said what, and where.</p>

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

      <div className="filters">
        <div className={`chip ${!negativeOnly ? "active" : ""}`} onClick={() => setFilter(false)}>
          All
        </div>
        <div className={`chip ${negativeOnly ? "active" : ""}`} onClick={() => setFilter(true)}>
          Negative only
        </div>
        <InfoTip text={tooltips["negative-only"]} />
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      <div className="content-narrow">
      {!loading && (
        <div className="ab-list">
          {responses.map((r) => {
            const star = starValue(r);
            const text = comment(r);
            return (
              <div className="card ab-card" key={r._id}>
                <div className="ab-card-head">
                  <div className="ab-title-block">
                    <div className="ab-badges">
                      {r.flagged && <span className="pill pill-red">Flagged</span>}
                      {r.flagged && <InfoTip text={tooltips["flagged"]} />}
                      {!text && <span className="pill pill-gray">No comment left</span>}
                    </div>
                    <div className="ab-title" style={{ fontSize: 20, color: scoreColor(star) }}>
                      {star !== null ? `${"★".repeat(Math.round(star))}${"☆".repeat(5 - Math.round(star))} ${star.toFixed(1)}/5` : "No rating"}
                    </div>
                    <div className="ab-meta-row">
                      <span className="pill pill-blue">{r.businessName}</span>
                      <span>{new Date(r.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {text && <div className="fb-comment">&quot;{text}&quot;</div>}
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

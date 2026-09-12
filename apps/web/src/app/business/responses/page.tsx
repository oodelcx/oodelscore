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
  feedbackPointName: string;
}

type FilterId = "all" | "negative" | "comment";

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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    fetch("/api/business/responses")
      .then((res) => res.json())
      .then((data) => setResponses(data.responses ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleFlag(r: ResponseRow) {
    await fetch(`/api/business/responses/${r._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: !r.flagged }),
    });
    load();
  }

  const filtered = responses.filter((r) => {
    if (filter === "negative") return (starValue(r) ?? 5) <= 2;
    if (filter === "comment") return comment(r) !== null;
    return true;
  });

  return (
    <div>
      <h1>Raw feedback</h1>
      <p className="subtitle">Every individual response — who said what, and when.</p>
      <div className="filters">
        {(["all", "negative", "comment"] as FilterId[]).map((f) => (
          <div key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "negative" ? "Negative only" : "Has comment"}
          </div>
        ))}
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading &&
        filtered.map((r) => {
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
                <span onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                  {expanded === r._id ? "Hide breakdown" : "View full breakdown"}
                </span>
              </div>
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
      {!loading && filtered.length === 0 && <p className="subtitle">No feedback matches this filter.</p>}
    </div>
  );
}

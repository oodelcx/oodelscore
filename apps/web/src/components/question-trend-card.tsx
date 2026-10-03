"use client";

import { useEffect, useState } from "react";

interface QuestionRow {
  _id: string;
  text: string;
  type: string;
  categoryId: string | null;
}
interface TrendPoint {
  bucket: string;
  average: number | null;
  count: number;
}

const PERIODS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const SCALE_BY_TYPE: Record<string, { min: number; max: number }> = {
  star_1_5: { min: 0, max: 5 },
  nps_0_10: { min: 0, max: 10 },
  emoji_scale: { min: 1, max: 5 },
  slider: { min: 0, max: 10 },
};

function svgPoints(trend: TrendPoint[], min: number, max: number): string {
  const known = trend.map((t) => t.average).filter((v): v is number => v !== null);
  if (known.length === 0) return "";
  const width = 360;
  const height = 110;
  const step = width / Math.max(trend.length - 1, 1);
  let lastKnown = known[0];
  return trend
    .map((point, i) => {
      if (point.average !== null) lastKnown = point.average;
      const y = height - ((lastKnown - min) / (max - min || 1)) * height;
      return `${(i * step + 20).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatBucketLabel(bucket: string, granularity: "hour" | "day"): string {
  if (granularity === "hour") {
    const hour = Number(bucket.slice(-2));
    return `${hour}:00`;
  }
  const d = new Date(`${bucket}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Replaces the old "tracker" checkbox: instead of one question flagged as
 * special, every numeric question gets its own trend line here, with a
 * period selector — the chart the checkbox never actually produced.
 */
export function QuestionTrendCard({ questionsApi, trendApi }: { questionsApi: string; trendApi: string }) {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [questionId, setQuestionId] = useState("");
  const [period, setPeriod] = useState("3m");
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [granularity, setGranularity] = useState<"hour" | "day">("day");
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    fetch(questionsApi)
      .then((r) => r.json())
      .then((d) => {
        const rows: QuestionRow[] = d.questions ?? [];
        setQuestions(rows);
        if (rows.length > 0) setQuestionId(rows[0]._id);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionsApi]);

  useEffect(() => {
    if (!questionId) return;
    setTrendLoading(true);
    fetch(`${trendApi}?questionId=${encodeURIComponent(questionId)}&period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setTrend(d.trend ?? []);
        setGranularity(d.granularity === "hour" ? "hour" : "day");
      })
      .finally(() => setTrendLoading(false));
  }, [questionId, period, trendApi]);

  if (loading) return null;
  if (questions.length === 0) return null;

  const activeQuestion = questions.find((q) => q._id === questionId);
  const scale = SCALE_BY_TYPE[activeQuestion?.type ?? "star_1_5"] ?? { min: 0, max: 5 };
  const points = svgPoints(trend, scale.min, scale.max);
  const answeredCount = trend.reduce((sum, t) => sum + t.count, 0);
  const firstLabel = trend[0] ? formatBucketLabel(trend[0].bucket, granularity) : "";
  const lastLabel = trend[trend.length - 1] ? formatBucketLabel(trend[trend.length - 1].bucket, granularity) : "";

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Question trend</h3>
          <p className="card-sub" style={{ margin: "2px 0 0" }}>
            How one question&apos;s average answer has moved over time.
          </p>
        </div>
        <select value={questionId} onChange={(e) => setQuestionId(e.target.value)} style={{ maxWidth: 320 }}>
          {questions.map((q) => (
            <option key={q._id} value={q._id}>
              {q.text}
            </option>
          ))}
        </select>
      </div>

      <div className="pill-row" style={{ display: "flex", gap: 6, margin: "12px 0" }}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`btn btn-sm action-btn${period === p.value ? " active" : ""}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {trendLoading ? (
        <p className="subtitle">Loading…</p>
      ) : answeredCount === 0 ? (
        <p className="subtitle">No answers to this question in this period.</p>
      ) : (
        <>
          <svg viewBox="0 0 400 140" width="100%" height="140">
            <line x1="30" y1="10" x2="30" y2="120" stroke="#E6E5E1" />
            <line x1="30" y1="120" x2="390" y2="120" stroke="#E6E5E1" />
            <text x="8" y="14" fontSize="9" fill="#9A9A97">
              {scale.max}
            </text>
            <text x="8" y="67" fontSize="9" fill="#9A9A97">
              {Math.round(((scale.max + scale.min) / 2) * 10) / 10}
            </text>
            <text x="8" y="123" fontSize="9" fill="#9A9A97">
              {scale.min}
            </text>
            {points && <polyline fill="none" stroke="#0F6E56" strokeWidth="2" points={points} />}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
            <span>{firstLabel}</span>
            <span>{lastLabel}</span>
          </div>
          <p className="card-sub" style={{ marginTop: 6 }}>
            {answeredCount} answer{answeredCount === 1 ? "" : "s"} in this period.
          </p>
        </>
      )}
    </div>
  );
}

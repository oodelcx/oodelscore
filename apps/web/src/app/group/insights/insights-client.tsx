"use client";

import { useEffect, useState } from "react";
import { CxGoalsCard } from "@/components/cx-goals-card";
import { InfoTip } from "@/components/info-tip";

interface ReportRow {
  _id: string;
  periodStart: string;
  periodEnd: string;
  bodyMarkdown: string;
  reviewedAt: string | null;
}

const PERIODS = ["weekly", "monthly", "quarterly", "yearly"] as const;
const PERIOD_COLORS: Record<(typeof PERIODS)[number], string> = {
  weekly: "#185FA5",
  monthly: "#0F6E56",
  quarterly: "#7F77DD",
  yearly: "#EF9F27",
};

/** Splits off the first sentence as a scannable headline, the rest as body — the
 * narrative is always 2-4 plain sentences (see insightsGeneration.ts's prompt), so
 * this never has to parse real markdown, just find the first ". ". */
function splitHeadline(text: string): { headline: string; rest: string } {
  const match = text.match(/^([\s\S]+?[.!?])(\s+([\s\S]*))?$/);
  if (!match) return { headline: text, rest: "" };
  return { headline: match[1], rest: match[3] ?? "" };
}

function daysAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function GroupInsightsClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("weekly");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setReports([]);
    fetch(`/api/group/insights?period=${period}`)
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <h1>
        Insights
        <InfoTip text={tooltips["ai-report"]} />
      </h1>
      <p className="subtitle">Plain-English performance reports for your organization.</p>

      <div style={{ marginBottom: 20 }}>
        <CxGoalsCard apiPath="/api/group/goals" categoriesApiPath="/api/group/category-owners" />
      </div>

      <div className="filters">
        {PERIODS.map((p) => (
          <div key={p} className={`chip ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </div>
        ))}
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && reports.length === 0 && (
        <div className="card empty">
          <div className="icon">📊</div>
          <div style={{ fontWeight: 500, color: "var(--text)" }}>No {period} reports published yet</div>
        </div>
      )}
      {!loading && reports.length > 0 && (
        <div style={{ position: "relative", paddingLeft: 22 }}>
          <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
          {reports.map((r) => {
            const { headline, rest } = splitHeadline(r.bodyMarkdown);
            const color = PERIOD_COLORS[period];
            return (
              <div key={r._id} style={{ position: "relative", marginBottom: 16 }}>
                <div
                  style={{
                    position: "absolute",
                    left: -22,
                    top: 20,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                    border: "2px solid #fff",
                    boxShadow: `0 0 0 2px ${color}`,
                  }}
                />
                <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ marginBottom: 2 }}>
                        {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                      </h3>
                      <p className="card-sub" style={{ margin: 0 }}>
                        Published {r.reviewedAt ? daysAgo(r.reviewedAt) : ""}
                      </p>
                    </div>
                    <span className="pill pill-green">Published</span>
                  </div>
                  <p style={{ fontSize: 14.5, fontWeight: 600, margin: "12px 0 4px", lineHeight: 1.5 }}>{headline}</p>
                  {rest && <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)", margin: 0 }}>{rest}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

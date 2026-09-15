"use client";

import { useEffect, useState } from "react";
import { CxGoalsCard } from "@/components/cx-goals-card";

interface ReportRow {
  _id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  bodyMarkdown: string;
  reviewedAt: string | null;
}

const PERIODS = ["weekly", "monthly", "quarterly", "yearly"] as const;

export default function InsightsPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("weekly");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/business/insights?period=${period}`)
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <h1>Insights</h1>
      <p className="subtitle">Plain-English performance reports, reviewed by our team before they&apos;re published.</p>

      <div style={{ marginBottom: 20 }}>
        <CxGoalsCard apiPath="/api/business/goals" categoriesApiPath="/api/business/category-owners" />
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
          <div style={{ fontSize: 13, marginTop: 4 }}>Check back after your next reporting period.</div>
        </div>
      )}
      {reports.map((r) => (
        <div className="card" key={r._id} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3>
                {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
              </h3>
              <p className="card-sub">Published {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : ""}</p>
            </div>
            <span className="pill pill-green">Published</span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{r.bodyMarkdown}</p>
        </div>
      ))}
    </div>
  );
}

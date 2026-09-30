"use client";

import { useEffect, useState } from "react";
import { ReportHero, ReportKpiGrid, ReportBarList, ReportThemeList, starTone, npsTone } from "@/components/report-widgets";

interface ThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}
interface CategoryRow {
  categoryId: string;
  name: string;
  average: number;
}
interface ReportData {
  product: "customer_experience" | "colleague_experience";
  businessName: string;
  period: { from: string; to: string };
  metrics: { responseCount: number; starAverage: number | null; npsScore: number | null };
  categoryBreakdown: CategoryRow[];
  themes: ThemeRow[];
  activity: { casesResolved: number; initiativesCompleted: number; customersRespondedTo: number };
  colleagueExperience: {
    metrics: { responseCount: number; starAverage: number | null; npsScore: number | null };
    categoryBreakdown: CategoryRow[];
    casesResolved: number;
  } | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * A print-optimized summary report of one business's window — built for
 * "download this and hand it to my district manager," not another live
 * dashboard. Reuses the same aggregation the dashboard runs on, so the
 * numbers always match; "Print / Save as PDF" uses the browser's own PDF
 * printer rather than a new PDF-rendering dependency.
 */
export default function ReportsClient() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/business/reports${buildQuery(from, to)}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="report-print-area">
      <div className="page-head" data-no-print>
        <div>
          <h1>Reports</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            A printable summary of this window — download as PDF or export the underlying numbers as CSV.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn" href={`/api/business/reports/export${buildQuery(from, to)}`}>
            ⬇ Export CSV
          </a>
          <button className="btn btn-dark" onClick={() => window.print()}>
            🖨 Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="filters" data-no-print>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading && !data && <p className="subtitle">Loading…</p>}
      {data && (
        <>
          <ReportHero
            title={data.businessName}
            badge={
              data.product === "colleague_experience" ? (
                <span className="pill pill-blue" style={{ marginLeft: 4 }}>
                  Colleague Experience
                </span>
              ) : undefined
            }
            subtitle={`${new Date(data.period.from).toLocaleDateString()} – ${new Date(data.period.to).toLocaleDateString()}`}
          />

          <ReportKpiGrid
            items={[
              { label: "Responses", value: String(data.metrics.responseCount), icon: "💬" },
              {
                label: "Star average",
                value: data.metrics.starAverage !== null ? `${data.metrics.starAverage}/5` : "—",
                tone: starTone(data.metrics.starAverage),
                icon: "★",
              },
              {
                label: data.product === "colleague_experience" ? "eNPS" : "NPS",
                value: data.metrics.npsScore !== null ? String(data.metrics.npsScore) : "—",
                tone: npsTone(data.metrics.npsScore),
                icon: "🎯",
              },
            ]}
          />

          <div className="rpt-section">
            <div className="section-title">Activity this period</div>
            <ReportKpiGrid
              items={[
                { label: "Cases resolved", value: String(data.activity.casesResolved), icon: "✓" },
                { label: "Customers personally responded to", value: String(data.activity.customersRespondedTo), icon: "✉" },
                { label: "Initiatives completed", value: String(data.activity.initiativesCompleted), icon: "🚀" },
              ]}
            />
          </div>

          <ReportBarList
            title="By category"
            emptyText="No category data for this period."
            rows={data.categoryBreakdown.map((c) => ({
              key: c.categoryId,
              label: c.name,
              value: c.average,
              max: 5,
              displayValue: `${c.average}/5`,
              tone: starTone(c.average),
            }))}
          />

          <ReportThemeList
            emptyText="No themes detected for this period."
            rows={data.themes.map((t) => ({
              theme: t.theme,
              frequency: t.frequency,
              positive: t.sentimentBreakdown.positive,
              neutral: t.sentimentBreakdown.neutral,
              negative: t.sentimentBreakdown.negative,
            }))}
          />

          {data.colleagueExperience && (
            <>
              <div className="section-title" style={{ marginTop: 4 }}>
                Colleague Experience
              </div>
              <ReportKpiGrid
                items={[
                  { label: "Responses", value: String(data.colleagueExperience.metrics.responseCount), icon: "💬" },
                  {
                    label: "Star average",
                    value: data.colleagueExperience.metrics.starAverage !== null ? `${data.colleagueExperience.metrics.starAverage}/5` : "—",
                    tone: starTone(data.colleagueExperience.metrics.starAverage),
                    icon: "★",
                  },
                  {
                    label: "eNPS",
                    value: data.colleagueExperience.metrics.npsScore !== null ? String(data.colleagueExperience.metrics.npsScore) : "—",
                    tone: npsTone(data.colleagueExperience.metrics.npsScore),
                    icon: "🎯",
                  },
                  { label: "Cases resolved", value: String(data.colleagueExperience.casesResolved), icon: "✓" },
                ]}
              />
              <ReportBarList
                title="By category"
                emptyText="No category data for this period."
                rows={data.colleagueExperience.categoryBreakdown.map((c) => ({
                  key: c.categoryId,
                  label: c.name,
                  value: c.average,
                  max: 5,
                  displayValue: `${c.average}/5`,
                  tone: starTone(c.average),
                }))}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

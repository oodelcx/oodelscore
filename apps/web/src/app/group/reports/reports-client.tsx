"use client";

import { useEffect, useState } from "react";
import { ReportHero, ReportKpiGrid, ReportBarList, ReportThemeList, starTone, npsTone } from "@/components/report-widgets";

interface ThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}
interface BranchRow {
  businessId: string;
  name: string;
  region: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  confidence: "strong" | "directional" | "insufficient";
}
interface RegionRow {
  region: string;
  businessCount: number;
  starAverage: number | null;
  npsScore: number | null;
}
interface ReportData {
  product: "customer_experience" | "colleague_experience";
  orgName: string;
  period: { from: string; to: string };
  branches: BranchRow[];
  regions: RegionRow[];
  themes: ThemeRow[];
  activity: { casesResolved: number; initiativesCompleted: number; customersRespondedTo: number };
  colleagueExperience: { branches: BranchRow[]; casesResolved: number } | null;
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
 * The org-wide twin of the Business report: a print-optimized rollup by
 * region and branch, meant for handing to the exec who wants the numbers
 * without logging in — same reasoning as the Business Reports page.
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
    fetch(`/api/group/reports${buildQuery(from, to)}`)
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
            A printable network summary for this window — download as PDF or export the underlying numbers as CSV.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn" href={`/api/group/reports/export${buildQuery(from, to)}`}>
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
            title={data.orgName}
            badge={
              data.product === "colleague_experience" ? (
                <span className="pill pill-blue" style={{ marginLeft: 4 }}>
                  Colleague Experience
                </span>
              ) : undefined
            }
            subtitle={`${new Date(data.period.from).toLocaleDateString()} – ${new Date(data.period.to).toLocaleDateString()} · ${data.branches.length} branches`}
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
            title="By region"
            emptyText="No region data for this period."
            rows={data.regions.map((r) => ({
              key: r.region,
              label: r.region,
              sublabel: `${r.businessCount} branch${r.businessCount === 1 ? "" : "es"}`,
              value: r.starAverage,
              max: 5,
              displayValue: r.starAverage !== null ? `${r.starAverage}/5` : "—",
              tone: starTone(r.starAverage),
            }))}
          />

          <ReportBarList
            title="By branch"
            emptyText="No branch data for this period."
            rows={data.branches.map((b) => ({
              key: b.businessId,
              label: b.name,
              sublabel: `${b.region} · ${b.responseCount} resp.${b.confidence === "insufficient" ? " (low sample)" : ""}`,
              value: b.starAverage,
              max: 5,
              displayValue: b.starAverage !== null ? `${b.starAverage}/5` : "—",
              tone: starTone(b.starAverage),
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
              <ReportKpiGrid items={[{ label: "Cases resolved", value: String(data.colleagueExperience.casesResolved), icon: "✓" }]} />
              <ReportBarList
                title="By branch"
                emptyText="No Colleague-Experience-enabled branches yet."
                rows={data.colleagueExperience.branches.map((b) => ({
                  key: b.businessId,
                  label: b.name,
                  sublabel: `${b.region} · ${b.responseCount} resp.${b.confidence === "insufficient" ? " (low sample)" : ""}`,
                  value: b.starAverage,
                  max: 5,
                  displayValue: b.starAverage !== null ? `${b.starAverage}/5` : "—",
                  tone: starTone(b.starAverage),
                }))}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

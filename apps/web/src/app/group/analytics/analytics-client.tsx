"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { QuestionTrendCard } from "@/components/question-trend-card";
import { ScoreDriversCard } from "@/components/score-drivers-card";
import { ReportHero, ReportKpiGrid, ReportBarList, ReportThemeList, starTone } from "@/components/report-widgets";

interface AnalyticsData {
  trend: { date: string; starAverage: number | null }[];
  npsBreakdown: { promoters: number; passives: number; detractors: number; sampleSize: number };
  csat: { percent: number | null; sampleSize: number };
  ces: { average: number | null; lowEffortPercent: number | null; sampleSize: number };
  categoryBreakdown: { name: string; average: number }[];
  commentTags: { word: string; count: number; negative: boolean }[];
}

interface ReportBranchRow {
  businessId: string;
  name: string;
  region: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  confidence: "strong" | "directional" | "insufficient";
}
interface ReportRegionRow {
  region: string;
  businessCount: number;
  starAverage: number | null;
  npsScore: number | null;
}
interface ReportThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}
interface ReportData {
  status: string;
  product: "customer_experience" | "colleague_experience";
  orgName: string;
  period: { from: string; to: string };
  branches: ReportBranchRow[];
  regions: ReportRegionRow[];
  themes: ReportThemeRow[];
  activity: { casesResolved: number; initiativesCompleted: number; customersRespondedTo: number };
  colleagueExperience: { branches: ReportBranchRow[]; casesResolved: number } | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const CATEGORY_COLORS = ["#639922", "#7F77DD", "#EF9F27", "#E24B4A", "#5DCAA5", "#185FA5"];

// Same convention as compare-client.tsx's LOW_SAMPLE_THRESHOLD.
const LOW_SAMPLE_THRESHOLD = 10;

function LowSamplePill({ sampleSize }: { sampleSize: number }) {
  if (sampleSize === 0 || sampleSize >= LOW_SAMPLE_THRESHOLD) return null;
  return (
    <span
      className="pill pill-gray"
      style={{ marginLeft: 6, fontSize: 10 }}
      title={`Fewer than ${LOW_SAMPLE_THRESHOLD} responses — treat this as low-confidence`}
    >
      low sample
    </span>
  );
}

function trendSvgPoints(trend: { starAverage: number | null }[]): string {
  const known = trend.map((t) => t.starAverage).filter((v): v is number => v !== null);
  if (known.length === 0) return "";
  const width = 360;
  const height = 100;
  const step = width / Math.max(trend.length - 1, 1);
  return trend
    .map((point, i) => {
      const v = point.starAverage ?? known[known.length - 1];
      const y = height - (v / 5) * height;
      return `${(i * step + 16).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function GroupAnalyticsClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [view, setView] = useState<"explore" | "report">("explore");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [reportFrom, setReportFrom] = useState(isoDate(monthAgo));
  const [reportTo, setReportTo] = useState(isoDate(today));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportForbidden, setReportForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/group/analytics")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setReportLoading(true);
    fetch(`/api/group/reports?from=${reportFrom}&to=${reportTo}`)
      .then((res) => res.json())
      .then((d: ReportData) => {
        if (d.status !== "ok") {
          setReportForbidden(true);
          return;
        }
        setReportData(d);
      })
      .finally(() => setReportLoading(false));
  }, [reportFrom, reportTo]);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load analytics.</p>;

  const npsTotal = data.npsBreakdown.promoters + data.npsBreakdown.passives + data.npsBreakdown.detractors;
  const maxCategory = Math.max(...data.categoryBreakdown.map((c) => c.average), 5);

  function exportCsv() {
    const lines = ["Section,Label,Value"];
    lines.push(`NPS,Promoters,${data!.npsBreakdown.promoters}`);
    lines.push(`NPS,Passives,${data!.npsBreakdown.passives}`);
    lines.push(`NPS,Detractors,${data!.npsBreakdown.detractors}`);
    for (const c of data!.categoryBreakdown) lines.push(`Category,${c.name},${c.average}`);
    for (const t of data!.commentTags) lines.push(`Comment theme,${t.word},${t.count}`);
    for (const p of data!.trend) lines.push(`Trend,${p.date},${p.starAverage ?? ""}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "group-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={view === "report" ? "report-print-area" : undefined}>
      <div className="page-head" data-no-print>
        <div>
          <h1>Analytics</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {view === "explore" ? "Deep dive into your network's feedback data." : "A printable network summary for this window."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!reportForbidden && (
            <div className="segmented" style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <button
                className="btn"
                style={{
                  border: "none",
                  borderRadius: 0,
                  background: view === "explore" ? "var(--accent)" : "transparent",
                  color: view === "explore" ? "#fff" : undefined,
                }}
                onClick={() => setView("explore")}
              >
                Explore
              </button>
              <button
                className="btn"
                style={{
                  border: "none",
                  borderRadius: 0,
                  background: view === "report" ? "var(--accent)" : "transparent",
                  color: view === "report" ? "#fff" : undefined,
                }}
                onClick={() => setView("report")}
              >
                Report
              </button>
            </div>
          )}
          {view === "explore" ? (
            <button className="btn" onClick={exportCsv}>⬇ Export CSV</button>
          ) : (
            <>
              <a className="btn" href={`/api/group/reports/export?from=${reportFrom}&to=${reportTo}`}>
                ⬇ Export CSV
              </a>
              <button className="btn btn-dark" onClick={() => window.print()}>
                🖨 Print / Save as PDF
              </button>
            </>
          )}
        </div>
      </div>

      {view === "report" ? (
        <>
          <div className="filters" data-no-print>
            <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
          </div>

          {reportLoading && !reportData && <p className="subtitle">Loading…</p>}
          {reportData && (
            <>
              <ReportHero
                title={reportData.orgName}
                badge={
                  reportData.product === "colleague_experience" ? (
                    <span className="pill pill-blue" style={{ marginLeft: 4 }}>
                      Colleague Experience
                    </span>
                  ) : undefined
                }
                subtitle={`${new Date(reportData.period.from).toLocaleDateString()} – ${new Date(reportData.period.to).toLocaleDateString()} · ${reportData.branches.length} branches`}
              />

              <div className="rpt-section">
                <div className="section-title">Activity this period</div>
                <ReportKpiGrid
                  items={[
                    { label: "Cases resolved", value: String(reportData.activity.casesResolved), icon: "✓" },
                    { label: "Customers personally responded to", value: String(reportData.activity.customersRespondedTo), icon: "✉" },
                    { label: "Initiatives completed", value: String(reportData.activity.initiativesCompleted), icon: "🚀" },
                  ]}
                />
              </div>

              <ReportBarList
                title="By region"
                emptyText="No region data for this period."
                rows={reportData.regions.map((r) => ({
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
                rows={reportData.branches.map((b) => ({
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
                rows={reportData.themes.map((t) => ({
                  theme: t.theme,
                  frequency: t.frequency,
                  positive: t.sentimentBreakdown.positive,
                  neutral: t.sentimentBreakdown.neutral,
                  negative: t.sentimentBreakdown.negative,
                }))}
              />

              {reportData.colleagueExperience && (
                <>
                  <div className="section-title" style={{ marginTop: 4 }}>
                    Colleague Experience
                  </div>
                  <ReportKpiGrid items={[{ label: "Cases resolved", value: String(reportData.colleagueExperience.casesResolved), icon: "✓" }]} />
                  <ReportBarList
                    title="By branch"
                    emptyText="No Colleague-Experience-enabled branches yet."
                    rows={reportData.colleagueExperience.branches.map((b) => ({
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
        </>
      ) : (
        <>

      <QuestionTrendCard questionsApi="/api/group/analytics/questions" trendApi="/api/group/analytics/question-trend" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Trend over time</h3>
          <svg viewBox="0 0 380 120" width="100%" height="120">
            <line x1="16" y1="8" x2="16" y2="100" stroke="#E6E5E1" />
            <line x1="16" y1="100" x2="360" y2="100" stroke="#E6E5E1" />
            {trendSvgPoints(data.trend) && <polyline fill="none" stroke="#0F6E56" strokeWidth="2" points={trendSvgPoints(data.trend)} />}
          </svg>
        </div>
        <div className="card">
          <h3>
            NPS breakdown
            <InfoTip text={tooltips["nps-breakdown"]} />
          </h3>
          <div className="bars">
            <div className="bar-row">
              <div className="bar-label">Promoters</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${npsTotal ? (data.npsBreakdown.promoters / npsTotal) * 100 : 0}%`, background: "#639922" }} />
              </div>
              <div className="bar-val">{data.npsBreakdown.promoters}</div>
            </div>
            <div className="bar-row">
              <div className="bar-label">Passives</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${npsTotal ? (data.npsBreakdown.passives / npsTotal) * 100 : 0}%`, background: "#EF9F27" }} />
              </div>
              <div className="bar-val">{data.npsBreakdown.passives}</div>
            </div>
            <div className="bar-row">
              <div className="bar-label">Detractors</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${npsTotal ? (data.npsBreakdown.detractors / npsTotal) * 100 : 0}%`, background: "#E24B4A" }} />
              </div>
              <div className="bar-val">{data.npsBreakdown.detractors}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>
            CSAT
            <InfoTip text="% of star-rating responses that are 4 or 5 out of 5 — the standard 'satisfied customers' number, reported separately from the raw average and from NPS." />
            <LowSamplePill sampleSize={data.csat.sampleSize} />
          </h3>
          <div className="metric-val">{data.csat.percent !== null ? `${data.csat.percent}%` : "—"}</div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "4px 0 0" }}>
            {data.csat.sampleSize} rated response{data.csat.sampleSize === 1 ? "" : "s"}
          </p>
        </div>
        <div className="card">
          <h3>
            CES — Customer Effort
            <InfoTip text="% of effort-question responses answering 1 or 2 out of 5 ('very easy'/'easy'). Low effort is the good outcome, opposite of star/NPS/CSAT." />
            <LowSamplePill sampleSize={data.ces.sampleSize} />
          </h3>
          <div className="metric-val">{data.ces.lowEffortPercent !== null ? `${data.ces.lowEffortPercent}%` : "—"}</div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "4px 0 0" }}>
            {data.ces.average !== null ? `Average effort score ${data.ces.average}/5 · ` : ""}
            {data.ces.sampleSize} response{data.ces.sampleSize === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Category breakdown</h3>
          <div className="bars">
            {data.categoryBreakdown.map((c, i) => (
              <div className="bar-row" key={c.name}>
                <div className="bar-label">{c.name}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.average / maxCategory) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                </div>
                <div className="bar-val">{c.average}</div>
              </div>
            ))}
            {data.categoryBreakdown.length === 0 && <p className="subtitle">No categorized questions yet.</p>}
          </div>
        </div>
        <div className="card">
          <h3>
            Comment themes
            <InfoTip text={tooltips["comment-themes"]} />
          </h3>
          <div className="tag-cloud">
            {data.commentTags.map((t) => (
              <span key={t.word} className={t.count >= 8 ? "big" : t.negative ? "neg" : ""}>
                {t.word} ({t.count})
              </span>
            ))}
            {data.commentTags.length === 0 && <p className="subtitle">No comments yet.</p>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ScoreDriversCard
          driverApiPath="/api/group/driver-analysis"
          rootCauseApiPath="/api/group/root-cause-analysis"
          canCreateAction={false}
          themeApiPath="/api/group/theme-intelligence"
          analyzeApiPath="/api/group/theme-intelligence/analyze"
          insightsApiPath="/api/group/insights"
          driverTooltip={tooltips["driver-analysis"]}
          rootCauseTooltip={tooltips["root-cause"]}
          themeTooltip={tooltips["theme-intelligence"]}
        />
      </div>
        </>
      )}
    </div>
  );
}

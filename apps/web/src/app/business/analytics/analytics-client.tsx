"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { QuestionTrendCard } from "@/components/question-trend-card";
import { ScoreDriversCard } from "@/components/score-drivers-card";
import { ReportHero, ReportKpiGrid, ReportBarList, ReportThemeList, starTone, npsTone } from "@/components/report-widgets";

interface AnalyticsData {
  feedbackPoints: { _id: string; name: string; eventId: string | null }[];
  events: { _id: string; name: string; seriesKey: string }[];
  eventBreakdown: {
    _id: string;
    name: string;
    seriesKey: string;
    facilitator: string;
    location: string;
    responseCount: number;
    starAverage: number | null;
    responseRate: number | null;
    scanCount: number;
    conversionRate: number | null;
  }[];
  filters: { feedbackPointId: string | null; eventId: string | null; from: string; to: string };
  trend: { date: string; starAverage: number | null }[];
  npsBreakdown: { promoters: number; passives: number; detractors: number; sampleSize: number };
  csat: { percent: number | null; sampleSize: number };
  ces: { average: number | null; lowEffortPercent: number | null; sampleSize: number };
  categoryBreakdown: { name: string; average: number }[];
  commentTags: { word: string; count: number; negative: boolean }[];
  demographics: { ageGroups: { label: string; count: number }[]; genders: { label: string; count: number }[] };
  scanPatterns: { deviceBreakdown: { label: string; count: number }[]; dayHourCounts: number[][] };
}

interface ReportCategoryRow {
  categoryId: string;
  name: string;
  average: number;
}
interface ReportThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}
interface ReportData {
  status: string;
  product: "customer_experience" | "colleague_experience";
  businessName: string;
  period: { from: string; to: string };
  metrics: { responseCount: number; starAverage: number | null; npsScore: number | null };
  categoryBreakdown: ReportCategoryRow[];
  themes: ReportThemeRow[];
  activity: { casesResolved: number; initiativesCompleted: number; customersRespondedTo: number };
  colleagueExperience: {
    metrics: { responseCount: number; starAverage: number | null; npsScore: number | null };
    categoryBreakdown: ReportCategoryRow[];
    casesResolved: number;
  } | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEVICE_LABELS: Record<string, string> = { mobile: "📱 Mobile", tablet: "📲 Tablet", desktop: "🖥 Desktop", unknown: "❓ Unknown" };

const CATEGORY_COLORS = ["#639922", "#7F77DD", "#EF9F27", "#E24B4A", "#5DCAA5", "#185FA5"];

// Same convention as compare-client.tsx's LOW_SAMPLE_THRESHOLD — a handful
// of responses shouldn't read as a confident percentage.
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
  const width = 340;
  const height = 100;
  const step = width / Math.max(trend.length - 1, 1);
  return trend
    .map((point, i) => {
      const v = point.starAverage ?? known[known.length - 1];
      const y = height - (v / 5) * height;
      return `${(i * step + 20).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildQuery(feedbackPointId: string, eventId: string, from: string, to: string): string {
  const params = new URLSearchParams();
  if (feedbackPointId) params.set("feedbackPointId", feedbackPointId);
  if (eventId) params.set("eventId", eventId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [view, setView] = useState<"explore" | "report">("explore");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackPointId, setFeedbackPointId] = useState("");
  const [eventId, setEventId] = useState("");
  const [compareBy, setCompareBy] = useState<"branch" | "event">("branch");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [reportFrom, setReportFrom] = useState(isoDate(monthAgo));
  const [reportTo, setReportTo] = useState(isoDate(today));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportForbidden, setReportForbidden] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/business/analytics${buildQuery(feedbackPointId, eventId, from, to)}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        // Sync the date inputs to the server-resolved default window on first load,
        // so the pickers show the range actually being charted, not blank.
        if (!from && d.filters?.from) setFrom(d.filters.from);
        if (!to && d.filters?.to) setTo(d.filters.to);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackPointId, eventId, from, to]);

  useEffect(() => {
    setReportLoading(true);
    fetch(`/api/business/reports?from=${reportFrom}&to=${reportTo}`)
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

  if (loading && !data) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load analytics.</p>;

  const npsTotal = data.npsBreakdown.promoters + data.npsBreakdown.passives + data.npsBreakdown.detractors;
  const maxCategory = Math.max(...data.categoryBreakdown.map((c) => c.average), 5);

  return (
    <div className={view === "report" ? "report-print-area" : undefined}>
      <div className="page-head" data-no-print>
        <div>
          <h1>Analytics</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {view === "explore" ? "Deep dive into your feedback data." : "A printable period summary — download as PDF or export the numbers."}
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
            <a className="btn" href={`/api/business/analytics/export${buildQuery(feedbackPointId, eventId, from, to)}`}>
              ⬇ Export CSV
            </a>
          ) : (
            <>
              <a className="btn" href={`/api/business/reports/export?from=${reportFrom}&to=${reportTo}`}>
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
                title={reportData.businessName}
                badge={
                  reportData.product === "colleague_experience" ? (
                    <span className="pill pill-blue" style={{ marginLeft: 4 }}>
                      Colleague Experience
                    </span>
                  ) : undefined
                }
                subtitle={`${new Date(reportData.period.from).toLocaleDateString()} – ${new Date(reportData.period.to).toLocaleDateString()}`}
              />

              <ReportKpiGrid
                items={[
                  { label: "Responses", value: String(reportData.metrics.responseCount), icon: "💬" },
                  {
                    label: "Star average",
                    value: reportData.metrics.starAverage !== null ? `${reportData.metrics.starAverage}/5` : "—",
                    tone: starTone(reportData.metrics.starAverage),
                    icon: "★",
                  },
                  {
                    label: reportData.product === "colleague_experience" ? "eNPS" : "NPS",
                    value: reportData.metrics.npsScore !== null ? String(reportData.metrics.npsScore) : "—",
                    tone: npsTone(reportData.metrics.npsScore),
                    icon: "🎯",
                  },
                ]}
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
                title="By category"
                emptyText="No category data for this period."
                rows={reportData.categoryBreakdown.map((c) => ({
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
                  <ReportKpiGrid
                    items={[
                      { label: "Responses", value: String(reportData.colleagueExperience.metrics.responseCount), icon: "💬" },
                      {
                        label: "Star average",
                        value:
                          reportData.colleagueExperience.metrics.starAverage !== null
                            ? `${reportData.colleagueExperience.metrics.starAverage}/5`
                            : "—",
                        tone: starTone(reportData.colleagueExperience.metrics.starAverage),
                        icon: "★",
                      },
                      {
                        label: "eNPS",
                        value: reportData.colleagueExperience.metrics.npsScore !== null ? String(reportData.colleagueExperience.metrics.npsScore) : "—",
                        tone: npsTone(reportData.colleagueExperience.metrics.npsScore),
                        icon: "🎯",
                      },
                      { label: "Cases resolved", value: String(reportData.colleagueExperience.casesResolved), icon: "✓" },
                    ]}
                  />
                  <ReportBarList
                    title="By category"
                    emptyText="No category data for this period."
                    rows={reportData.colleagueExperience.categoryBreakdown.map((c) => ({
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
        </>
      ) : (
        <>
      {data.events.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            className="btn"
            style={compareBy === "branch" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : undefined}
            onClick={() => {
              setCompareBy("branch");
              setEventId("");
            }}
          >
            Compare by branch
          </button>
          <button
            className="btn"
            style={compareBy === "event" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : undefined}
            onClick={() => {
              setCompareBy("event");
              setFeedbackPointId("");
            }}
          >
            Compare by session
          </button>
        </div>
      )}

      <div className="filters">
        {compareBy === "branch" ? (
          <select value={feedbackPointId} onChange={(e) => setFeedbackPointId(e.target.value)}>
            <option value="">All feedback points</option>
            {data.feedbackPoints.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">All sessions</option>
            {data.events.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {compareBy === "event" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Sessions compared</h3>
          <p className="card-sub">Every session in range, side by side — pick one above to filter the charts below to just that session.</p>
          <table className="clean">
            <thead>
              <tr>
                <th>Session</th>
                <th>Facilitator</th>
                <th>Location</th>
                <th>Scans</th>
                <th>Responses</th>
                <th>Conversion</th>
                <th>Response rate</th>
                <th>Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {data.eventBreakdown.map((ev) => (
                <tr key={ev._id}>
                  <td>{ev.name}</td>
                  <td>{ev.facilitator || "—"}</td>
                  <td>{ev.location || "—"}</td>
                  <td>{ev.scanCount}</td>
                  <td>{ev.responseCount}</td>
                  <td>{ev.conversionRate !== null ? `${ev.conversionRate}%` : "—"}</td>
                  <td>{ev.responseRate !== null ? `${ev.responseRate}%` : "—"}</td>
                  <td>{ev.starAverage !== null ? `${ev.starAverage} / 5` : "—"}</td>
                </tr>
              ))}
              {data.eventBreakdown.length === 0 && (
                <tr>
                  <td colSpan={8} className="subtitle">
                    No sessions in range yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <QuestionTrendCard questionsApi="/api/business/analytics/questions" trendApi="/api/business/analytics/question-trend" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Trend over time</h3>
          <svg viewBox="0 0 380 120" width="100%" height="120">
            <line x1="16" y1="8" x2="16" y2="100" stroke="#E6E5E1" />
            <line x1="16" y1="100" x2="360" y2="100" stroke="#E6E5E1" />
            {trendSvgPoints(data.trend) && (
              <polyline fill="none" stroke="#0F6E56" strokeWidth="2" points={trendSvgPoints(data.trend)} />
            )}
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
                <div
                  className="bar-fill"
                  style={{ width: `${npsTotal ? (data.npsBreakdown.promoters / npsTotal) * 100 : 0}%`, background: "#639922" }}
                />
              </div>
              <div className="bar-val">{data.npsBreakdown.promoters}</div>
            </div>
            <div className="bar-row">
              <div className="bar-label">Passives</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${npsTotal ? (data.npsBreakdown.passives / npsTotal) * 100 : 0}%`, background: "#EF9F27" }}
                />
              </div>
              <div className="bar-val">{data.npsBreakdown.passives}</div>
            </div>
            <div className="bar-row">
              <div className="bar-label">Detractors</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${npsTotal ? (data.npsBreakdown.detractors / npsTotal) * 100 : 0}%`, background: "#E24B4A" }}
                />
              </div>
              <div className="bar-val">{data.npsBreakdown.detractors}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
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
                  <div
                    className="bar-fill"
                    style={{ width: `${(c.average / maxCategory) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
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
          <p className="card-sub">Auto-grouped from open-ended answers.</p>
          <div className="tag-cloud">
            {data.commentTags.map((t) => (
              <span key={t.word} className={t.count >= 5 ? "big" : t.negative ? "neg" : ""}>
                {t.word} ({t.count})
              </span>
            ))}
            {data.commentTags.length === 0 && <p className="subtitle">No comments yet.</p>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ScoreDriversCard
          driverApiPath="/api/business/driver-analysis"
          rootCauseApiPath="/api/business/root-cause-analysis"
          canCreateAction
          createActionApiPath="/api/business/action-board"
          themeApiPath="/api/business/theme-intelligence"
          analyzeApiPath="/api/business/theme-intelligence/analyze"
          insightsApiPath="/api/business/insights"
          driverTooltip={tooltips["driver-analysis"]}
          rootCauseTooltip={tooltips["root-cause"]}
          themeTooltip={tooltips["theme-intelligence"]}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>
          Respondent age &amp; gender
          <InfoTip text={tooltips["demographics"]} />
        </h3>
        <p className="card-sub">Based on respondents who chose to share this.</p>
        <div className="grid grid-2">
          <table className="clean">
            <tbody>
              {data.demographics.ageGroups.map((g) => (
                <tr key={g.label}>
                  <td>{g.label}</td>
                  <td style={{ textAlign: "right" }}>{g.count}</td>
                </tr>
              ))}
              {data.demographics.ageGroups.length === 0 && (
                <tr>
                  <td className="subtitle">No age data collected.</td>
                </tr>
              )}
            </tbody>
          </table>
          <table className="clean">
            <tbody>
              {data.demographics.genders.map((g) => (
                <tr key={g.label}>
                  <td>{g.label}</td>
                  <td style={{ textAlign: "right" }}>{g.count}</td>
                </tr>
              ))}
              {data.demographics.genders.length === 0 && (
                <tr>
                  <td className="subtitle">No gender data collected.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>
            When feedback is submitted
            <InfoTip text={tooltips["scan-heatmap"]} />
          </h3>
          <p className="card-sub">Day of week × hour — darker means more responses.</p>
          <ScanHeatmap dayHourCounts={data.scanPatterns.dayHourCounts} />
        </div>
        <div className="card">
          <h3>Devices used</h3>
          <p className="card-sub">What respondents are scanning with.</p>
          <div className="bars">
            {data.scanPatterns.deviceBreakdown.map((d) => {
              const total = data.scanPatterns.deviceBreakdown.reduce((sum, x) => sum + x.count, 0);
              return (
                <div className="bar-row" key={d.label}>
                  <div className="bar-label">{DEVICE_LABELS[d.label] ?? d.label}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${total ? (d.count / total) * 100 : 0}%`, background: "#185FA5" }} />
                  </div>
                  <div className="bar-val">{d.count}</div>
                </div>
              );
            })}
            {data.scanPatterns.deviceBreakdown.length === 0 && <p className="subtitle">No responses yet.</p>}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function ScanHeatmap({ dayHourCounts }: { dayHourCounts: number[][] }) {
  const max = Math.max(1, ...dayHourCounts.flat());
  return (
    <div className="heatmap">
      <div className="heatmap-hours">
        {[0, 6, 12, 18].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
      {dayHourCounts.map((hours, day) => (
        <div className="heatmap-row" key={day}>
          <div className="heatmap-day">{DAY_LABELS[day]}</div>
          <div className="heatmap-cells">
            {hours.map((count, hour) => (
              <div
                key={hour}
                className="heatmap-cell"
                title={`${DAY_LABELS[day]} ${hour}:00 — ${count} response${count === 1 ? "" : "s"}`}
                style={{ background: count === 0 ? "var(--border)" : `rgba(15, 110, 86, ${0.15 + (count / max) * 0.85})` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

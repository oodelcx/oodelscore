"use client";

import { useEffect, useState } from "react";

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
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 4px" }}>{data.businessName}</h2>
            <p className="subtitle" style={{ margin: 0 }}>
              {new Date(data.period.from).toLocaleDateString()} – {new Date(data.period.to).toLocaleDateString()}
            </p>
          </div>

          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="metric-label">Responses</div>
              <div className="metric-val">{data.metrics.responseCount}</div>
            </div>
            <div className="card">
              <div className="metric-label">Star average</div>
              <div className="metric-val">{data.metrics.starAverage !== null ? `${data.metrics.starAverage}/5` : "—"}</div>
            </div>
            <div className="card">
              <div className="metric-label">NPS</div>
              <div className="metric-val">{data.metrics.npsScore !== null ? data.metrics.npsScore : "—"}</div>
            </div>
          </div>

          <div className="section-title">Activity this period</div>
          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="metric-label">Cases resolved</div>
              <div className="metric-val">{data.activity.casesResolved}</div>
            </div>
            <div className="card">
              <div className="metric-label">Customers personally responded to</div>
              <div className="metric-val">{data.activity.customersRespondedTo}</div>
            </div>
            <div className="card">
              <div className="metric-label">Initiatives completed</div>
              <div className="metric-val">{data.activity.initiativesCompleted}</div>
            </div>
          </div>

          <div className="section-title">By category</div>
          <table className="clean" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              {data.categoryBreakdown.map((c) => (
                <tr key={c.categoryId}>
                  <td>{c.name}</td>
                  <td>{c.average}/5</td>
                </tr>
              ))}
              {data.categoryBreakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="subtitle">
                    No category data for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title">Top themes</div>
          <table className="clean">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Mentions</th>
                <th>Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {data.themes.map((t) => (
                <tr key={t.theme}>
                  <td>{t.theme}</td>
                  <td>{t.frequency}</td>
                  <td>
                    {t.sentimentBreakdown.positive} positive · {t.sentimentBreakdown.neutral} neutral ·{" "}
                    {t.sentimentBreakdown.negative} negative
                  </td>
                </tr>
              ))}
              {data.themes.length === 0 && (
                <tr>
                  <td colSpan={3} className="subtitle">
                    No themes detected for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {data.colleagueExperience && (
            <>
              <div className="section-title" style={{ marginTop: 24 }}>Colleague Experience</div>
              <div className="grid grid-3" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="metric-label">Responses</div>
                  <div className="metric-val">{data.colleagueExperience.metrics.responseCount}</div>
                </div>
                <div className="card">
                  <div className="metric-label">Star average</div>
                  <div className="metric-val">
                    {data.colleagueExperience.metrics.starAverage !== null ? `${data.colleagueExperience.metrics.starAverage}/5` : "—"}
                  </div>
                </div>
                <div className="card">
                  <div className="metric-label">eNPS</div>
                  <div className="metric-val">
                    {data.colleagueExperience.metrics.npsScore !== null ? data.colleagueExperience.metrics.npsScore : "—"}
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 20, maxWidth: 240 }}>
                <div className="metric-label">Cases resolved</div>
                <div className="metric-val">{data.colleagueExperience.casesResolved}</div>
              </div>
              <div className="section-title">By category</div>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {data.colleagueExperience.categoryBreakdown.map((c) => (
                    <tr key={c.categoryId}>
                      <td>{c.name}</td>
                      <td>{c.average}/5</td>
                    </tr>
                  ))}
                  {data.colleagueExperience.categoryBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={2} className="subtitle">
                        No category data for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}

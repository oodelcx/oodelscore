"use client";

import { useEffect, useState } from "react";

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
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 4px" }}>
              {data.orgName}
              {data.product === "colleague_experience" && <span className="pill pill-blue" style={{ marginLeft: 10 }}>Colleague Experience</span>}
            </h2>
            <p className="subtitle" style={{ margin: 0 }}>
              {new Date(data.period.from).toLocaleDateString()} – {new Date(data.period.to).toLocaleDateString()} ·{" "}
              {data.branches.length} branches
            </p>
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

          <div className="section-title">By region</div>
          <table className="clean" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Region</th>
                <th>Branches</th>
                <th>Average</th>
                <th>{data.product === "colleague_experience" ? "eNPS" : "NPS"}</th>
              </tr>
            </thead>
            <tbody>
              {data.regions.map((r) => (
                <tr key={r.region}>
                  <td>{r.region}</td>
                  <td>{r.businessCount}</td>
                  <td>{r.starAverage !== null ? `${r.starAverage}/5` : "—"}</td>
                  <td>{r.npsScore !== null ? r.npsScore : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-title">By branch</div>
          <table className="clean" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Region</th>
                <th>Responses</th>
                <th>Average</th>
                <th>{data.product === "colleague_experience" ? "eNPS" : "NPS"}</th>
              </tr>
            </thead>
            <tbody>
              {data.branches.map((b) => (
                <tr key={b.businessId}>
                  <td>{b.name}</td>
                  <td>{b.region}</td>
                  <td>
                    {b.responseCount}
                    {b.confidence === "insufficient" && <span className="subtitle"> (low sample)</span>}
                  </td>
                  <td>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</td>
                  <td>{b.npsScore !== null ? b.npsScore : "—"}</td>
                </tr>
              ))}
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
              <div className="card" style={{ marginBottom: 20, maxWidth: 240 }}>
                <div className="metric-label">Cases resolved</div>
                <div className="metric-val">{data.colleagueExperience.casesResolved}</div>
              </div>
              <div className="section-title">By branch</div>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Region</th>
                    <th>Responses</th>
                    <th>Average</th>
                    <th>eNPS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.colleagueExperience.branches.map((b) => (
                    <tr key={b.businessId}>
                      <td>{b.name}</td>
                      <td>{b.region}</td>
                      <td>
                        {b.responseCount}
                        {b.confidence === "insufficient" && <span className="subtitle"> (low sample)</span>}
                      </td>
                      <td>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</td>
                      <td>{b.npsScore !== null ? b.npsScore : "—"}</td>
                    </tr>
                  ))}
                  {data.colleagueExperience.branches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="subtitle">
                        No Colleague-Experience-enabled branches yet.
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

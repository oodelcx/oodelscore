"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ReportKpiGrid, ReportBarList, starTone, npsTone } from "@/components/report-widgets";

interface RegionData {
  region: string;
  businessCount: number;
  average: number | null;
  nps: number | null;
  outliers: { businessId: string; name: string; starAverage: number; sigmaBelowRegion: number }[];
  trend: { weekStart: string; region: number | null; group: number | null }[];
  openCases: number;
  groupAverage: number | null;
  responseCount: number;
  branches: { businessId: string; name: string; starAverage: number | null; npsScore: number | null; responseCount: number }[];
}

function TrendChart({ trend }: { trend: RegionData["trend"] }) {
  const W = 640, H = 200, L = 34, R = 12, T = 12, B = 26;
  const pts = trend.filter((t) => t.region !== null || t.group !== null);
  if (pts.length < 2) return <p className="subtitle">Not enough weekly data yet for a trend.</p>;
  const x = (i: number) => L + (i * (W - L - R)) / (trend.length - 1);
  const y = (v: number) => T + ((5 - v) / 4) * (H - T - B); // 1..5 scale
  const line = (key: "region" | "group") => {
    let d = "";
    trend.forEach((t, i) => { const v = t[key]; if (v === null) return; d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; });
    return d;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly average rating, region against group" style={{ width: "100%", height: "auto", maxHeight: 240 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.1} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity={0.55}>{v}</text>
        </g>
      ))}
      <path d={line("group")} fill="none" stroke="currentColor" opacity={0.45} strokeWidth="2" strokeDasharray="5 4" />
      <path d={line("region")} fill="none" stroke="#0b7a55" strokeWidth="2.5" />
      {trend.map((t, i) => t.region !== null ? <circle key={i} cx={x(i)} cy={y(t.region)} r="3" fill="#0b7a55" /> : null)}
      {trend.map((t, i) => (i % 2 === 0 || i === trend.length - 1) ? <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity={0.55}>{new Date(t.weekStart).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</text> : null)}
    </svg>
  );
}

export default function RegionDetailPage({ params }: { params: Promise<{ region: string }> }) {
  const { region } = use(params);
  const [data, setData] = useState<RegionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/group/regions/${encodeURIComponent(region)}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [region]);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load this region.</p>;

  const filteredBranches = data.branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Link className="backlink" href="/group">
        ← Back to overview
      </Link>
      <h1>{data.region} region</h1>
      <p className="subtitle">
        {data.businessCount} branches · {data.average !== null ? `${data.average}/5 average` : "no data"} ·{" "}
        {data.nps !== null ? `${data.nps} NPS` : ""} · {data.outliers.length} branches currently flagged
      </p>

      <ReportKpiGrid
        items={[
          { label: "Average rating", value: data.average !== null ? `${data.average}/5` : "—", tone: starTone(data.average) },
          { label: "vs whole group", value: data.average !== null && data.groupAverage !== null ? `${data.average - data.groupAverage >= 0 ? "+" : ""}${(data.average - data.groupAverage).toFixed(2)}` : "—", tone: data.average !== null && data.groupAverage !== null ? (data.average >= data.groupAverage ? "good" : "warn") : "neutral" },
          { label: "NPS", value: data.nps !== null ? String(data.nps) : "—", tone: npsTone(data.nps) },
          { label: "Responses (30 days)", value: data.responseCount.toLocaleString(), tone: "neutral" },
          { label: "Open cases", value: String(data.openCases), tone: data.openCases > 0 ? "warn" : "good" },
          { label: "Flagged branches", value: String(data.outliers.length), tone: data.outliers.length > 0 ? "bad" : "good" },
        ]}
      />

      <div className="card" style={{ margin: "16px 0" }}>
        <h3>Rating over the last 12 weeks</h3>
        <p className="card-sub">Solid green is this region, dashed grey is the whole group. Weeks with fewer than 3 responses are left blank.</p>
        <TrendChart trend={data.trend} />
      </div>

      <ReportBarList
        title="Branches ranked by rating"
        emptyText="No scored branches yet."
        rows={data.branches.map((b) => ({ key: b.businessId, label: b.name, sublabel: `${b.responseCount} responses`, value: b.starAverage, max: 5, displayValue: b.starAverage !== null ? `${b.starAverage}/5` : "—", tone: starTone(b.starAverage) }))}
      />

      <div className="section-title">Why {data.outliers.length} are flagged</div>
      <p className="section-sub">Sourced from Alert rules — the same rules you can see and edit on Alert Rules.</p>
      <table className="clean" style={{ marginBottom: 26 }}>
        <thead>
          <tr>
            <th>Branch</th>
            <th>Average</th>
            <th>Rule triggered</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.outliers.map((o) => (
            <tr key={o.businessId}>
              <td>{o.name}</td>
              <td>{o.starAverage}/5</td>
              <td>Regional outlier — {o.sigmaBelowRegion}σ below region</td>
              <td style={{ textAlign: "right" }}>
                <Link className="btn btn-sm" href={`/group/branches/${o.businessId}`}>
                  Open →
                </Link>
              </td>
            </tr>
          ))}
          {data.outliers.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
                No branches currently flagged in this region.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="section-title">All branches in this region</div>
      <div className="filters">
        <input type="text" placeholder="Search branches in this region…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <table className="clean">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Average</th>
            <th>NPS</th>
            <th>Responses</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredBranches.map((b) => (
            <tr key={b.businessId}>
              <td>{b.name}</td>
              <td>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</td>
              <td>{b.npsScore ?? "—"}</td>
              <td>{b.responseCount}</td>
              <td style={{ textAlign: "right" }}>
                <Link className="btn btn-sm" href={`/group/branches/${b.businessId}`}>
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

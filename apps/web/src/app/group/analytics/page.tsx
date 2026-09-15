"use client";

import { useEffect, useState } from "react";
import { ThemeIntelligenceCard } from "@/components/theme-intelligence-card";

interface AnalyticsData {
  trend: { date: string; starAverage: number | null }[];
  npsBreakdown: { promoters: number; passives: number; detractors: number };
  categoryBreakdown: { name: string; average: number }[];
  commentTags: { word: string; count: number; negative: boolean }[];
}

const CATEGORY_COLORS = ["#639922", "#7F77DD", "#EF9F27", "#E24B4A", "#5DCAA5", "#185FA5"];

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

export default function GroupAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/group/analytics")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="subtitle" style={{ margin: 0 }}>Deep dive into your network&apos;s feedback data.</p>
        </div>
        <button className="btn" onClick={exportCsv}>⬇ Export CSV</button>
      </div>

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
          <h3>NPS breakdown</h3>
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
          <h3>Comment themes</h3>
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
        <ThemeIntelligenceCard apiPath="/api/group/theme-intelligence" analyzeApiPath="/api/group/theme-intelligence/analyze" />
      </div>
    </div>
  );
}

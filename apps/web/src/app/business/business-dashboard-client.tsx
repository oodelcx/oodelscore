"use client";

import { useEffect, useState } from "react";
import { PeriodComparisonCards } from "@/components/period-comparison-cards";
import { InfoTip } from "@/components/info-tip";
import { useTooltips } from "@/lib/useTooltips";

interface Comparison {
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  changePercent: number | null;
}
interface TrendPoint {
  date: string;
  starAverage: number | null;
}
interface Comment {
  comment: string;
  star: number | null;
  submittedAt: string;
}
interface BranchInfo {
  parentOrgName: string;
  region: string;
  cxPulseLevel: number | null;
  regionAverageStarScore: number | null;
  regionRank: number | null;
  regionBusinessCount: number;
  recentDecisions: { title: string; description: string; loggedAt: string }[];
}
interface DashboardData {
  totalResponses: number;
  starAverage: number | null;
  npsScore: number | null;
  conversionRate: number | null;
  comparisons: { week: Comparison; month: Comparison; quarter: Comparison; year: Comparison };
  trend: TrendPoint[];
  distribution: { highPercent: number; midPercent: number; lowPercent: number };
  latestComments: Comment[];
  branch: BranchInfo | null;
}

const CX_PULSE_LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];

function trendSvgPoints(trend: TrendPoint[]): string {
  const values = trend.map((t) => t.starAverage);
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return "";
  const min = 0;
  const max = 5;
  const width = 360;
  const height = 110;
  const step = width / Math.max(trend.length - 1, 1);
  return trend
    .map((point, i) => {
      const v = point.starAverage ?? known[known.length - 1];
      const y = height - ((v - min) / (max - min)) * height;
      return `${(i * step + 20).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function BusinessDashboardClient() {
  const tooltips = useTooltips("business-dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/dashboard")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load your dashboard.</p>;

  if (data.branch) {
    const b = data.branch;
    return (
      <div>
        <h1>
          Your Dashboard {b.parentOrgName && <span className="group-badge">🏢 {b.parentOrgName}</span>}
        </h1>
        <p className="subtitle">
          {b.region ? `${b.region} region · ` : ""}Your feedback performance at a glance.
        </p>

        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="metric-label">
              Total responses <InfoTip text={tooltips["total-responses"]} />
            </div>
            <div className="metric-val">{data.totalResponses}</div>
          </div>
          <div className="card">
            <div className="metric-label">
              Average score <InfoTip text={tooltips["average-score"]} />
            </div>
            <div className="metric-val">{data.starAverage !== null ? `${data.starAverage}/5` : "—"}</div>
          </div>
          <div className="card">
            <div className="metric-label">
              NPS <InfoTip text={tooltips["nps"]} />
            </div>
            <div className="metric-val">{data.npsScore !== null ? formatSigned(data.npsScore) : "—"}</div>
          </div>
          <div className="card">
            <div className="metric-label">
              CX Pulse <InfoTip text={tooltips["cx-pulse"]} />
            </div>
            <div className="metric-val" style={{ fontSize: 18 }}>
              {b.cxPulseLevel ? `Level ${b.cxPulseLevel} · ${CX_PULSE_LEVEL_LABELS[b.cxPulseLevel]}` : "Not yet scored"}
            </div>
          </div>
        </div>

        {b.regionAverageStarScore !== null && data.starAverage !== null && (
          <div className="callout-purple">
            {data.starAverage >= b.regionAverageStarScore
              ? `You're ${b.regionRank === 1 ? "the top-performing" : "outperforming the average"} branch in ${b.region} this month (${data.starAverage}/5 vs a regional average of ${b.regionAverageStarScore}/5).`
              : `You're currently below the ${b.region} regional average (${data.starAverage}/5 vs ${b.regionAverageStarScore}/5, across ${b.regionBusinessCount} branches).`}
          </div>
        )}

        {b.recentDecisions.length > 0 && (
          <>
            <div className="section-title">Recent group decisions that affect you</div>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "-8px 0 14px" }}>
              Logged by {b.parentOrgName} — visible here for context, not editable.
            </p>
            {b.recentDecisions.map((d, i) => (
              <div className="card" key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.title}</div>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>{d.description}</p>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>Your Dashboard</h1>
      <p className="subtitle">Your feedback performance at a glance.</p>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">
            Total responses <InfoTip text={tooltips["total-responses"]} />
          </div>
          <div className="metric-val">{data.totalResponses}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            Average score <InfoTip text={tooltips["average-score"]} />
          </div>
          <div className="metric-val">{data.starAverage !== null ? `${data.starAverage}/5` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            NPS <InfoTip text={tooltips["nps"]} />
          </div>
          <div className="metric-val">{data.npsScore !== null ? formatSigned(data.npsScore) : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            Conversion rate <InfoTip text={tooltips["conversion-rate"]} />
          </div>
          <div className="metric-val">{data.conversionRate !== null ? `${data.conversionRate}%` : "—"}</div>
        </div>
      </div>

      <PeriodComparisonCards comparisons={data.comparisons} />

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>
            Response trend <InfoTip text={tooltips["response-trend"]} />
          </h3>
          <p className="card-sub">Daily average score over the last {data.trend.length} days.</p>
          <svg viewBox="0 0 400 140" width="100%" height="140">
            <line x1="30" y1="10" x2="30" y2="120" stroke="#E6E5E1" />
            <line x1="30" y1="120" x2="390" y2="120" stroke="#E6E5E1" />
            <text x="8" y="14" fontSize="9" fill="#9A9A97">5</text>
            <text x="8" y="67" fontSize="9" fill="#9A9A97">2.5</text>
            <text x="8" y="123" fontSize="9" fill="#9A9A97">0</text>
            {trendSvgPoints(data.trend) && (
              <polyline fill="none" stroke="#0F6E56" strokeWidth="2" points={trendSvgPoints(data.trend)} />
            )}
          </svg>
        </div>
        <div className="card">
          <h3>
            Rating distribution <InfoTip text={tooltips["rating-distribution"]} />
          </h3>
          <p className="card-sub">Last 30 days.</p>
          <div className="donut-wrap">
            <RatingDonut distribution={data.distribution} />
            <div className="legend">
              <div>
                <span className="dot" style={{ background: "#639922" }}></span>4–5 stars · {data.distribution.highPercent}%
              </div>
              <div>
                <span className="dot" style={{ background: "#EF9F27" }}></span>3 stars · {data.distribution.midPercent}%
              </div>
              <div>
                <span className="dot" style={{ background: "#E24B4A" }}></span>1–2 stars · {data.distribution.lowPercent}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Latest comments</div>
      <div className="card">
        {data.latestComments.length === 0 && <p className="subtitle" style={{ margin: 0 }}>No comments yet.</p>}
        {data.latestComments.map((c, i) => (
          <div key={i}>
            <div className="fb-comment">&quot;{c.comment}&quot;</div>
            <div className="fb-meta" style={{ marginTop: 8 }}>
              {c.star !== null ? `${c.star}★ · ` : ""}
              {new Date(c.submittedAt).toLocaleDateString()}
            </div>
            {i < data.latestComments.length - 1 && <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function RatingDonut({ distribution }: { distribution: { highPercent: number; midPercent: number; lowPercent: number } }) {
  const circumference = 2 * Math.PI * 15.9;
  const high = (distribution.highPercent / 100) * circumference;
  const mid = (distribution.midPercent / 100) * circumference;
  const low = (distribution.lowPercent / 100) * circumference;
  return (
    <svg width="120" height="120" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EAF3DE" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="#639922"
        strokeWidth="4"
        strokeDasharray={`${high} ${circumference - high}`}
        transform="rotate(-90 18 18)"
      />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="#EF9F27"
        strokeWidth="4"
        strokeDasharray={`${mid} ${circumference - mid}`}
        strokeDashoffset={-high}
        transform="rotate(-90 18 18)"
      />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="#E24B4A"
        strokeWidth="4"
        strokeDasharray={`${low} ${circumference - low}`}
        strokeDashoffset={-(high + mid)}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

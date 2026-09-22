"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PeriodComparisonCards, type Comparisons } from "@/components/period-comparison-cards";
import { InfoTip } from "@/components/info-tip";

interface RecurringFlagRow {
  _id: string;
  categoryName: string;
  count: number;
  windowDays: number;
  businessIds: string[];
}

/** Self-contained — fetches its own data so the main overview payload doesn't need to change. */
function RecurringIssuesCard() {
  const [flags, setFlags] = useState<RecurringFlagRow[]>([]);

  useEffect(() => {
    fetch("/api/group/recurring-issues")
      .then((r) => r.json())
      .then((d) => setFlags(d.flags ?? []))
      .catch(() => setFlags([]));
  }, []);

  if (flags.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: "var(--amber, #E0A100)" }}>
      <div className="metric-label">Recurring issues — cross-branch</div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {flags.map((f) => (
          <li key={f._id} style={{ marginBottom: 4 }}>
            <b>{f.categoryName}</b> — {f.count} cases across {f.businessIds.length} branches in the last{" "}
            {f.windowDays} days
          </li>
        ))}
      </ul>
      <a href="/group/improvement-initiatives" style={{ color: "var(--accent)" }}>
        Review in Improvement Initiatives →
      </a>
    </div>
  );
}

interface RegionRow {
  region: string;
  businessCount: number;
  starAverage: number | null;
  npsScore: number | null;
  flaggedCount: number;
  confidence: "strong" | "directional" | "insufficient";
}
interface OutlierRow {
  businessId: string;
  name: string;
  region: string;
  starAverage: number;
  sigmaBelowRegion: number;
}
interface TopRow {
  businessId: string;
  name: string;
  starAverage: number | null;
  responseCount: number;
}
interface ValueDelivered {
  casesResolvedThisPeriod: number;
  casesResolvedPrevPeriod: number;
  customersRespondedTo: number;
  activeInitiatives: number;
  completedInitiatives: number;
}
interface DecisionRow {
  _id: string;
  title: string;
  businessName: string;
}
interface ThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  trend: "up" | "down" | "flat" | null;
}
interface HoldingBackDimension {
  dimension: "awareness" | "response" | "ownership" | "culture" | "outcome";
  value: number;
}
interface OverviewData {
  branchCount: number;
  networkAverage: number | null;
  networkNps: number | null;
  cxPulseLevel: number | null;
  cxPulseHoldingBack: HoldingBackDimension[];
  comparisons: Comparisons;
  regions: RegionRow[];
  needsAttention: OutlierRow[];
  topPerformers: TopRow[];
  headline: string | null;
  valueDelivered: ValueDelivered;
  needsYourDecision: DecisionRow[];
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];
const DIMENSION_LABELS: Record<HoldingBackDimension["dimension"], string> = {
  awareness: "Awareness",
  response: "Response",
  ownership: "Ownership",
  culture: "Culture",
  outcome: "Outcome",
};

/** CX Pulse as a widget, not a full section: score plus what's dragging it down most. Full drill-down lives at /group/maturity. */
function CxPulseHoldingBack({ dimensions }: { dimensions: HoldingBackDimension[] }) {
  if (dimensions.length === 0) return null;
  return (
    <div className="metric-note" style={{ marginTop: 8 }}>
      Holding the network back: {dimensions.map((d) => `${DIMENSION_LABELS[d.dimension]} (${d.value})`).join(" · ")}
    </div>
  );
}

export default function GroupOverviewClient({ tooltips }: { tooltips: Record<string, string> }) {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jump, setJump] = useState("");
  const [jumpResults, setJumpResults] = useState<{ businessId: string; name: string }[]>([]);
  const [topThemes, setTopThemes] = useState<ThemeRow[]>([]);

  useEffect(() => {
    fetch("/api/group/overview")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
    fetch("/api/group/theme-intelligence")
      .then((res) => res.json())
      .then((d) => setTopThemes((d.themes ?? []).slice(0, 3)));
  }, []);

  useEffect(() => {
    if (!jump.trim()) {
      setJumpResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/group/branches?q=${encodeURIComponent(jump)}`)
        .then((res) => res.json())
        .then((d) =>
          setJumpResults((d.branches ?? []).slice(0, 6).map((b: { businessId: string; name: string }) => ({ businessId: b.businessId, name: b.name })))
        );
    }, 200);
    return () => clearTimeout(timeout);
  }, [jump]);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load overview.</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your Organization</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {data.branchCount} branches across {data.regions.length} region{data.regions.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Jump to a branch…"
            style={{ width: 260 }}
            value={jump}
            onChange={(e) => setJump(e.target.value)}
          />
          {jumpResults.length > 0 && (
            <div className="card" style={{ position: "absolute", top: 36, right: 0, zIndex: 5, padding: 6, width: 260 }}>
              {jumpResults.map((r) => (
                <div
                  key={r.businessId}
                  className="config-row"
                  style={{ cursor: "pointer", padding: "6px 8px" }}
                  onClick={() => router.push(`/group/branches/${r.businessId}`)}
                >
                  {r.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.headline && (
        <div className="callout" style={{ marginBottom: 16, fontSize: 15 }}>
          {data.headline}
        </div>
      )}

      <RecurringIssuesCard />

      {data.needsYourDecision.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--amber, #b57a00)" }}>
          <h3 style={{ margin: "0 0 8px" }}>Needs a decision from you</h3>
          <p className="card-sub">Cases that reached the top of your escalation chain and are still unresolved.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.needsYourDecision.map((d) => (
              <li key={d._id} style={{ marginBottom: 4 }}>
                <b>{d.businessName}</b> — {d.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section-title">Value delivered this period</div>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">Cases resolved</div>
          <div className="metric-val">{data.valueDelivered.casesResolvedThisPeriod}</div>
          <div className="metric-note">
            {data.valueDelivered.casesResolvedPrevPeriod > 0
              ? `vs ${data.valueDelivered.casesResolvedPrevPeriod} previous 30 days`
              : "previous period had none"}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Customers personally responded to</div>
          <div className="metric-val">{data.valueDelivered.customersRespondedTo}</div>
        </div>
        <div className="card">
          <div className="metric-label">Improvement initiatives in progress</div>
          <div className="metric-val">{data.valueDelivered.activeInitiatives}</div>
        </div>
        <div className="card">
          <div className="metric-label">Initiatives completed this period</div>
          <div className="metric-val">{data.valueDelivered.completedInitiatives}</div>
        </div>
      </div>

      {topThemes.length > 0 && (
        <>
          <div className="section-title">Top themes this month</div>
          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            {topThemes.map((t) => (
              <div className="card" key={t.theme}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{t.theme}</b>
                  {t.trend && (
                    <span className={`pill ${t.trend === "up" ? "pill-green" : t.trend === "down" ? "pill-red" : "pill-gray"}`}>
                      {t.trend === "up" ? "▲" : t.trend === "down" ? "▼" : "—"}
                    </span>
                  )}
                </div>
                <div className="metric-note">{t.frequency} mentions</div>
                <div className="metric-note">
                  {t.sentimentBreakdown.positive} positive · {t.sentimentBreakdown.neutral} neutral ·{" "}
                  {t.sentimentBreakdown.negative} negative
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-4" data-tour="group-kpi-strip" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">Branches</div>
          <div className="metric-val">{data.branchCount}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            Network average
            <InfoTip text={tooltips["network-average"]} />
          </div>
          <div className="metric-val">{data.networkAverage !== null ? `${data.networkAverage}/5` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            Network NPS
            <InfoTip text={tooltips["network-nps"]} />
          </div>
          <div className="metric-val">{data.networkNps !== null ? formatSigned(data.networkNps) : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            CX Pulse
            <InfoTip text={tooltips["cx-pulse-level"]} />
          </div>
          <div className="metric-val" style={{ fontSize: 18 }}>
            {data.cxPulseLevel ? `Level ${data.cxPulseLevel} · ${LEVEL_LABELS[data.cxPulseLevel]}` : "Not yet scored"}
          </div>
          <CxPulseHoldingBack dimensions={data.cxPulseHoldingBack} />
          <div className="metric-note">
            <Link href="/group/maturity" style={{ color: "var(--accent)" }}>
              See what&apos;s behind this →
            </Link>
          </div>
        </div>
      </div>

      <PeriodComparisonCards comparisons={data.comparisons} />

      <div className="callout">
        Outliers and regions are surfaced here first — every branch is always fully searchable in detail on Branches,
        regardless of network size.
      </div>

      <div className="section-title">
        Regions
        <InfoTip text={tooltips["region-confidence"]} />
      </div>
      <table className="clean" data-tour="group-branches-table" style={{ marginBottom: 28 }}>
        <thead>
          <tr>
            <th>Region</th>
            <th>Branches</th>
            <th>Average</th>
            <th>NPS</th>
            <th>Flagged</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.regions.map((r) => (
            <tr key={r.region}>
              <td>
                <div className="row-flex">
                  <div className="avatar teal">{r.region.slice(0, 2).toUpperCase()}</div>
                  {r.region}
                </div>
              </td>
              <td>{r.businessCount}</td>
              <td>
                {r.starAverage !== null ? `${r.starAverage}/5` : "—"}
                {r.confidence === "insufficient" && <span className="subtitle"> (low sample)</span>}
              </td>
              <td>{r.npsScore !== null ? formatSigned(r.npsScore) : "—"}</td>
              <td>
                <span className={`pill ${r.flaggedCount > 0 ? "pill-red" : "pill-green"}`}>{r.flaggedCount}</span>
              </td>
              <td style={{ textAlign: "right" }}>
                <Link className="btn btn-sm" href={`/group/regions/${encodeURIComponent(r.region)}`}>
                  Open →
                </Link>
              </td>
            </tr>
          ))}
          {data.regions.length === 0 && (
            <tr>
              <td colSpan={6} className="subtitle">
                No businesses yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="grid grid-2">
        <div className="card">
          <h3>
            Needs attention
            <InfoTip text={tooltips["needs-attention"]} />
          </h3>
          <p className="card-sub">Branches scoring meaningfully below their own region&apos;s average.</p>
          <table className="clean">
            <tbody>
              {data.needsAttention.map((o) => (
                <tr key={o.businessId} style={{ cursor: "pointer" }}>
                  <td>
                    <Link href={`/group/branches/${o.businessId}`}>{o.name}</Link>
                  </td>
                  <td>{o.starAverage}/5</td>
                  <td style={{ color: "var(--text-3)" }}>{o.sigmaBelowRegion}σ below region</td>
                </tr>
              ))}
              {data.needsAttention.length === 0 && (
                <tr>
                  <td className="subtitle">No outliers right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Top performers</h3>
          <table className="clean">
            <tbody>
              {data.topPerformers.map((t) => (
                <tr key={t.businessId}>
                  <td>
                    <Link href={`/group/branches/${t.businessId}`}>{t.name}</Link>
                  </td>
                  <td>{t.starAverage}/5</td>
                  <td>{t.responseCount} responses</td>
                </tr>
              ))}
              {data.topPerformers.length === 0 && (
                <tr>
                  <td className="subtitle">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

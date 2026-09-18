"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PeriodComparisonCards, type Comparisons } from "@/components/period-comparison-cards";
import { InfoTip } from "@/components/info-tip";

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
interface OverviewData {
  branchCount: number;
  networkAverage: number | null;
  networkNps: number | null;
  cxPulseLevel: number | null;
  comparisons: Comparisons;
  regions: RegionRow[];
  needsAttention: OutlierRow[];
  topPerformers: TopRow[];
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];

export default function GroupOverviewClient({ tooltips }: { tooltips: Record<string, string> }) {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jump, setJump] = useState("");
  const [jumpResults, setJumpResults] = useState<{ businessId: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/group/overview")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
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

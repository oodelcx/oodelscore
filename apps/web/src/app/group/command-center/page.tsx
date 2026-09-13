"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./command-center.css";

interface BranchTile {
  businessId: string;
  name: string;
  region: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  starDelta: number | null;
  band: "green" | "amber" | "red" | null;
  openActionItems: number;
  overdueActionItems: number;
}
interface CategoryRow {
  categoryId: string;
  name: string;
  byBusiness: Record<string, { average: number; band: string | null }>;
}
interface FeedEntry {
  kind: string;
  severity: "crit" | "high" | "med";
  title: string;
  meta: string;
  businessName: string | null;
  at: string;
}
interface Sparkline {
  businessId: string;
  name: string;
  days: number[];
}
interface CommandCenterData {
  orgName: string;
  branchTiles: BranchTile[];
  categoryMatrix: CategoryRow[];
  feed: FeedEntry[];
  cxPulse: { compositeScore: number; level: number } | null;
  billing: { isComp: boolean; status: string; mrrValue: number; nextPaymentDate: string | null } | null;
  movers: BranchTile[];
  sparklines: Sparkline[];
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

/** Drops a shared org-name prefix ("Meridian Bank – Downtown" → "Downtown")
 * so matrix column headers stay narrow — full name is still in the title
 * attribute for a hover tooltip. */
function shortBranchLabel(name: string): string {
  const parts = name.split(/[–-]/).map((p) => p.trim());
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function sparkPoints(days: number[], w: number, h: number): string {
  const max = Math.max(1, ...days);
  const step = w / Math.max(1, days.length - 1);
  return days.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
}

export default function CommandCenterPage() {
  const router = useRouter();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  function goToBranch(businessId: string) {
    router.push(`/group/branches/${businessId}`);
  }
  function businessIdByName(name: string): string | null {
    return data?.branchTiles.find((b) => b.name === name)?.businessId ?? null;
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/group/command-center")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        return d as CommandCenterData;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;

  const branchCount = data.branchTiles.length;
  const firingAlerts = data.feed.filter((f) => f.kind === "alert").length;
  const tickerItems = [...data.branchTiles, ...data.branchTiles];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Command Center</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            One operating picture across every branch — health, alerts, categories, and billing at a glance.
          </p>
        </div>
      </div>

      <div className="cc-root">
        <div className="cc-ticker">
          <div className="cc-ticker-track">
            {tickerItems.map((b, i) => (
              <span className="cc-ticker-item" key={`${b.businessId}-${i}`}>
                <b className={`cc-band-${b.band ?? "amber"}`}>{b.name}</b>
                <span>★ {b.starAverage?.toFixed(1) ?? "—"}</span>
                <span>NPS {b.npsScore ?? "—"}</span>
                {b.starDelta !== null && (
                  <span className={b.starDelta >= 0 ? "cc-band-green" : "cc-band-red"}>
                    {b.starDelta >= 0 ? "▲" : "▼"} {Math.abs(b.starDelta).toFixed(2)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="cc-topbar">
          <div className="cc-brand">
            {data.orgName.split(" ")[0].toUpperCase()}
            <span>·{data.orgName.split(" ").slice(1).join(" ").toUpperCase()}</span>
          </div>
          <div className="cc-clock">{now.toUTCString().slice(0, 22)} UTC</div>
          <div className="cc-chip-row">
            <div className="cc-chip live">● LIVE</div>
            <div className="cc-chip">{branchCount} BRANCHES</div>
            {firingAlerts > 0 && <div className="cc-chip alert">{firingAlerts} ALERTS FIRING</div>}
          </div>
        </div>

        {branchCount === 0 ? (
          <div className="cc-empty">No branches under this organization yet.</div>
        ) : (
          <div className="cc-grid">
            <div className="cc-card">
              <div className="cc-card-head">
                <div className="cc-card-title">Branch Health · 30d</div>
                <div className="cc-card-sub">★ AVG · NPS · WoW TREND</div>
              </div>
              <div className="cc-branch-grid">
                {data.branchTiles.map((b) => (
                  <div
                    key={b.businessId}
                    className={`cc-branch-tile cc-clickable ${b.band ?? "amber"}`}
                    onClick={() => goToBranch(b.businessId)}
                  >
                    <div className="cc-branch-name">{b.name}</div>
                    <div className="cc-branch-region">{b.region ? b.region.toUpperCase() : "—"}</div>
                    <div className="cc-branch-metrics">
                      <div>
                        <span className="cc-bm-label">Stars</span>
                        <span className={`cc-bm cc-band-${b.band ?? "amber"}`}>{b.starAverage?.toFixed(1) ?? "—"}</span>
                      </div>
                      <div>
                        <span className="cc-bm-label">NPS</span>
                        <span className={`cc-bm cc-band-${b.band ?? "amber"}`}>{b.npsScore ?? "—"}</span>
                      </div>
                    </div>
                    <div className="cc-branch-foot">
                      <span>{b.responseCount} resp / 30d</span>
                      {b.starDelta !== null && (
                        <span className={b.starDelta >= 0 ? "cc-band-green" : "cc-band-red"}>
                          {b.starDelta >= 0 ? "▲" : "▼"} {Math.abs(b.starDelta).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {data.categoryMatrix.length > 0 && (
                <>
                  <div className="cc-card-head" style={{ marginTop: 16 }}>
                    <div className="cc-card-title">Category Matrix · Score /5</div>
                    <div className="cc-card-sub">RAG set per org — Admin → Command Center tab</div>
                  </div>
                  <div className="cc-table-scroll">
                  <table className="cc-matrix">
                    <thead>
                      <tr>
                        <th>Category</th>
                        {data.branchTiles.map((b) => (
                          <th
                            className="num cc-clickable"
                            key={b.businessId}
                            title={b.name}
                            onClick={() => goToBranch(b.businessId)}
                          >
                            {shortBranchLabel(b.name)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.categoryMatrix.map((row) => (
                        <tr key={row.categoryId}>
                          <td>{row.name}</td>
                          {data.branchTiles.map((b) => {
                            const cell = row.byBusiness[b.businessId];
                            return (
                              <td className="num cc-clickable" key={b.businessId} onClick={() => goToBranch(b.businessId)}>
                                {cell ? <span className={`cc-cell ${cell.band ?? "amber"}`}>{cell.average.toFixed(1)}</span> : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="cc-matrix-extra">
                        <td>Open action items</td>
                        {data.branchTiles.map((b) => (
                          <td className="num cc-clickable" key={b.businessId} onClick={() => router.push("/group/action-board")}>
                            {b.openActionItems}
                          </td>
                        ))}
                      </tr>
                      <tr className="cc-matrix-extra">
                        <td>Overdue action items</td>
                        {data.branchTiles.map((b) => (
                          <td className="num cc-clickable" key={b.businessId} onClick={() => router.push("/group/action-board")}>
                            {b.overdueActionItems}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>

            <div className="cc-card">
              <div className="cc-card-head">
                <div className="cc-card-title">Live Alert &amp; Action Feed</div>
                <div className="cc-card-sub">{data.feed.length} RECENT</div>
              </div>
              <div className="cc-feed">
                {data.feed.length === 0 && <p className="cc-card-sub">Nothing yet — this fills in as feedback comes in.</p>}
                {data.feed.map((f, i) => {
                  const targetId = f.businessName ? businessIdByName(f.businessName) : null;
                  return (
                  <div
                    className={`cc-feed-row${targetId ? " cc-clickable" : ""}`}
                    key={i}
                    onClick={targetId ? () => goToBranch(targetId) : undefined}
                  >
                    <div className={`cc-sev ${f.severity}`}></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="cc-feed-title">{f.title}</div>
                      <div className="cc-feed-meta">
                        {f.kind.replace(/_/g, " ")} · {f.meta}
                      </div>
                    </div>
                    <div className="cc-feed-time">{timeAgo(f.at)}</div>
                  </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="cc-card" style={{ marginBottom: 12 }}>
                <div className="cc-card-head">
                  <div className="cc-card-title">CX Pulse · Org</div>
                </div>
                {data.cxPulse ? (
                  <div className="cc-gauge-wrap cc-clickable" onClick={() => router.push("/group/maturity")}>
                    <svg width="60" height="60" viewBox="0 0 70 70">
                      <circle cx="35" cy="35" r="30" fill="none" stroke="#232b38" strokeWidth="7" />
                      <circle
                        cx="35"
                        cy="35"
                        r="30"
                        fill="none"
                        stroke="#33d17a"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray="188.5"
                        strokeDashoffset={188.5 - (188.5 * data.cxPulse.compositeScore) / 100}
                        transform="rotate(-90 35 35)"
                      />
                    </svg>
                    <div>
                      <div className="cc-gauge-num">{data.cxPulse.compositeScore}</div>
                      <div className="cc-gauge-level">Level {data.cxPulse.level}</div>
                    </div>
                  </div>
                ) : (
                  <p className="cc-card-sub">Not computed yet — runs on the nightly job.</p>
                )}
                {data.billing && (
                  <div className="cc-clickable" onClick={() => router.push("/group/billing")}>
                    <div className="cc-mini-row">
                      <span>Billing</span>
                      <b>{data.billing.isComp ? "Comp" : data.billing.status}</b>
                    </div>
                    <div className="cc-mini-row">
                      <span>Group MRR</span>
                      <b>${data.billing.mrrValue.toFixed(2)}</b>
                    </div>
                    {data.billing.nextPaymentDate && (
                      <div className="cc-mini-row">
                        <span>Next invoice</span>
                        <b>{new Date(data.billing.nextPaymentDate).toLocaleDateString()}</b>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="cc-card" style={{ marginBottom: 12 }}>
                <div className="cc-card-head">
                  <div className="cc-card-title">Movers · Week over Week</div>
                </div>
                {data.movers.length === 0 && <p className="cc-card-sub">Not enough data yet.</p>}
                {data.movers.map((m) => (
                  <div className="cc-mover-row cc-clickable" key={m.businessId} onClick={() => goToBranch(m.businessId)}>
                    <span>{m.name}</span>
                    <span className={`cc-mover-delta ${(m.starDelta ?? 0) >= 0 ? "up" : "down"}`}>
                      {(m.starDelta ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(m.starDelta ?? 0).toFixed(2)}★
                    </span>
                  </div>
                ))}
              </div>

              <div className="cc-card">
                <div className="cc-card-head">
                  <div className="cc-card-title">Response Volume · 7d</div>
                </div>
                {data.sparklines.map((s) => (
                  <div className="cc-spark-row cc-clickable" key={s.businessId} onClick={() => goToBranch(s.businessId)}>
                    <span className="cc-spark-name">{s.name}</span>
                    <svg width="80" height="22" viewBox="0 0 80 22">
                      <polyline points={sparkPoints(s.days, 80, 20)} fill="none" stroke="#33d17a" strokeWidth="1.6" />
                    </svg>
                    <span className="cc-spark-count">{s.days.reduce((a, b) => a + b, 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="cc-footnote">
          Red/amber/green bands and whether this page is shown at all are set by OodelCX Admin on this organization&rsquo;s
          account page.
        </div>
      </div>
    </div>
  );
}

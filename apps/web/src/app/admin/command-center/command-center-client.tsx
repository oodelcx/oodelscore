"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoTip } from "@/components/info-tip";
import { useTooltips } from "@/lib/useTooltips";
import "./command-center.css";

interface ClientTile {
  clientId: string;
  ownerType: "business" | "parentOrg";
  businessId: string;
  name: string;
  kind: string;
  product: "customer_experience" | "colleague_experience";
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  starDelta: number | null;
  band: "green" | "amber" | "red" | null;
  openActionItems: number;
  overdueActionItems: number;
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
  clientId: string;
  name: string;
  days: number[];
}
interface PortfolioSignal {
  ownerType: "business" | "parentOrg";
  ownerId: string;
  name: string;
  level: number;
  signal: "at_risk" | "expansion_ready";
}
interface CommandCenterData {
  clientTiles: ClientTile[];
  cxPulseDistribution: Record<string, number>;
  cxPulse: { compositeScore: number; level: number };
  portfolioSignals: PortfolioSignal[];
  billing: { platformMrr: number; overdueCount: number; compCount: number; totalAccounts: number };
  feed: FeedEntry[];
  movers: ClientTile[];
  sparklines: Sparkline[];
}

type CcTheme = "light" | "dark";
const CC_THEME_KEY = "cc-theme";

const LEVEL_LABELS: Record<string, string> = {
  "1": "Collecting",
  "2": "Reacting",
  "3": "Responding",
  "4": "Improving",
  "5": "Embedded",
};

function npsLabelFor(product: ClientTile["product"]): string {
  return product === "colleague_experience" ? "eNPS" : "NPS";
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

function sparkPoints(days: number[], w: number, h: number): string {
  const max = Math.max(1, ...days);
  const step = w / Math.max(1, days.length - 1);
  return days.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
}

export default function AdminCommandCenterClient() {
  const tooltips = useTooltips("admin-command-center");
  const router = useRouter();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [theme, setTheme] = useState<CcTheme>("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CC_THEME_KEY);
      if (stored === "dark" || stored === "light") setTheme(stored);
    } catch {
      // localStorage unavailable (e.g. private browsing) — keep default light
    }
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next: CcTheme = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(CC_THEME_KEY, next);
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  }

  function goToClient(tile: ClientTile) {
    router.push(
      tile.ownerType === "business"
        ? `/admin/businesses/${tile.businessId}?tab=performance`
        : `/admin/parent-orgs/${tile.businessId}?tab=performance`
    );
  }
  function clientByName(name: string): ClientTile | null {
    return data?.clientTiles.find((t) => t.name === name) ?? null;
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/admin/command-center")
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

  const clientCount = data.clientTiles.length;
  const firingAlerts = data.feed.filter((f) => f.kind === "alert" || f.kind === "billing" || f.kind === "billing_overdue").length;
  const tickerItems = [...data.clientTiles, ...data.clientTiles];
  const signalByOwnerId = new Map(data.portfolioSignals.map((s) => [s.ownerId, s]));
  const totalOpenActions = data.clientTiles.reduce((sum, t) => sum + t.openActionItems, 0);
  const totalOverdueActions = data.clientTiles.reduce((sum, t) => sum + t.overdueActionItems, 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Command Center</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            One operating picture across every client on the platform — health, alerts, CX Pulse maturity, and billing at a glance.
          </p>
        </div>
      </div>

      <div className="cc-root" data-theme={theme === "dark" ? "dark" : undefined}>
        <div className="cc-ticker">
          <div className="cc-ticker-track">
            {tickerItems.map((t, i) => (
              <span className="cc-ticker-item" key={`${t.clientId}-${i}`}>
                <b className={`cc-band-${t.band ?? "amber"}`}>{t.name}</b>
                <span>★ {t.starAverage?.toFixed(1) ?? "—"}</span>
                <span>{npsLabelFor(t.product)} {t.npsScore ?? "—"}</span>
                {t.starDelta !== null && (
                  <span className={t.starDelta >= 0 ? "cc-band-green" : "cc-band-red"}>
                    {t.starDelta >= 0 ? "▲" : "▼"} {Math.abs(t.starDelta).toFixed(2)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="cc-topbar">
          <div className="cc-brand">
            OODELCX
            <span>· ADMIN COMMAND CENTER</span>
          </div>
          <div className="cc-clock">{now.toUTCString().slice(0, 22)} UTC</div>
          <div className="cc-chip-row">
            <div className="cc-chip live">● LIVE</div>
            <div className="cc-chip">{clientCount} CLIENTS</div>
            {firingAlerts > 0 && <div className="cc-chip alert">{firingAlerts} ALERTS FIRING</div>}
            <button
              type="button"
              className="cc-chip"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? "☾ DARK" : "☀ LIGHT"}
            </button>
          </div>
        </div>

        {clientCount === 0 ? (
          <div className="cc-empty">No businesses or parent orgs on the platform yet.</div>
        ) : (
          <div className="cc-grid">
            <div className="cc-card">
              <div className="cc-card-head">
                <div className="cc-card-title">
                  Client Health · 30d <InfoTip text={tooltips["health-band"]} />
                </div>
                <div className="cc-card-sub">
                  ★ AVG <InfoTip text={tooltips["star-average"]} /> · NPS <InfoTip text={tooltips["nps"]} /> · RESP{" "}
                  <InfoTip text={tooltips["response-count"]} /> · WoW TREND <InfoTip text={tooltips["star-delta"]} />
                </div>
              </div>
              <div className="cc-mini-row">
                <span>
                  Open actions <InfoTip text={tooltips["open-actions"]} />
                </span>
                <b>{totalOpenActions}</b>
              </div>
              <div className="cc-mini-row">
                <span>
                  Overdue actions <InfoTip text={tooltips["overdue-actions"]} />
                </span>
                <b>{totalOverdueActions}</b>
              </div>
              <div className="cc-branch-grid">
                {data.clientTiles.map((t) => {
                  const signal = signalByOwnerId.get(t.businessId);
                  return (
                    <div
                      key={t.clientId}
                      className={`cc-branch-tile cc-clickable ${t.band ?? "amber"}`}
                      onClick={() => goToClient(t)}
                    >
                      <div className="cc-branch-name">{t.name}</div>
                      <div className="cc-branch-region">
                        {t.kind.toUpperCase()}
                        {signal &&
                          (signal.signal === "at_risk" ? (
                            <>
                              {" "}
                              · AT RISK <InfoTip text={tooltips["portfolio-at-risk"]} />
                            </>
                          ) : (
                            <>
                              {" "}
                              · EXPANSION READY <InfoTip text={tooltips["portfolio-expansion-ready"]} />
                            </>
                          ))}
                      </div>
                      <div className="cc-branch-metrics">
                        <div>
                          <span className="cc-bm-label">Stars</span>
                          <span className={`cc-bm cc-band-${t.band ?? "amber"}`}>{t.starAverage?.toFixed(1) ?? "—"}</span>
                        </div>
                        <div>
                          <span className="cc-bm-label">{npsLabelFor(t.product)}</span>
                          <span className={`cc-bm cc-band-${t.band ?? "amber"}`}>{t.npsScore ?? "—"}</span>
                        </div>
                      </div>
                      <div className="cc-branch-foot">
                        <span>{t.responseCount} resp / 30d</span>
                        {t.starDelta !== null && (
                          <span className={t.starDelta >= 0 ? "cc-band-green" : "cc-band-red"}>
                            {t.starDelta >= 0 ? "▲" : "▼"} {Math.abs(t.starDelta).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cc-card-head" style={{ marginTop: 16 }}>
                <div className="cc-card-title">
                  CX Pulse Maturity · Portfolio <InfoTip text={tooltips["cx-pulse-maturity"]} />
                </div>
                <div className="cc-card-sub">CLIENTS PER LEVEL, LATEST SCORE</div>
              </div>
              <div className="cc-table-scroll">
                <table className="cc-matrix">
                  <thead>
                    <tr>
                      <th>Level</th>
                      {(["1", "2", "3", "4", "5"] as const).map((lvl) => (
                        <th className="num" key={lvl}>
                          {lvl} · {LEVEL_LABELS[lvl]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Clients</td>
                      {(["1", "2", "3", "4", "5"] as const).map((lvl) => (
                        <td className="num" key={lvl}>
                          <span className={`cc-cell ${lvl === "1" || lvl === "2" ? "red" : lvl === "3" ? "amber" : "green"}`}>
                            {data.cxPulseDistribution[lvl] ?? 0}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cc-card">
              <div className="cc-card-head">
                <div className="cc-card-title">
                  Live Platform Feed <InfoTip text={tooltips["live-feed"]} />
                </div>
                <div className="cc-card-sub">{data.feed.length} RECENT</div>
              </div>
              <div className="cc-feed">
                {data.feed.length === 0 && <p className="cc-card-sub">Nothing yet — this fills in as feedback comes in.</p>}
                {data.feed.map((f, i) => {
                  const target = f.businessName ? clientByName(f.businessName) : null;
                  return (
                    <div
                      className={`cc-feed-row${target ? " cc-clickable" : ""}`}
                      key={i}
                      onClick={target ? () => goToClient(target) : undefined}
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
                  <div className="cc-card-title">
                    CX Pulse · Platform <InfoTip text={tooltips["cx-pulse-composite"]} />
                  </div>
                </div>
                <div className="cc-gauge-wrap">
                  <svg width="60" height="60" viewBox="0 0 70 70">
                    <circle cx="35" cy="35" r="30" fill="none" stroke="var(--cc-border)" strokeWidth="7" />
                    <circle
                      cx="35"
                      cy="35"
                      r="30"
                      fill="none"
                      stroke="var(--cc-green)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray="188.5"
                      strokeDashoffset={188.5 - (188.5 * data.cxPulse.compositeScore) / 100}
                      transform="rotate(-90 35 35)"
                    />
                  </svg>
                  <div>
                    <div className="cc-gauge-num">{data.cxPulse.compositeScore}</div>
                    <div className="cc-gauge-level">
                      Level {data.cxPulse.level} · {LEVEL_LABELS[String(data.cxPulse.level)]}
                    </div>
                  </div>
                </div>

                <div className="cc-clickable" onClick={() => router.push("/admin/billing")}>
                  <div className="cc-mini-row">
                    <span>
                      Platform MRR <InfoTip text={tooltips["billing-mrr"]} />
                    </span>
                    <b>${data.billing.platformMrr.toFixed(2)}</b>
                  </div>
                  <div className="cc-mini-row">
                    <span>
                      Comp accounts <InfoTip text={tooltips["billing-comp"]} />
                    </span>
                    <b>{data.billing.compCount}</b>
                  </div>
                  <div className="cc-mini-row">
                    <span>
                      Overdue accounts <InfoTip text={tooltips["billing-overdue"]} />
                    </span>
                    <b>{data.billing.overdueCount}</b>
                  </div>
                </div>
              </div>

              <div className="cc-card" style={{ marginBottom: 12 }}>
                <div className="cc-card-head">
                  <div className="cc-card-title">
                    Movers · Week over Week <InfoTip text={tooltips["movers"]} />
                  </div>
                </div>
                {data.movers.length === 0 && <p className="cc-card-sub">Not enough data yet.</p>}
                {data.movers.map((m) => (
                  <div className="cc-mover-row cc-clickable" key={m.clientId} onClick={() => goToClient(m)}>
                    <span>{m.name}</span>
                    <span className={`cc-mover-delta ${(m.starDelta ?? 0) >= 0 ? "up" : "down"}`}>
                      {(m.starDelta ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(m.starDelta ?? 0).toFixed(2)}★
                    </span>
                  </div>
                ))}
              </div>

              <div className="cc-card">
                <div className="cc-card-head">
                  <div className="cc-card-title">
                    Response Volume · 7d <InfoTip text={tooltips["sparkline"]} />
                  </div>
                </div>
                {data.sparklines.map((s) => (
                  <div className="cc-spark-row cc-clickable" key={s.clientId} onClick={() => goToClient(data.clientTiles.find((t) => t.clientId === s.clientId)!)}>
                    <span className="cc-spark-name">{s.name}</span>
                    <svg width="80" height="22" viewBox="0 0 80 22">
                      <polyline points={sparkPoints(s.days, 80, 20)} fill="none" stroke="var(--cc-green)" strokeWidth="1.6" />
                    </svg>
                    <span className="cc-spark-count">{s.days.reduce((a, b) => a + b, 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

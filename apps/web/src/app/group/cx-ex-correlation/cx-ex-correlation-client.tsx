"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DetailDrawer } from "@/components/detail-drawer";

type Quadrant = "both_low" | "staff_low" | "customer_low" | "both_ok";
interface Row {
  businessId: string;
  name: string;
  region: string | null;
  cxStarAverage: number | null;
  cxResponseCount: number;
  ceEnps: number | null;
  ceResponseCount: number;
  ceBelowAnonymityFloor: boolean;
  atRiskOnBoth: boolean;
  quadrant: Quadrant | null;
  residualSigma: number | null;
  topLink: { staffLabel: string; customerLabel: string } | null;
  linkCount: number;
}
interface Weekly { weekStart: string; customer: number | null; staff: number | null }
interface Network {
  correlation: { n: number; r: number | null; rho: number | null; ci: [number, number] | null; strength: string; direction: string; confidence: "reasonable" | "directional" | "insufficient"; distinguishableFromZero: boolean };
  regression: { slope: number; intercept: number } | null;
  quadrants: Record<Quadrant, number>;
  lag: { bestLagWeeks: number; r: number; pairs: number; staffLeads: boolean } | null;
  weekly: Weekly[];
  staffSuppressedBranches: number;
}
interface Link { staffLabel: string; customerLabel: string; staffNegative: number; customerNegative: number; reason: string; nextStep: string }
interface Detail {
  row: Row;
  quadrantCopy: { label: string; meaning: string };
  headline: string;
  rank: { customer: { position: number; of: number } | null; staff: { position: number; of: number } | null };
  weekly: Weekly[];
  customerThemes: { theme: string; frequency: number; negative: number; quote: string | null }[];
  staffThemes: { theme: string; frequency: number; negative: number }[] | null;
  staffSuppressedReason: string | null;
  links: Link[];
  openCases: number;
}

const Q: Record<Quadrant, { label: string; color: string; pill: string }> = {
  both_low: { label: "Struggling on both", color: "#c0392b", pill: "pill-red" },
  staff_low: { label: "Staff unhappy, customers fine", color: "#b7791f", pill: "pill-amber" },
  customer_low: { label: "Customers unhappy, staff fine", color: "#2b6cb0", pill: "pill-blue" },
  both_ok: { label: "Healthy on both", color: "#0b7a55", pill: "pill-green" },
};
const FILTERS: (Quadrant | "all")[] = ["all", "both_low", "staff_low", "customer_low", "both_ok"];
const CONF_TEXT = { reasonable: "Reasonable sample", directional: "Directional only", insufficient: "Too few branches to be reliable" } as const;

function Scatter({ rows, network, onPick, active }: { rows: Row[]; network: Network; onPick: (id: string) => void; active: string | null }) {
  const pts = rows.filter((r) => r.cxStarAverage !== null && r.ceEnps !== null);
  const W = 720, H = 380, L = 50, R = 16, T = 16, B = 44;
  const xMin = Math.min(-40, ...pts.map((p) => p.ceEnps as number)) - 5;
  const xMax = Math.max(40, ...pts.map((p) => p.ceEnps as number)) + 5;
  const yMin = Math.min(2.5, ...pts.map((p) => p.cxStarAverage as number)) - 0.1;
  const yMax = 5;
  const x = (v: number) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const x0 = x(0), y35 = y(3.5);
  const reg = network.regression;
  const regLine = reg ? [xMin, xMax].map((v) => `${x(v).toFixed(1)},${y(Math.max(yMin, Math.min(yMax, reg.intercept + reg.slope * v))).toFixed(1)}`).join(" ") : null;
  const yTicks = [3, 3.5, 4, 4.5, 5].filter((t) => t >= yMin);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Branches plotted by staff eNPS and customer rating" style={{ width: "100%", height: "auto" }}>
      <rect x={L} y={T} width={x0 - L} height={y35 - T} fill="#b7791f" opacity={0.07} />
      <rect x={x0} y={T} width={W - R - x0} height={y35 - T} fill="#0b7a55" opacity={0.07} />
      <rect x={L} y={y35} width={x0 - L} height={H - B - y35} fill="#c0392b" opacity={0.08} />
      <rect x={x0} y={y35} width={W - R - x0} height={H - B - y35} fill="#2b6cb0" opacity={0.07} />
      <text x={L + 8} y={T + 16} fontSize="11.5" fontWeight="600" fill="#b7791f">Staff unhappy, customers fine</text>
      <text x={W - R - 8} y={T + 16} fontSize="11.5" fontWeight="600" fill="#0b7a55" textAnchor="end">Healthy on both</text>
      <text x={L + 8} y={H - B - 8} fontSize="11.5" fontWeight="600" fill="#c0392b">Struggling on both</text>
      <text x={W - R - 8} y={H - B - 8} fontSize="11.5" fontWeight="600" fill="#2b6cb0" textAnchor="end">Customers unhappy, staff fine</text>
      {yTicks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" opacity={t === 3.5 ? 0.45 : 0.1} strokeDasharray={t === 3.5 ? "4 3" : undefined} /><text x={L - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="currentColor" opacity={0.6}>{t}</text></g>))}
      {[-50, 0, 50].filter((t) => t > xMin && t < xMax).map((t) => (<g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke="currentColor" opacity={t === 0 ? 0.45 : 0.1} strokeDasharray={t === 0 ? "4 3" : undefined} /><text x={x(t)} y={H - B + 16} fontSize="11" textAnchor="middle" fill="currentColor" opacity={0.6}>{t > 0 ? `+${t}` : t}</text></g>))}
      {regLine && <polyline points={regLine} fill="none" stroke="currentColor" opacity={0.4} strokeWidth="1.5" strokeDasharray="2 4" />}
      {pts.map((p) => {
        const c = p.quadrant ? Q[p.quadrant].color : "#888";
        const isActive = active === p.businessId;
        return (
          <g key={p.businessId} onClick={() => onPick(p.businessId)} style={{ cursor: "pointer" }} role="button" aria-label={`${p.name}: ${p.cxStarAverage}/5, eNPS ${p.ceEnps}`}>
            <circle cx={x(p.ceEnps as number)} cy={y(p.cxStarAverage as number)} r={isActive ? 9 : 6.5} fill={c} fillOpacity={0.85} stroke="#fff" strokeWidth="1.5" />
            <title>{`${p.name}\nCustomers ${p.cxStarAverage}/5 · Staff eNPS ${p.ceEnps}`}</title>
          </g>
        );
      })}
      <text x={(L + W - R) / 2} y={H - 6} fontSize="12" textAnchor="middle" fill="currentColor" opacity={0.7}>Staff eNPS (higher is happier staff) →</text>
      <text transform={`translate(13 ${(T + H - B) / 2}) rotate(-90)`} fontSize="12" textAnchor="middle" fill="currentColor" opacity={0.7}>Customer rating (stars) →</text>
    </svg>
  );
}

function WeeklyChart({ weekly }: { weekly: Weekly[] }) {
  const pts = weekly.filter((w) => w.customer !== null || w.staff !== null);
  if (pts.length < 3) return <p className="esc-muted">Not enough weekly data to chart a trend.</p>;
  const W = 520, H = 190, L = 34, R = 36, T = 10, B = 24;
  const x = (i: number) => L + (i * (W - L - R)) / (weekly.length - 1);
  const yc = (v: number) => T + ((5 - v) / 4) * (H - T - B);
  const ys = (v: number) => T + ((100 - v) / 200) * (H - T - B);
  const path = (get: (w: Weekly) => number | null, f: (v: number) => number) => {
    let d = "";
    weekly.forEach((w, i) => { const v = get(w); if (v === null) return; d += `${d ? "L" : "M"}${x(i).toFixed(1)},${f(v).toFixed(1)} `; });
    return d;
  };
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly customer rating and staff eNPS" style={{ width: "100%", height: "auto" }}>
        {[1, 3, 5].map((v) => (<g key={v}><line x1={L} x2={W - R} y1={yc(v)} y2={yc(v)} stroke="currentColor" opacity={0.1} /><text x={L - 6} y={yc(v) + 4} fontSize="10.5" textAnchor="end" fill="#0b7a55">{v}★</text></g>))}
        {[-100, 0, 100].map((v) => (<text key={v} x={W - R + 6} y={ys(v) + 4} fontSize="10.5" fill="#b7791f">{v}</text>))}
        <path d={path((w) => w.customer, yc)} fill="none" stroke="#0b7a55" strokeWidth="2.5" />
        <path d={path((w) => w.staff, ys)} fill="none" stroke="#b7791f" strokeWidth="2.5" strokeDasharray="5 3" />
        {weekly.map((w, i) => (i % 3 === 0 || i === weekly.length - 1 ? <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.55}>{new Date(w.weekStart).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</text> : null))}
      </svg>
      <div className="esc-muted" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><b style={{ color: "#0b7a55" }}>━</b> Customer rating (left)</span>
        <span><b style={{ color: "#b7791f" }}>┅</b> Staff eNPS (right). Weeks with fewer than 5 staff responses are blank.</span>
      </div>
    </div>
  );
}

export default function GroupCxExCorrelationClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [network, setNetwork] = useState<Network | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Quadrant | "all">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/group/cx-ex-correlation")
      .then((r) => r.json())
      .then((d) => { if (d.status !== "ok") { setError(d.message ?? "Unable to load."); return; } setRows(d.rows); setNetwork(d.network); })
      .catch(() => setError("Unable to load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    setDetail(null); setDetailError(null);
    fetch(`/api/group/cx-ex-correlation/${openId}`).then((r) => r.json()).then((d) => { if (d.status === "ok") setDetail(d.detail); else setDetailError(d.message ?? "Could not load this branch."); }).catch(() => setDetailError("Could not load this branch."));
  }, [openId]);

  const shown = useMemo(() => rows.filter((r) => (filter === "all" || r.quadrant === filter) && (!search.trim() || r.name.toLowerCase().includes(search.toLowerCase()) || (r.region ?? "").toLowerCase().includes(search.toLowerCase()))), [rows, filter, search]);

  const c = network?.correlation;
  const verdict = !c || c.r === null
    ? "Not enough branches with both customer and staff data to measure a link yet."
    : c.strength === "none"
      ? `Across ${c.n} branches, customer ratings and staff eNPS show no clear link (r = ${c.r.toFixed(2)}). Look at each branch's own story rather than a network pattern.`
      : `Across ${c.n} branches, customer ratings and staff eNPS move ${c.strength === "strong" ? "strongly" : c.strength === "moderate" ? "moderately" : "weakly"} ${c.direction === "positive" ? "together" : "in opposite directions"} (r = ${c.r.toFixed(2)}${c.ci ? `, 95% range ${c.ci[0].toFixed(2)} to ${c.ci[1].toFixed(2)}` : ""}).`;

  return (
    <div className="esc" style={{ maxWidth: 1180 }}>
      <div className="page-head">
        <h1>Customer ↔ Staff story</h1>
        <p className="subtitle">Every branch, both signals. Find branches where unhappy customers and unhappy staff meet, and see what each side is saying.</p>
      </div>
      {error && <div className="callout callout-amber">{error}</div>}
      {loading && <p className="subtitle">Loading…</p>}

      {network && (
        <>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 520px" }}>
                <h3>What the numbers say</h3>
                <p style={{ margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.5 }}>{verdict}</p>
                {c && c.r !== null && !c.distinguishableFromZero && c.n >= 4 && <p className="card-sub" style={{ margin: "6px 0 0" }}>The range includes zero, so this could be chance with so few branches.</p>}
                {network.lag?.staffLeads && <p className="card-sub" style={{ margin: "6px 0 0" }}>Over the last 16 weeks, staff scores tended to move about {network.lag.bestLagWeeks} week{network.lag.bestLagWeeks === 1 ? "" : "s"} before customer scores did (r = {network.lag.r.toFixed(2)} on {network.lag.pairs} weeks). Treat as an early-warning signal, not proof.</p>}
              </div>
              {c && <span className={`pill ${c.confidence === "reasonable" ? "pill-green" : c.confidence === "directional" ? "pill-amber" : "pill-gray"}`}>{CONF_TEXT[c.confidence]} · {c.n} branches</span>}
            </div>
            <p className="card-sub" style={{ margin: "10px 0 0" }}>A link between two scores shows they move together. It does not prove one causes the other. Staff numbers are only shown for branches with five or more responses.</p>
          </div>

          <div className="grid grid-4">
            {(["both_low", "staff_low", "customer_low", "both_ok"] as Quadrant[]).map((q) => (
              <div key={q} className="card" role="button" tabIndex={0} onClick={() => setFilter(filter === q ? "all" : q)} onKeyDown={(e) => { if (e.key === "Enter") setFilter(filter === q ? "all" : q); }} style={{ cursor: "pointer", outline: filter === q ? `2px solid ${Q[q].color}` : undefined }}>
                <div className="metric-label">{Q[q].label.toUpperCase()}</div>
                <div className="metric-val" style={{ color: Q[q].color }}>{network.quadrants[q]}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Where every branch sits</h3>
            <p className="card-sub">Each dot is a branch (click one for its story). The dotted line is the network trend. Dashed lines mark the at-risk thresholds: 3.5 stars and eNPS 0.</p>
            <Scatter rows={rows} network={network} onPick={setOpenId} active={openId} />
            {network.staffSuppressedBranches > 0 && <p className="esc-muted">{network.staffSuppressedBranches} branch{network.staffSuppressedBranches === 1 ? " is" : "es are"} not plotted because fewer than five staff have responded (anonymity floor). They stay in the list below.</p>}
          </div>

          <div className="card">
            <div className="esc-head-row">
              <div><h3>Branches</h3><p className="card-sub">Worst on both first. Click a row for the full story.</p></div>
              <div className="esc-actions">
                {FILTERS.map((f) => (<button key={f} className={`chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "All" : Q[f].label}</button>))}
                <input className="esc-search" type="search" aria-label="Search branches" placeholder="Search branch or region" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="esc-list">
              <div className="esc-row esc-th" style={{ gridTemplateColumns: "minmax(180px,1.6fr) 130px 130px minmax(160px,1.2fr) minmax(0,1.6fr)" }}><span>Branch</span><span>Customers</span><span>Staff eNPS</span><span>Status</span><span>What links them</span></div>
              {shown.map((r) => (
                <div key={r.businessId} className="esc-row" style={{ gridTemplateColumns: "minmax(180px,1.6fr) 130px 130px minmax(160px,1.2fr) minmax(0,1.6fr)", cursor: "pointer" }} onClick={() => setOpenId(r.businessId)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(r.businessId); }}>
                  <div className="esc-main"><strong>{r.name}</strong><span>{r.region ?? "—"}</span></div>
                  <div>{r.cxStarAverage !== null ? `${r.cxStarAverage.toFixed(2)}/5` : "—"}<div className="esc-count">{r.cxResponseCount} responses</div></div>
                  <div>{r.ceBelowAnonymityFloor ? <span className="esc-muted" title="Fewer than 5 staff responses">Held back</span> : r.ceEnps !== null ? `${r.ceEnps > 0 ? "+" : ""}${r.ceEnps}` : "—"}<div className="esc-count">{r.ceBelowAnonymityFloor ? "anonymity floor" : `${r.ceResponseCount} responses`}</div></div>
                  <div>{r.quadrant ? <span className={`pill ${Q[r.quadrant].pill}`}>{Q[r.quadrant].label}</span> : <span className="esc-muted">Not enough data</span>}</div>
                  <div className="esc-count">{r.topLink ? `${r.topLink.staffLabel} ↔ ${r.topLink.customerLabel}${r.linkCount > 1 ? ` (+${r.linkCount - 1})` : ""}` : "—"}</div>
                </div>
              ))}
              {!shown.length && <p className="esc-muted" style={{ padding: "14px 0" }}>No branches match.</p>}
            </div>
          </div>
        </>
      )}

      <DetailDrawer open={!!openId} onClose={() => setOpenId(null)} title={detail?.row.name ?? "Branch story"}>
        {detailError && <div className="callout callout-amber">{detailError}</div>}
        {!detail && !detailError && <p className="esc-muted">Loading…</p>}
        {detail && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              {detail.row.quadrant && <span className={`pill ${Q[detail.row.quadrant].pill}`}>{detail.quadrantCopy.label}</span>}
              <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>{detail.headline}</p>
            </div>
            <div className="grid grid-2">
              <div className="card"><div className="metric-label">CUSTOMERS</div><div className="metric-val">{detail.row.cxStarAverage !== null ? `${detail.row.cxStarAverage.toFixed(2)}/5` : "—"}</div><div className="esc-count">{detail.rank.customer ? `#${detail.rank.customer.position} of ${detail.rank.customer.of} branches` : "no rank yet"}</div></div>
              <div className="card"><div className="metric-label">STAFF eNPS</div><div className="metric-val">{detail.row.ceEnps !== null ? `${detail.row.ceEnps > 0 ? "+" : ""}${detail.row.ceEnps}` : "—"}</div><div className="esc-count">{detail.rank.staff ? `#${detail.rank.staff.position} of ${detail.rank.staff.of} branches` : detail.staffSuppressedReason ? "held back" : "no rank yet"}</div></div>
            </div>
            <div><h4 style={{ margin: "0 0 6px" }}>Last 12 weeks</h4><WeeklyChart weekly={detail.weekly} /></div>

            <div>
              <h4 style={{ margin: "0 0 6px" }}>What staff and customers are both raising</h4>
              {detail.links.length === 0 ? (
                <p className="esc-muted">{detail.staffSuppressedReason ?? "No matching pain points yet. A link needs at least three negative mentions on both the staff and the customer side."}</p>
              ) : detail.links.map((l) => (
                <div key={`${l.staffLabel}-${l.customerLabel}`} className="esc-form" style={{ marginBottom: 10 }}>
                  <div><strong>{l.staffLabel}</strong> <span className="esc-muted">({l.staffNegative} negative staff mentions)</span> ↔ <strong>{l.customerLabel}</strong> <span className="esc-muted">({l.customerNegative} negative customer mentions)</span></div>
                  <div className="esc-muted">Why this may be connected: {l.reason}</div>
                  <div style={{ fontSize: 13.5 }}><b>Suggested next step:</b> {l.nextStep}</div>
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ margin: "0 0 6px" }}>What customers say</h4>
              {detail.customerThemes.length === 0 ? <p className="esc-muted">No themes in this period.</p> : detail.customerThemes.map((t) => (
                <div key={t.theme} style={{ padding: "6px 0", borderBottom: "1px solid #edf2f0", fontSize: 13.5 }}>
                  <strong>{t.theme}</strong> <span className="esc-muted">{t.frequency} mentions, {t.negative} negative</span>
                  {t.quote && <div className="esc-muted" style={{ fontStyle: "italic" }}>“{t.quote}”</div>}
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ margin: "0 0 6px" }}>What staff say <span className="esc-muted" style={{ fontWeight: 400 }}>(anonymous, totals only)</span></h4>
              {detail.staffSuppressedReason && <p className="esc-muted">{detail.staffSuppressedReason}</p>}
              {detail.staffThemes && (detail.staffThemes.length === 0 ? <p className="esc-muted">No theme has been raised by three or more people, so none is shown.</p> : detail.staffThemes.map((t) => (
                <div key={t.theme} style={{ padding: "6px 0", borderBottom: "1px solid #edf2f0", fontSize: 13.5 }}><strong>{t.theme}</strong> <span className="esc-muted">{t.frequency} mentions, {t.negative} negative</span></div>
              )))}
            </div>

            <div className="esc-actions">
              <Link className="btn btn-dark" href={`/group/branches/${detail.row.businessId}`}>Open branch</Link>
              <Link className="btn" href="/group/improvement-initiatives">Start an improvement initiative</Link>
              {detail.openCases > 0 && <Link className="btn" href="/group/cases">{detail.openCases} open case{detail.openCases === 1 ? "" : "s"}</Link>}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

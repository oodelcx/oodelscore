"use client";

import { useEffect, useState } from "react";
import { CxGoalsCard } from "@/components/cx-goals-card";

interface ExPulseScore {
  period: string;
  compositeScore: number;
  level: 1 | 2 | 3 | 4 | 5;
  enps: number | null;
  dimensions: {
    awareness: number;
    response: number;
    ownership: number;
    culture: number;
    outcome: number;
  };
}

interface BranchRow {
  businessId: string;
  name: string;
  region: string | null;
  compositeScore: number | null;
  level: 1 | 2 | 3 | 4 | 5 | null;
  enps: number | null;
}

interface DriverResult {
  categoryId: string;
  name: string;
  categoryAverage: number;
  correlation: number | null;
  sampleSize: number;
  confidence: "reliable" | "low" | "insufficient";
  classification: "priority" | "strength" | "moderate";
}

const CLASSIFICATION_LABELS: Record<DriverResult["classification"], string> = {
  priority: "Priority — pulling the score down",
  strength: "Strength — worth protecting",
  moderate: "Moderate influence",
};

interface PeriodComparison {
  npsScore: number | null;
  responseCount: number;
  enpsPointChange: number | null;
}

interface PeriodComparisons {
  week: PeriodComparison;
  month: PeriodComparison;
  quarter: PeriodComparison;
  year: PeriodComparison;
}

function formatPointChange(change: number | null): string {
  if (change === null) return "—";
  if (change > 0) return `+${change}`;
  return String(change);
}

interface DemographicCut {
  value: string;
  responseCount: number;
  enps: number | null;
}

interface DemographicBreakdown {
  ageGroup: DemographicCut[];
  gender: DemographicCut[];
}

const DEMOGRAPHIC_FIELD_LABELS: Record<keyof DemographicBreakdown, string> = {
  ageGroup: "Age group",
  gender: "Gender",
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1 — Starting out",
  2: "Level 2 — Building the basics",
  3: "Level 3 — Established",
  4: "Level 4 — Mature",
  5: "Level 5 — Leading",
};

function levelPillClass(level: number): string {
  if (level >= 4) return "pill-green";
  if (level >= 3) return "pill-blue";
  if (level >= 2) return "pill-amber";
  return "pill-gray";
}

export default function GroupExPulseClient() {
  const [score, setScore] = useState<ExPulseScore | null>(null);
  const [history, setHistory] = useState<ExPulseScore[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [drivers, setDrivers] = useState<DriverResult[]>([]);
  const [periodComparisons, setPeriodComparisons] = useState<PeriodComparisons | null>(null);
  const [demographics, setDemographics] = useState<DemographicBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/group/ex-pulse").then(async (r) => ({ ok: r.ok, data: await r.json() })),
      fetch("/api/group/ex-driver-analysis").then(async (r) => ({ ok: r.ok, data: await r.json() })),
    ])
      .then(([pulseRes, driverRes]) => {
        if (!pulseRes.ok) {
          setForbidden(true);
          return;
        }
        setScore(pulseRes.data.score);
        setHistory(pulseRes.data.history ?? []);
        setBranches(pulseRes.data.branches ?? []);
        setPeriodComparisons(pulseRes.data.periodComparisons ?? null);
        setDemographics(pulseRes.data.demographics ?? null);
        if (driverRes.ok) setDrivers(driverRes.data.drivers ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-head">
          <h1>CX Pulse</h1>
        </div>
        <p className="subtitle">Loading…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <div className="page-head">
          <h1>CX Pulse</h1>
        </div>
        <div className="callout">Colleague Experience is not enabled for this organization.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>CX Pulse</h1>
        <p className="subtitle" style={{ margin: 0 }}>
          Colleague Experience's org-wide maturity score, rolled up the same way CX Pulse is — plus eNPS as the
          standing headline metric across every branch. Recomputed nightly.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <CxGoalsCard
          apiPath="/api/group/goals"
          categoriesApiPath="/api/group/category-owners"
          product="colleague_experience"
          title="CX Goals"
        />
      </div>

      {!score ? (
        <div className="callout">
          No org-level score computed yet. This fills in after the nightly recompute job runs against real colleague
          responses.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div className="callout" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{score.compositeScore}</div>
              <div className="subtitle" style={{ margin: 0 }}>{LEVEL_LABELS[score.level]}</div>
            </div>
            <div className="callout" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{score.enps !== null ? score.enps : "—"}</div>
              <div className="subtitle" style={{ margin: 0 }}>eNPS</div>
            </div>
          </div>

          {periodComparisons && (
            <div className="callout" style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>Own-history benchmark</h3>
              <p className="subtitle" style={{ marginTop: 0 }}>
                eNPS this period vs. the same-length period before it, pooled across every CE-enabled branch.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                {(
                  [
                    ["week", "This week"],
                    ["month", "This month"],
                    ["quarter", "This quarter"],
                    ["year", "This year"],
                  ] as const
                ).map(([key, label]) => {
                  const p = periodComparisons[key];
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>
                        {p.npsScore !== null ? p.npsScore : "—"}
                        {p.enpsPointChange !== null && (
                          <span
                            style={{ fontSize: 13, fontWeight: 500, marginLeft: 6, color: p.enpsPointChange >= 0 ? "#1a7f37" : "#c62828" }}
                          >
                            {formatPointChange(p.enpsPointChange)}
                          </span>
                        )}
                      </div>
                      <div className="subtitle" style={{ margin: 0 }}>
                        {label} ({p.responseCount} response{p.responseCount === 1 ? "" : "s"})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-2" style={{ marginBottom: 20 }}>
            <div>
              <div className="section-title">Dimensions</div>
              <div className="callout">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  {Object.entries(score.dimensions).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
                      <div className="subtitle" style={{ margin: 0, textTransform: "capitalize" }}>{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="section-title">Branch-level CX Pulse</div>
              <div className="card">
                <table className="clean">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Score</th>
                      <th>eNPS</th>
                      <th>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr key={b.businessId}>
                        <td>
                          {b.name}
                          {b.region && <div className="card-sub">{b.region}</div>}
                        </td>
                        <td>{b.compositeScore ?? "—"}</td>
                        <td>{b.enps ?? "—"}</td>
                        <td>
                          {b.level ? (
                            <span className={`pill ${levelPillClass(b.level)}`}>
                              L{b.level} · {LEVEL_LABELS[b.level]}
                            </span>
                          ) : (
                            <span className="pill pill-gray">Not scored</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {branches.length === 0 && (
                      <tr>
                        <td colSpan={4} className="subtitle">
                          No Colleague-Experience-enabled branches yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {drivers.length > 0 && (
            <div className="callout" style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>What's driving this</h3>
              <p className="subtitle" style={{ marginTop: 0 }}>
                Which categories correlate most strongly with the rest of a colleague's ratings, pooled across every
                CE-enabled branch. Last 90 days.
              </p>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Average</th>
                    <th>Correlation</th>
                    <th>Responses</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.categoryId}>
                      <td>{d.name}</td>
                      <td>{d.categoryAverage}</td>
                      <td>{d.correlation !== null ? d.correlation.toFixed(2) : "—"}</td>
                      <td>
                        {d.sampleSize}
                        {d.confidence !== "reliable" && (
                          <span className="subtitle"> ({d.confidence === "low" ? "low confidence" : "not enough data"})</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            d.classification === "priority" ? "pill-red" : d.classification === "strength" ? "pill-green" : "pill-gray"
                          }`}
                        >
                          {CLASSIFICATION_LABELS[d.classification]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {demographics && (demographics.ageGroup.length > 0 || demographics.gender.length > 0) && (
            <div className="callout" style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>eNPS by demographic</h3>
              <p className="subtitle" style={{ marginTop: 0 }}>
                Self-reported, never tied to identity, pooled across every CE-enabled branch. Last 90 days. A group
                with fewer than 5 responses shows no score at all — not a blurred number — until enough exist to
                protect anonymity.
              </p>
              {(Object.keys(demographics) as (keyof DemographicBreakdown)[]).map((field) =>
                demographics[field].length === 0 ? null : (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{DEMOGRAPHIC_FIELD_LABELS[field]}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {demographics[field].map((cut) => (
                        <div key={cut.value} className="callout" style={{ padding: "8px 14px", minWidth: 100 }}>
                          <div style={{ fontSize: 18, fontWeight: 600 }}>{cut.enps !== null ? cut.enps : "—"}</div>
                          <div className="subtitle" style={{ margin: 0 }}>
                            {cut.value} ({cut.responseCount})
                          </div>
                          {cut.enps === null && (
                            <div className="subtitle" style={{ margin: 0, fontSize: 11 }}>
                              Not enough responses yet
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {history.length > 1 && (
            <div className="callout">
              <h3 style={{ marginTop: 0 }}>Recent history</h3>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Score</th>
                    <th>Level</th>
                    <th>eNPS</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.period}>
                      <td>{new Date(h.period).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td>
                      <td>{h.compositeScore}</td>
                      <td>{h.level}</td>
                      <td>{h.enps !== null ? h.enps : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

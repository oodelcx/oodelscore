"use client";

import { Fragment, useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

interface DriverRow {
  categoryId: string;
  name: string;
  categoryAverage: number;
  correlation: number | null;
  sampleSize: number;
  confidence: "reliable" | "low" | "insufficient";
  classification: "priority" | "strength" | "moderate";
}

interface RootCauseInvestigation {
  observedIssue: string;
  contributingFactors: string[];
  likelyRootCause: string;
  confidenceLabel: "likely" | "inferred" | "uncertain";
  recommendation: { description: string; suggestedOwnerRole: string; priority: "low" | "medium" | "high" | "critical" };
  generatedByAi: boolean;
}

interface ThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  trend: "up" | "down" | "flat" | null;
  representativeQuote: string | null;
}

interface InsightReport {
  bodyMarkdown: string;
  period: string;
  periodStart: string;
}

const CLASSIFICATION_LABEL: Record<DriverRow["classification"], string> = {
  priority: "Priority",
  strength: "Strength",
  moderate: "Moderate",
};
const CLASSIFICATION_PILL: Record<DriverRow["classification"], string> = {
  priority: "pill-red",
  strength: "pill-green",
  moderate: "pill-amber",
};
const CONFIDENCE_LABEL: Record<RootCauseInvestigation["confidenceLabel"], string> = {
  likely: "Likely",
  inferred: "Inferred",
  uncertain: "Uncertain",
};
const TREND_ICON: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

function dominantSentimentColor(s: ThemeRow["sentimentBreakdown"]): string {
  if (s.negative >= s.positive && s.negative >= s.neutral) return "var(--red)";
  if (s.positive >= s.neutral) return "var(--green)";
  return "var(--text-3)";
}

/** Strips the common markdown punctuation from a report body and returns a short lead-in sentence for the teaser strip. */
function teaserFromMarkdown(markdown: string): string {
  const plain = markdown
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > 220 ? `${plain.slice(0, 220).trimEnd()}…` : plain;
}

/**
 * The consolidated "why is my score what it is" screen — replaces what used
 * to be three separate cards (Driver Analysis, Root Cause Investigation,
 * Theme & Sentiment Intelligence) plus a periodic AI Insights report that
 * lived on its own page entirely. One card, top to bottom: the latest
 * AI Insights headline, the ranked driver table with an inline "Investigate
 * further" expansion per priority category, and the theme/sentiment
 * evidence underneath — so the evidence for a driver and the words behind
 * it sit in the same place instead of three tabs a user has to
 * cross-reference themselves.
 */
export function ScoreDriversCard({
  driverApiPath,
  rootCauseApiPath,
  canCreateAction,
  createActionApiPath,
  themeApiPath,
  analyzeApiPath,
  insightsApiPath,
  driverTooltip,
  rootCauseTooltip,
  themeTooltip,
}: {
  driverApiPath: string;
  rootCauseApiPath: string;
  canCreateAction: boolean;
  createActionApiPath?: string;
  themeApiPath: string;
  analyzeApiPath: string;
  insightsApiPath?: string;
  driverTooltip?: string;
  rootCauseTooltip?: string;
  themeTooltip?: string;
}) {
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [loadingWhy, setLoadingWhy] = useState(false);
  const [analysis, setAnalysis] = useState<RootCauseInvestigation | null>(null);
  const [whyError, setWhyError] = useState<string | null>(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [actionCreated, setActionCreated] = useState(false);

  const [themes, setThemes] = useState<ThemeRow[] | null>(null);
  const [themeWindowDays, setThemeWindowDays] = useState(30);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string | null>(null);

  const [latestInsight, setLatestInsight] = useState<InsightReport | null>(null);

  useEffect(() => {
    fetch(driverApiPath)
      .then((res) => res.json())
      .then((d) => {
        setDrivers(d.drivers ?? []);
        if (d.windowDays) setWindowDays(d.windowDays);
      });
  }, [driverApiPath]);

  function loadThemes() {
    fetch(themeApiPath)
      .then((res) => res.json())
      .then((d) => {
        setThemes(d.themes ?? []);
        if (d.windowDays) setThemeWindowDays(d.windowDays);
      });
  }
  useEffect(loadThemes, [themeApiPath]);

  useEffect(() => {
    if (!insightsApiPath) return;
    fetch(insightsApiPath)
      .then((res) => res.json())
      .then((d) => {
        const report = (d.reports ?? [])[0];
        if (report) setLatestInsight(report);
      })
      .catch(() => {});
  }, [insightsApiPath]);

  async function askWhy(categoryId: string) {
    if (openCategoryId === categoryId) {
      setOpenCategoryId(null);
      return;
    }
    setOpenCategoryId(categoryId);
    setAnalysis(null);
    setWhyError(null);
    setActionCreated(false);
    setLoadingWhy(true);
    const res = await fetch(rootCauseApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    const data = await res.json().catch(() => null);
    setLoadingWhy(false);
    if (!res.ok) {
      setWhyError(data?.message ?? "Failed to investigate");
      return;
    }
    setAnalysis(data.analysis);
  }

  async function createAction(categoryId: string) {
    if (!createActionApiPath || !analysis) return;
    setCreatingAction(true);
    await fetch(createActionApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: analysis.likelyRootCause.slice(0, 120),
        description: analysis.recommendation.description,
        categoryId,
        priority: analysis.recommendation.priority,
      }),
    });
    setCreatingAction(false);
    setActionCreated(true);
  }

  async function runAnalyze() {
    setAnalyzing(true);
    setAnalyzeStatus(null);
    const res = await fetch(analyzeApiPath, { method: "POST" });
    const data = await res.json().catch(() => null);
    setAnalyzing(false);
    if (!res.ok) {
      setAnalyzeStatus("Failed to analyze feedback");
      return;
    }
    setAnalyzeStatus(
      data.analyzed === 0 && data.remaining === 0
        ? "Everything is already analyzed"
        : `Analyzed ${data.analyzed} response${data.analyzed === 1 ? "" : "s"}${data.remaining > 0 ? ` · ${data.remaining} more remaining, click again` : ""}`
    );
    loadThemes();
  }

  const priorityCount = drivers?.filter((d) => d.classification === "priority").length ?? 0;

  return (
    <div className="card">
      <h3>
        What&rsquo;s driving your score
        <InfoTip text={driverTooltip} />
      </h3>

      {latestInsight && (
        <div
          style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          <b>Latest insight ({latestInsight.period}):</b> {teaserFromMarkdown(latestInsight.bodyMarkdown)}
        </div>
      )}

      <p className="card-sub">
        How strongly each category correlates with the rest of a response&rsquo;s rating, over the last {windowDays} days.
        Priority categories score below average and move the needle most — fix these first
        {priorityCount > 0 ? ` (${priorityCount} right now).` : "."}
      </p>

      {drivers === null && <p className="subtitle">Loading…</p>}
      {drivers !== null && drivers.length === 0 && <p className="subtitle">Not enough categorized feedback yet.</p>}
      {drivers !== null && drivers.length > 0 && (
        <table className="clean">
          <thead>
            <tr>
              <th>Category</th>
              <th>Average</th>
              <th>Correlation</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <Fragment key={d.categoryId}>
                <tr>
                  <td>{d.name}</td>
                  <td>{d.categoryAverage.toFixed(2)}</td>
                  <td>
                    {d.confidence === "insufficient" ? (
                      <span className="subtitle">Insufficient data ({d.sampleSize})</span>
                    ) : (
                      <>
                        {d.correlation !== null ? d.correlation.toFixed(2) : "—"}
                        {d.confidence === "low" && <span className="subtitle"> (low confidence, n={d.sampleSize})</span>}
                      </>
                    )}
                  </td>
                  <td>
                    {d.confidence !== "insufficient" && d.classification !== "moderate" && (
                      <span className={`pill ${CLASSIFICATION_PILL[d.classification]}`}>{CLASSIFICATION_LABEL[d.classification]}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {d.classification === "priority" && (
                      <button className="btn btn-sm" onClick={() => askWhy(d.categoryId)}>
                        {openCategoryId === d.categoryId ? "Close" : "Investigate further"}
                      </button>
                    )}
                  </td>
                </tr>
                {openCategoryId === d.categoryId && (
                  <tr>
                    <td colSpan={5}>
                      <div style={{ margin: "6px 0 14px", padding: 14, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
                        {loadingWhy && <p className="subtitle">Investigating…</p>}
                        {whyError && <p className="error-text">{whyError}</p>}
                        {analysis && (
                          <>
                            <p style={{ marginTop: 0 }}>
                              <b>Observed:</b> {analysis.observedIssue}
                            </p>
                            {analysis.contributingFactors.length > 0 && (
                              <>
                                <b>Contributing factors</b>
                                <ul style={{ marginTop: 4 }}>
                                  {analysis.contributingFactors.map((f, i) => (
                                    <li key={i}>{f}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                            <p>
                              <b>Most likely explanation</b>
                              <InfoTip text={rootCauseTooltip} />{" "}
                              <span className="pill pill-amber">{CONFIDENCE_LABEL[analysis.confidenceLabel]}</span>
                              <br />
                              {analysis.likelyRootCause}
                            </p>
                            <p>
                              <b>Recommended action</b> ({analysis.recommendation.priority} priority, suggested owner:{" "}
                              {analysis.recommendation.suggestedOwnerRole})
                              <br />
                              {analysis.recommendation.description}
                            </p>
                            {!analysis.generatedByAi && (
                              <p className="subtitle">AI analysis unavailable right now — showing the underlying evidence directly.</p>
                            )}
                            {canCreateAction && (
                              <button
                                className="btn btn-dark btn-sm"
                                disabled={creatingAction || actionCreated}
                                onClick={() => createAction(d.categoryId)}
                              >
                                {actionCreated ? "Case created ✓" : creatingAction ? "Creating…" : "Create Case"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <div className="page-head" style={{ marginBottom: 6 }}>
          <div>
            <h3 style={{ margin: 0 }}>
              What people are saying
              <InfoTip text={themeTooltip} />
            </h3>
            <p className="card-sub" style={{ margin: 0 }}>
              Themes extracted from open-ended answers over the last {themeWindowDays} days — the evidence behind the
              drivers above.
            </p>
          </div>
          <button className="btn btn-sm" disabled={analyzing} onClick={runAnalyze}>
            {analyzing ? "Analyzing…" : "Analyze feedback"}
          </button>
        </div>
        {analyzeStatus && <p className="subtitle">{analyzeStatus}</p>}

        {themes === null && <p className="subtitle">Loading…</p>}
        {themes !== null && themes.length === 0 && (
          <p className="subtitle">
            No themes yet — comments need to be analyzed first. Click &ldquo;Analyze feedback&rdquo; to process existing responses.
          </p>
        )}
        {themes !== null &&
          themes.map((t) => (
            <div key={t.theme} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line, #e4e2dc)" }}>
              <div className="page-head" style={{ marginBottom: 4 }}>
                <div>
                  <b style={{ textTransform: "capitalize" }}>{t.theme}</b>
                  <span className="subtitle" style={{ marginLeft: 8 }}>
                    {t.frequency} mention{t.frequency === 1 ? "" : "s"}
                  </span>
                  {t.trend && (
                    <span className="subtitle" style={{ marginLeft: 8, color: dominantSentimentColor(t.sentimentBreakdown) }}>
                      {TREND_ICON[t.trend]}
                    </span>
                  )}
                </div>
                <div className="subtitle">
                  {t.sentimentBreakdown.positive}+ · {t.sentimentBreakdown.neutral}~ · {t.sentimentBreakdown.negative}-
                </div>
              </div>
              {t.representativeQuote && (
                <div style={{ fontSize: 13, color: "var(--text-2, #55584f)" }}>&ldquo;{t.representativeQuote}&rdquo;</div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

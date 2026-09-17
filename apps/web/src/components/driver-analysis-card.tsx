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

interface RootCauseAnalysis {
  observedIssue: string;
  contributingFactors: string[];
  likelyRootCause: string;
  confidenceLabel: "likely" | "inferred" | "uncertain";
  recommendation: { description: string; suggestedOwnerRole: string; priority: "low" | "medium" | "high" | "critical" };
  generatedByAi: boolean;
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
const CONFIDENCE_LABEL: Record<RootCauseAnalysis["confidenceLabel"], string> = {
  likely: "Likely",
  inferred: "Inferred",
  uncertain: "Uncertain",
};

/**
 * Shared by Business and Group Analytics — "what's driving your score" (pure
 * computation, no AI), plus an on-demand "Why?" root cause analysis for
 * priority categories (the one AI call in this card, evidence-gated — see
 * ai/rootCause.ts). `canCreateAction` gates the "Create Action" button:
 * Group's Action Board has no create endpoint (branches own creation, per
 * spec), so it's business-only.
 */
export function DriverAnalysisCard({
  apiPath,
  rootCauseApiPath,
  canCreateAction,
  createActionApiPath,
  driverTooltip,
  rootCauseTooltip,
}: {
  apiPath: string;
  rootCauseApiPath: string;
  canCreateAction: boolean;
  createActionApiPath?: string;
  driverTooltip?: string;
  rootCauseTooltip?: string;
}) {
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [loadingWhy, setLoadingWhy] = useState(false);
  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [whyError, setWhyError] = useState<string | null>(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [actionCreated, setActionCreated] = useState(false);

  useEffect(() => {
    fetch(apiPath)
      .then((res) => res.json())
      .then((d) => {
        setDrivers(d.drivers ?? []);
        if (d.windowDays) setWindowDays(d.windowDays);
      });
  }, [apiPath]);

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
      setWhyError(data?.message ?? "Failed to analyze");
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

  return (
    <div className="card">
      <h3>
        What&rsquo;s driving your score
        <InfoTip text={driverTooltip} />
      </h3>
      <p className="card-sub">
        How strongly each category correlates with the rest of a response&rsquo;s rating, over the last {windowDays} days.
        Priority categories score below average and move the needle most — fix these first.
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
                        {openCategoryId === d.categoryId ? "Close" : "Why?"}
                      </button>
                    )}
                  </td>
                </tr>
                {openCategoryId === d.categoryId && (
                  <tr>
                    <td colSpan={5}>
                      <div style={{ margin: "6px 0 14px", padding: 14, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
                        {loadingWhy && <p className="subtitle">Analyzing…</p>}
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
                              <b>Likely root cause</b>
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
                                {actionCreated ? "Action created ✓" : creatingAction ? "Creating…" : "Create Action"}
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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface RunDetail {
  _id: string;
  playbookId: string;
  actionBoardItemId: string;
  steps: string[];
  completedStepIndexes: number[];
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  attachReason: string;
}
interface PlaybookDetail {
  title: string;
  triggerCondition: string;
  categoryId: string | null;
}
interface Usage {
  usageCount90d: number;
  completionRate: number | null;
  avgResolutionHours: number | null;
  usedThisOwnerLast30d: number;
}

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return "—";
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Case Management's side panel (desktop) / bottom sheet (phone width) for a
 * single playbook run attached to a case. Reusable across Business and
 * Group — pass the portal's API base path ("business" | "group"). Does NOT
 * replace `playbook-run-panel.tsx`, which the standalone Playbooks pages
 * still use for their own inline expand/run UI.
 */
export function PlaybookRunPanelSlideout({
  runId,
  basePath,
  categoryName,
  onClose,
  onChanged,
  libraryHref,
  onLogDecision,
  onResolveCase,
}: {
  runId: string;
  basePath: "business" | "group";
  categoryName: (categoryId: string | null) => string;
  onClose: () => void;
  onChanged: () => void;
  libraryHref: string;
  onLogDecision: (ctx: { title: string; trigger: string; linkedCaseId: string }) => void;
  onResolveCase?: () => void;
}) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [playbook, setPlaybook] = useState<PlaybookDetail | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [patternNudge, setPatternNudge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/${basePath}/playbook-runs/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.status !== "ok" || !data.run) {
          setError("Couldn't load this playbook run.");
          return;
        }
        setRun(data.run);
        setPlaybook(data.playbook ?? null);
        setUsage(data.usage ?? null);
        setPatternNudge(!!data.patternNudge);
      })
      .catch(() => setError("Couldn't load this playbook run."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, basePath]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleStep(index: number, completed: boolean) {
    if (!run) return;
    setToggling(index);
    await fetch(`/api/${basePath}/playbook-runs/${run._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: index, completed }),
    });
    setToggling(null);
    load();
    onChanged();
  }

  async function markStatus(status: "abandoned" | "completed") {
    if (!run) return;
    if (status === "abandoned" && !confirm("Abandon this playbook run? Progress will be lost.")) return;
    setBusy(true);
    await fetch(`/api/${basePath}/playbook-runs/${run._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    load();
    onChanged();
  }

  return (
    <>
      <div className="pb-slideout-backdrop" onClick={onClose} />
      <div className="pb-slideout" role="dialog" aria-modal="true" aria-label="Playbook run">
        <div className="pb-slideout-header">
          <div>
            <div className="pb-eyebrow">{playbook ? categoryName(playbook.categoryId) : "Playbook"}</div>
            <div className="pb-slideout-title">{playbook?.title ?? (loading ? "Loading…" : "Playbook run")}</div>
          </div>
          <button type="button" className="pb-slideout-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="pb-slideout-body">
          {loading && <p className="subtitle">Loading…</p>}
          {error && <p className="error-text">{error}</p>}
          {!loading && run && playbook && (
            <>
              <a href={libraryHref} className="ab-show-more" style={{ display: "inline-block", marginBottom: 4 }}>
                Edit this playbook in the Library →
              </a>

              {run.attachReason && <div className="pb-reason-callout">{run.attachReason}</div>}

              <div className="subtitle" style={{ marginBottom: 6 }}>
                {run.completedStepIndexes.length} of {run.steps.length} steps done
                {run.status !== "active" && (
                  <span className={`pill ${run.status === "completed" ? "pill-green" : "pill-gray"}`} style={{ marginLeft: 8 }}>
                    {run.status}
                  </span>
                )}
              </div>
              <div className="pb-checklist">
                {run.steps.map((step, i) => {
                  const checked = run.completedStepIndexes.includes(i);
                  return (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={toggling === i || run.status !== "active"}
                        onChange={(e) => toggleStep(i, e.target.checked)}
                      />
                      <span style={{ textDecoration: checked ? "line-through" : "none", color: checked ? "var(--text-3)" : "inherit" }}>
                        {step}
                      </span>
                    </label>
                  );
                })}
              </div>

              {usage && (
                <div className="pb-stat-grid">
                  <div className="pb-stat-tile">
                    <div className="pb-stat-label">Used (90d)</div>
                    <div className="pb-stat-val">{usage.usageCount90d}</div>
                  </div>
                  <div className="pb-stat-tile">
                    <div className="pb-stat-label">Completion rate</div>
                    <div className="pb-stat-val">{usage.completionRate === null ? "—" : `${Math.round(usage.completionRate * 100)}%`}</div>
                  </div>
                  <div className="pb-stat-tile">
                    <div className="pb-stat-label">Avg resolution</div>
                    <div className="pb-stat-val">{formatHours(usage.avgResolutionHours)}</div>
                  </div>
                  <div className="pb-stat-tile">
                    <div className="pb-stat-label">This business (30d)</div>
                    <div className="pb-stat-val">{usage.usedThisOwnerLast30d}</div>
                  </div>
                </div>
              )}

              {patternNudge && (
                <div className="pb-nudge-callout">
                  <div>
                    Used {usage?.usedThisOwnerLast30d ?? "3+"} times at this business in 30 days — this may be worth a
                    Decision Log entry instead of another one-off fix.
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-dark"
                    onClick={() =>
                      onLogDecision({
                        title: `${playbook.title} — recurring issue`,
                        trigger: `Playbook "${playbook.title}" run ${usage?.usedThisOwnerLast30d ?? 3}+ times in 30 days for this business — logged as a structural issue rather than another one-off fix.`,
                        linkedCaseId: run.actionBoardItemId,
                      })
                    }
                  >
                    Log a decision
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {!loading && run && (
          <div className="pb-slideout-footer">
            {run.status === "active" && (
              <>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => markStatus("abandoned")}>
                  Abandon
                </button>
                <button type="button" className="btn btn-sm btn-dark" disabled={busy} onClick={() => markStatus("completed")}>
                  Mark playbook completed
                </button>
              </>
            )}
            {onResolveCase && (
              <button type="button" className="btn btn-sm" onClick={onResolveCase}>
                Mark case resolved
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

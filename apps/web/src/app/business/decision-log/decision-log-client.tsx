"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InfoTip } from "@/components/info-tip";

type OutcomeMetric = "starAverage" | "nps" | "categoryAverage";

interface EntryRow {
  _id: string;
  title: string;
  trigger: string;
  status: string;
  implementationDate: string | null;
  outcomeMetric: OutcomeMetric | null;
  outcomeCategoryId: string | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
}

interface CategoryOption {
  _id: string;
  name: string;
}

const METRIC_LABELS: Record<OutcomeMetric, string> = {
  starAverage: "Overall score (stars)",
  nps: "NPS",
  categoryAverage: "Category score",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  implemented: "Implemented",
};

const VERDICT_LABELS: Record<string, string> = {
  positive: "Improvement appears to have had a positive impact",
  negative: "Score went down after this decision",
  no_change: "No meaningful change detected",
  not_ready: "Too soon to measure — check back in a couple of weeks",
  insufficient_data: "Not enough response data to measure yet",
};

function outcomeDelta(entry: EntryRow): string | null {
  if (entry.outcomeBefore === null || entry.outcomeAfter === null) return null;
  const delta = Math.round((entry.outcomeAfter - entry.outcomeBefore) * 100) / 100;
  return delta > 0 ? `+${delta}` : String(delta);
}

export default function BusinessDecisionLogClient({ tooltips }: { tooltips: Record<string, string> }) {
  return (
    <Suspense fallback={<p className="subtitle">Loading…</p>}>
      <BusinessDecisionLogInner tooltips={tooltips} />
    </Suspense>
  );
}

function BusinessDecisionLogInner({ tooltips }: { tooltips: Record<string, string> }) {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [linkedCaseId, setLinkedCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [implementationDateDraft, setImplementationDateDraft] = useState("");
  const [metricDraft, setMetricDraft] = useState<OutcomeMetric>("starAverage");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [outcomeBeforeDraft, setOutcomeBeforeDraft] = useState("");
  const [outcomeAfterDraft, setOutcomeAfterDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [triggerDraft, setTriggerDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "planned" | "in_progress" | "implemented">("all");
  const [expandedTriggerFor, setExpandedTriggerFor] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/business/decision-log")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/business/category-owners")
      .then((res) => res.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  // Pre-fill the "New entry" form when arriving from Case Management's
  // pattern-nudge callout, e.g. /business/decision-log?new=1&title=...&trigger=...&linkedCaseId=...
  useEffect(() => {
    if (searchParams?.get("new") !== "1") return;
    const qTitle = searchParams.get("title");
    const qTrigger = searchParams.get("trigger");
    const qLinkedCaseId = searchParams.get("linkedCaseId");
    if (qTitle) setTitle(qTitle);
    if (qTrigger) setTrigger(qTrigger);
    if (qLinkedCaseId) setLinkedCaseId(qLinkedCaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEntry() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/decision-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, trigger, linkedActionIds: linkedCaseId ? [linkedCaseId] : [] }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setTrigger("");
    setLinkedCaseId(null);
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this decision log entry?")) return;
    await fetch(`/api/business/decision-log/${id}`, { method: "DELETE" });
    load();
  }

  function startEditTitle(entry: EntryRow) {
    setEditingId(entry._id);
    setTitleDraft(entry.title);
    setTriggerDraft(entry.trigger);
    setMeasuringId(null);
  }

  async function saveTitle(id: string) {
    if (!titleDraft.trim()) return;
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim(), trigger: triggerDraft }),
    });
    setEditingId(null);
    load();
  }

  function startMeasure(entry: EntryRow) {
    setMeasuringId(entry._id);
    setImplementationDateDraft(entry.implementationDate ? entry.implementationDate.slice(0, 10) : "");
    setMetricDraft(entry.outcomeMetric ?? "starAverage");
    setCategoryDraft(entry.outcomeCategoryId ?? "");
    setOutcomeBeforeDraft(entry.outcomeBefore !== null ? String(entry.outcomeBefore) : "");
    setOutcomeAfterDraft(entry.outcomeAfter !== null ? String(entry.outcomeAfter) : "");
    setVerdict(null);
    setMeasureError(null);
    setEditingId(null);
  }

  async function runAutoMeasure(id: string) {
    if (!implementationDateDraft) {
      setMeasureError("Set the implementation date first");
      return;
    }
    setMeasuring(true);
    setMeasureError(null);
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ implementationDate: implementationDateDraft }),
    });
    const res = await fetch(`/api/business/decision-log/${id}/measure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcomeMetric: metricDraft,
        outcomeCategoryId: metricDraft === "categoryAverage" ? categoryDraft : undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setMeasuring(false);
    if (!res.ok) {
      setMeasureError(data?.message ?? "Failed to measure outcome");
      return;
    }
    setVerdict(data.verdict);
    load();
  }

  async function saveOutcomeManually(id: string) {
    const patch: Record<string, number> = {};
    if (outcomeBeforeDraft.trim()) patch.outcomeBefore = Number(outcomeBeforeDraft);
    if (outcomeAfterDraft.trim()) patch.outcomeAfter = Number(outcomeAfterDraft);
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setMeasuringId(null);
    load();
  }

  const visibleEntries = entries.filter((e) => statusFilter === "all" || e.status === statusFilter);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Decision Log</h1>
          <p className="subtitle">
            Track decisions and changes made in response to feedback, and measure the outcome. Resolving an Action
            Board item with a note logs one here automatically.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>New entry</h3>
        {linkedCaseId && <p className="card-sub">Pre-filled from a Case Management playbook — this entry will link back to that case.</p>}
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>
              Trigger
              <InfoTip text={tooltips["trigger"]} />
            </label>
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createEntry}>
          {creating ? "Creating…" : "+ Log decision"}
        </button>
      </div>

      {!loading && entries.length > 0 && (
        <div className="filters">
          {(["all", "planned", "in_progress", "implemented"] as const).map((s) => {
            const count = s === "all" ? entries.length : entries.filter((e) => e.status === s).length;
            return (
              <div key={s} className={`chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : STATUS_LABELS[s]} ({count})
              </div>
            );
          })}
        </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div className="ab-list">
          {visibleEntries.map((e) => {
            const delta = outcomeDelta(e);
            const triggerExpanded = expandedTriggerFor === e._id;
            const triggerIsLong = e.trigger.length > 160;
            return (
              <div className="card ab-card" key={e._id}>
                {editingId === e._id ? (
                  <div className="ab-panel" style={{ margin: 0 }}>
                    <div className="field-row">
                      <div className="field">
                        <label>Title</label>
                        <input value={titleDraft} onChange={(ev) => setTitleDraft(ev.target.value)} />
                      </div>
                      <div className="field">
                        <label>Trigger</label>
                        <input value={triggerDraft} onChange={(ev) => setTriggerDraft(ev.target.value)} />
                      </div>
                    </div>
                    <button className="btn btn-dark btn-sm" onClick={() => saveTitle(e._id)}>
                      Save
                    </button>{" "}
                    <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="ab-card-head">
                      <div className="ab-title-block">
                        <div className="ab-badges">
                          <span className={`pill ${e.status === "implemented" ? "pill-green" : e.status === "in_progress" ? "pill-amber" : "pill-gray"}`}>
                            {STATUS_LABELS[e.status] ?? e.status}
                          </span>
                          {delta && (
                            <span className={`pill ${delta.startsWith("+") ? "pill-green" : "pill-red"}`}>
                              {delta.startsWith("+") ? "Improved " : "Declined "}
                              {delta}
                            </span>
                          )}
                        </div>
                        <div className="ab-title">{e.title}</div>
                        <div className="ab-meta-row">
                          <span>
                            Status:{" "}
                            <select
                              value={e.status}
                              onChange={(ev) => updateStatus(e._id, ev.target.value)}
                              style={{ marginLeft: 4 }}
                            >
                              <option value="planned">Planned</option>
                              <option value="in_progress">In progress</option>
                              <option value="implemented">Implemented</option>
                            </select>
                          </span>
                        </div>
                        {e.trigger && (
                          <>
                            <div className={`ab-desc${triggerExpanded ? " expanded" : ""}`}>
                              <b>Trigger:</b> {e.trigger}
                            </div>
                            {triggerIsLong && (
                              <span
                                className="ab-show-more"
                                onClick={() => setExpandedTriggerFor(triggerExpanded ? null : e._id)}
                              >
                                {triggerExpanded ? "Show less" : "Show more"}
                              </span>
                            )}
                          </>
                        )}
                        <div className="ab-callout">
                          <b>Outcome:</b>{" "}
                          {e.outcomeBefore !== null && e.outcomeAfter !== null
                            ? `${e.outcomeBefore} → ${e.outcomeAfter} (${delta})`
                            : "not measured yet"}
                        </div>
                      </div>
                    </div>

                    <div className="action-links">
                      <button type="button" className="btn btn-sm action-btn" onClick={() => startEditTitle(e)}>
                        ✎ Edit
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm action-btn${measuringId === e._id ? " active" : ""}`}
                        onClick={() => (measuringId === e._id ? setMeasuringId(null) : startMeasure(e))}
                      >
                        📏 Measure outcome
                      </button>
                      <button type="button" className="icon-btn btn-danger" onClick={() => removeEntry(e._id)}>
                        🗑
                      </button>
                    </div>

                    {measuringId === e._id && (
                      <div className="ab-panel">
                        <p className="card-sub" style={{ marginTop: 0 }}>
                          Pick what to measure — OodelCX compares the average across everyone who responded in the 30
                          days before implementation to everyone who&apos;s responded since, using your real feedback
                          data. This tracks whether the metric moved overall, not whether any one customer&apos;s
                          complaint was personally resolved — most feedback is anonymous. Needs at least 14 days since
                          implementation; once eligible, this also gets checked automatically once a day, so you
                          don&apos;t have to remember to come back and click it.
                        </p>
                        <div className="field-row">
                          <div className="field">
                            <label>Implementation date</label>
                            <input
                              type="date"
                              value={implementationDateDraft}
                              onChange={(ev) => setImplementationDateDraft(ev.target.value)}
                            />
                          </div>
                          <div className="field">
                            <label>
                              Metric
                              <InfoTip text={tooltips["outcome-measurement"]} />
                            </label>
                            <select value={metricDraft} onChange={(ev) => setMetricDraft(ev.target.value as OutcomeMetric)}>
                              {Object.entries(METRIC_LABELS).map(([key, lbl]) => (
                                <option key={key} value={key}>
                                  {lbl}
                                </option>
                              ))}
                            </select>
                          </div>
                          {metricDraft === "categoryAverage" && (
                            <div className="field">
                              <label>Category</label>
                              <select value={categoryDraft} onChange={(ev) => setCategoryDraft(ev.target.value)}>
                                <option value="">Select…</option>
                                {categories.map((c) => (
                                  <option key={c._id} value={c._id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        {measureError && <p className="error-text">{measureError}</p>}
                        {verdict && <p className="callout">{VERDICT_LABELS[verdict] ?? verdict}</p>}
                        <button className="btn btn-dark btn-sm" disabled={measuring} onClick={() => runAutoMeasure(e._id)}>
                          {measuring ? "Measuring…" : "Auto-measure"}
                        </button>{" "}
                        <button className="btn btn-sm" onClick={() => setMeasuringId(null)}>
                          Close
                        </button>

                        <details style={{ marginTop: 10 }}>
                          <summary className="subtitle" style={{ cursor: "pointer" }}>
                            Or enter before/after numbers manually
                          </summary>
                          <div className="field-row" style={{ margin: "8px 0" }}>
                            <div className="field">
                              <label>Outcome before</label>
                              <input
                                type="number"
                                step="0.1"
                                value={outcomeBeforeDraft}
                                onChange={(ev) => setOutcomeBeforeDraft(ev.target.value)}
                              />
                            </div>
                            <div className="field">
                              <label>Outcome after</label>
                              <input
                                type="number"
                                step="0.1"
                                value={outcomeAfterDraft}
                                onChange={(ev) => setOutcomeAfterDraft(ev.target.value)}
                              />
                            </div>
                          </div>
                          <button className="btn btn-sm" onClick={() => saveOutcomeManually(e._id)}>
                            Save manually
                          </button>
                        </details>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {visibleEntries.length === 0 && (
            <div className="ab-empty">{entries.length === 0 ? "No decisions logged yet." : "No decisions with this status."}</div>
          )}
        </div>
      )}
    </div>
  );
}

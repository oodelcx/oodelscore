"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InfoTip } from "@/components/info-tip";

type OutcomeMetric = "starAverage" | "nps" | "categoryAverage";

interface EntryRow {
  _id: string;
  title: string;
  trigger: string;
  product?: "customer_experience" | "colleague_experience";
  status: string;
  ownerId: string | null;
  implementationDate: string | null;
  affectedBusinessIds: string[];
  linkedActionIds: string[];
  outcomeMetricDescription: string;
  outcomeMetric: OutcomeMetric | null;
  outcomeCategoryId: string | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeMeasuredAt: string | null;
}
interface BusinessRow {
  _id: string;
  name: string;
}
interface TeamRow {
  userId: string;
  label: string;
}
interface ActionRow {
  _id: string;
  title: string;
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

export default function DecisionLogClient({ tooltips }: { tooltips: Record<string, string> }) {
  return (
    <Suspense fallback={<p className="subtitle">Loading…</p>}>
      <DecisionLogInner tooltips={tooltips} />
    </Suspense>
  );
}

function DecisionLogInner({ tooltips }: { tooltips: Record<string, string> }) {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [implementationDate, setImplementationDate] = useState("");
  const [affectedBusinessIds, setAffectedBusinessIds] = useState<string[]>([]);
  const [linkedActionIds, setLinkedActionIds] = useState<string[]>([]);
  const [outcomeMetricDescription, setOutcomeMetricDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [beforeDraft, setBeforeDraft] = useState("");
  const [afterDraft, setAfterDraft] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [metricDraft, setMetricDraft] = useState<OutcomeMetric>("starAverage");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [autoMeasuring, setAutoMeasuring] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [measureError, setMeasureError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editImplementationDate, setEditImplementationDate] = useState("");
  const [editOutcomeMetricDescription, setEditOutcomeMetricDescription] = useState("");
  const [editAffectedBusinessIds, setEditAffectedBusinessIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "planned" | "in_progress" | "implemented">("all");
  const [expandedTriggerFor, setExpandedTriggerFor] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [product, setProduct] = useState<"customer_experience" | "colleague_experience">("customer_experience");
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/decision-log").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
      fetch("/api/group/action-board").then((r) => r.json()),
      fetch("/api/group/category-owners").then((r) => r.json()),
    ]).then(([entriesData, businessesData, teamData, actionsData, categoriesData]) => {
      setEntries(entriesData.entries ?? []);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setActions((actionsData.items ?? []).map((i: { _id: string; title: string }) => ({ _id: i._id, title: i.title })));
      setCategories(categoriesData.categories ?? []);
      // /api/group/decision-log already resolves the account's currently-
      // active product tab server-side — read it from here rather than
      // guessing independently, so a new entry lands on whichever tab is
      // actually open.
      if (entriesData.product === "customer_experience" || entriesData.product === "colleague_experience") {
        setProduct(entriesData.product);
      }
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
    fetch("/api/group/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.org?.enabledProducts ?? ["customer_experience"];
        setCxEnabled(products.includes("customer_experience"));
        setCeEnabled(products.includes("colleague_experience"));
      });
  }, []);

  // Pre-fill the "Log a decision" form when arriving from Case Management's
  // pattern-nudge callout, e.g. /group/decision-log?new=1&title=...&trigger=...&linkedCaseId=...
  useEffect(() => {
    if (searchParams?.get("new") !== "1") return;
    const qTitle = searchParams.get("title");
    const qTrigger = searchParams.get("trigger");
    const qLinkedCaseId = searchParams.get("linkedCaseId");
    if (qTitle) setTitle(qTitle);
    if (qTrigger) setTrigger(qTrigger);
    if (qLinkedCaseId) setLinkedActionIds((cur) => (cur.includes(qLinkedCaseId) ? cur : [...cur, qLinkedCaseId]));
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAffected(id: string) {
    setAffectedBusinessIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleLinkedAction(id: string) {
    setLinkedActionIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function createEntry() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/decision-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        trigger,
        ownerId: ownerId || null,
        implementationDate: implementationDate || null,
        affectedBusinessIds,
        linkedActionIds,
        outcomeMetricDescription,
        product,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setTrigger("");
    setOwnerId("");
    setImplementationDate("");
    setAffectedBusinessIds([]);
    setLinkedActionIds([]);
    setOutcomeMetricDescription("");
    setShowForm(false);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/group/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  function startMeasure(entry: EntryRow) {
    setMeasuringId(entry._id);
    setBeforeDraft(entry.outcomeBefore !== null ? String(entry.outcomeBefore) : "");
    setAfterDraft(entry.outcomeAfter !== null ? String(entry.outcomeAfter) : "");
    setMetricDraft(entry.outcomeMetric ?? "starAverage");
    setCategoryDraft(entry.outcomeCategoryId ?? "");
    setVerdict(null);
    setMeasureError(null);
    setEditingId(null);
  }

  async function saveMeasurement(id: string) {
    const body: Record<string, unknown> = {};
    if (beforeDraft.trim()) body.outcomeBefore = Number(beforeDraft);
    if (afterDraft.trim()) body.outcomeAfter = Number(afterDraft);
    await patch(id, body);
    setMeasuringId(null);
  }

  async function runAutoMeasure(entry: EntryRow) {
    if (!entry.implementationDate) {
      setMeasureError("Set an implementation date on this decision first");
      return;
    }
    if (entry.status !== "implemented") {
      setMeasureError("Mark this decision Implemented before measuring its outcome");
      return;
    }
    setAutoMeasuring(true);
    setMeasureError(null);
    const res = await fetch(`/api/group/decision-log/${entry._id}/measure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcomeMetric: metricDraft,
        outcomeCategoryId: metricDraft === "categoryAverage" ? categoryDraft : undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setAutoMeasuring(false);
    if (!res.ok) {
      setMeasureError(data?.message ?? "Failed to measure outcome");
      return;
    }
    setVerdict(data.verdict);
    load();
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this decision log entry?")) return;
    await fetch(`/api/group/decision-log/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(e: EntryRow) {
    setEditingId(e._id);
    setEditTitle(e.title);
    setEditTrigger(e.trigger);
    setEditOwnerId(e.ownerId ?? "");
    setEditImplementationDate(e.implementationDate ? e.implementationDate.slice(0, 10) : "");
    setEditOutcomeMetricDescription(e.outcomeMetricDescription);
    setEditAffectedBusinessIds(e.affectedBusinessIds);
    setMeasuringId(null);
  }

  function toggleEditAffected(id: string) {
    setEditAffectedBusinessIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    await patch(id, {
      title: editTitle.trim(),
      trigger: editTrigger,
      ownerId: editOwnerId || null,
      implementationDate: editImplementationDate || null,
      outcomeMetricDescription: editOutcomeMetricDescription,
      affectedBusinessIds: editAffectedBusinessIds,
    });
    setEditingId(null);
  }

  function businessName(id: string) {
    return businesses.find((b) => b._id === id)?.name ?? "—";
  }
  function ownerLabel(id: string | null) {
    if (!id) return "Unassigned";
    return team.find((t) => t.userId === id)?.label ?? "—";
  }
  function linkedActionTitle(id: string) {
    return actions.find((a) => a._id === id)?.title ?? "—";
  }

  function outcomeDelta(e: EntryRow): { text: string; positive: boolean } | null {
    if (e.outcomeBefore === null || e.outcomeAfter === null) return null;
    return { text: `${e.outcomeBefore} → ${e.outcomeAfter}`, positive: e.outcomeAfter > e.outcomeBefore };
  }

  const visibleEntries = entries.filter((e) => statusFilter === "all" || e.status === statusFilter);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Decision Log
            <InfoTip text={tooltips["decision-log"]} />
          </h1>
          <p className="subtitle">
            What actually changed because of what customers told you, and whether it worked. For a genuine management
            decision, not a routine case — a recurring pattern across several branches belongs in Improvement
            Initiatives instead.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button className="btn btn-dark" data-tour="dl-new-button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New decision"}
          </button>
        </div>
      </div>

      {showForm && (
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Log a decision</h3>
        {linkedActionIds.length > 0 && searchParams?.get("new") === "1" && (
          <p className="card-sub">Pre-filled from a Case Management playbook — this entry will link back to that case.</p>
        )}
        <div className="field-row">
          <div className="field">
            <label>Decision title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Added a second till at peak hours" />
          </div>
          <div className="field">
            <label>Decision owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {cxEnabled && ceEnabled && (
            <div className="field">
              <label>Product</label>
              <select value={product} onChange={(e) => setProduct(e.target.value as "customer_experience" | "colleague_experience")}>
                <option value="customer_experience">Customer Experience</option>
                <option value="colleague_experience">Colleague Experience</option>
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <label>
            Trigger — what feedback pattern prompted this
            <InfoTip text={tooltips["trigger"]} />
          </label>
          <textarea value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. Value category down 0.6 pts network-wide" />
        </div>
        <div className="field">
          <label>Branches affected</label>
          <div className="chip-select">
            {businesses.map((b) => (
              <div
                key={b._id}
                className={`chip ${affectedBusinessIds.includes(b._id) ? "active" : ""}`}
                onClick={() => toggleAffected(b._id)}
              >
                {b.name}
              </div>
            ))}
            {businesses.length === 0 && <span className="subtitle">No branches yet.</span>}
          </div>
        </div>
        <div className="field">
          <label>Linked cases (optional)</label>
          <div className="chip-select">
            {actions.slice(0, 20).map((a) => (
              <div
                key={a._id}
                className={`chip ${linkedActionIds.includes(a._id) ? "active" : ""}`}
                onClick={() => toggleLinkedAction(a._id)}
              >
                {a.title}
              </div>
            ))}
            {actions.length === 0 && <span className="subtitle">No cases to link yet.</span>}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Implementation date</label>
            <input type="date" value={implementationDate} onChange={(e) => setImplementationDate(e.target.value)} />
          </div>
          <div className="field">
            <label>How will you know it worked?</label>
            <input
              value={outcomeMetricDescription}
              onChange={(e) => setOutcomeMetricDescription(e.target.value)}
              placeholder="e.g. Value category average, checked again in 4 weeks"
            />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-dark" disabled={creating} onClick={createEntry}>
            {creating ? "Logging…" : "+ Log decision"}
          </button>
          <button className="btn" onClick={() => setShowForm(false)} disabled={creating}>
            Cancel
          </button>
        </div>
      </div>
      )}

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
          {visibleEntries.map((e, index) => {
            const delta = outcomeDelta(e);
            const triggerExpanded = expandedTriggerFor === e._id;
            const triggerIsLong = e.trigger.length > 160;
            return (
              <div className="card ab-card" data-tour={index === 0 ? "dl-first-card" : undefined} key={e._id}>
                {editingId === e._id ? (
                  <div className="ab-panel" style={{ margin: 0 }}>
                    <div className="field-row">
                      <div className="field">
                        <label>Decision title</label>
                        <input value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)} />
                      </div>
                      <div className="field">
                        <label>Decision owner</label>
                        <select value={editOwnerId} onChange={(ev) => setEditOwnerId(ev.target.value)}>
                          <option value="">Unassigned</option>
                          {team.map((t) => (
                            <option key={t.userId} value={t.userId}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field">
                      <label>Trigger</label>
                      <textarea value={editTrigger} onChange={(ev) => setEditTrigger(ev.target.value)} />
                    </div>
                    <div className="field">
                      <label>Branches affected</label>
                      <div className="chip-select">
                        {businesses.map((b) => (
                          <div
                            key={b._id}
                            className={`chip ${editAffectedBusinessIds.includes(b._id) ? "active" : ""}`}
                            onClick={() => toggleEditAffected(b._id)}
                          >
                            {b.name}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label>Implementation date</label>
                        <input type="date" value={editImplementationDate} onChange={(ev) => setEditImplementationDate(ev.target.value)} />
                      </div>
                      <div className="field">
                        <label>How will you know it worked?</label>
                        <input value={editOutcomeMetricDescription} onChange={(ev) => setEditOutcomeMetricDescription(ev.target.value)} />
                      </div>
                    </div>
                    <button className="btn btn-dark btn-sm" onClick={() => saveEdit(e._id)}>
                      Save changes
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
                          {cxEnabled && ceEnabled && (
                            <span className={`pill ${e.product === "colleague_experience" ? "pill-blue" : "pill-gray"}`}>
                              {e.product === "colleague_experience" ? "Colleague" : "Customer"}
                            </span>
                          )}
                          <span className={`pill ${e.status === "implemented" ? "pill-green" : e.status === "in_progress" ? "pill-amber" : "pill-gray"}`}>
                            {STATUS_LABELS[e.status] ?? e.status}
                          </span>
                          {delta && (
                            <span className={`pill ${delta.positive ? "pill-green" : "pill-red"}`}>
                              {delta.positive ? "Improved" : "Declined"}
                            </span>
                          )}
                        </div>
                        <div className="ab-title">{e.title}</div>
                        <div className="ab-meta-row">
                          <span>
                            Implemented: <b>{e.implementationDate ? new Date(e.implementationDate).toLocaleDateString() : "No date set"}</b>
                          </span>
                          <span>
                            Owner: <b>{ownerLabel(e.ownerId)}</b>
                          </span>
                          <span>
                            Status:{" "}
                            <select value={e.status} onChange={(ev) => patch(e._id, { status: ev.target.value })} style={{ marginLeft: 4 }}>
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
                          <b>Affected:</b>{" "}
                          {e.affectedBusinessIds.length > 0 ? e.affectedBusinessIds.map(businessName).join(", ") : "Not specified"}
                        </div>
                        {e.linkedActionIds.length > 0 && (
                          <div className="ab-callout">
                            <b>Linked cases:</b> {e.linkedActionIds.map(linkedActionTitle).join(", ")}
                          </div>
                        )}
                        <div className="ab-callout">
                          <b>
                            Outcome:
                            <InfoTip text={tooltips["outcome-measurement"]} />
                          </b>{" "}
                          {delta
                            ? `${e.outcomeMetricDescription || "Score"} ${delta.text}`
                            : e.outcomeMetricDescription
                              ? `Measuring: ${e.outcomeMetricDescription}`
                              : "Not measured yet"}
                        </div>
                      </div>
                    </div>

                    <div className="action-links">
                      <button type="button" className="btn btn-sm action-btn" onClick={() => startEdit(e)}>
                        ✎ Edit
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm action-btn${measuringId === e._id ? " active" : ""}`}
                        onClick={() => (measuringId === e._id ? setMeasuringId(null) : startMeasure(e))}
                      >
                        📏 {delta ? "Update measurement" : "Record measurement"}
                      </button>
                      <button type="button" className="icon-btn btn-danger" onClick={() => removeEntry(e._id)}>
                        🗑
                      </button>
                    </div>

                    {measuringId === e._id && (
                      <div className="ab-panel">
                        <p className="card-sub" style={{ marginTop: 0 }}>
                          Pick what to measure — OodelCX compares the average across everyone who responded in the 30 days
                          before implementation to everyone who&apos;s responded since, using real feedback data. This
                          tracks whether the metric moved overall, not whether any one customer&apos;s complaint was
                          personally resolved — most feedback is anonymous. Needs at least 14 days since implementation;
                          once eligible, this also gets checked automatically once a day.
                        </p>
                        <div className="field-row">
                          <div className="field">
                            <label>Metric</label>
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
                        {e.status !== "implemented" && (
                          <p className="subtitle" style={{ margin: "0 0 8px" }}>
                            Set the status to <b>Implemented</b> before measuring — that&apos;s what starts the
                            14-day clock.
                          </p>
                        )}
                        {measureError && <p className="error-text">{measureError}</p>}
                        {verdict && <p className="callout">{VERDICT_LABELS[verdict] ?? verdict}</p>}
                        <button className="btn btn-dark btn-sm" disabled={autoMeasuring} onClick={() => runAutoMeasure(e)}>
                          {autoMeasuring ? "Measuring…" : "Auto-measure"}
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
                              <label>Before</label>
                              <input type="number" step="0.01" value={beforeDraft} onChange={(ev) => setBeforeDraft(ev.target.value)} />
                            </div>
                            <div className="field">
                              <label>After</label>
                              <input type="number" step="0.01" value={afterDraft} onChange={(ev) => setAfterDraft(ev.target.value)} />
                            </div>
                          </div>
                          <button className="btn btn-sm" onClick={() => saveMeasurement(e._id)}>
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

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InfoTip } from "@/components/info-tip";
import { DetailDrawer, NotesThread } from "@/components/detail-drawer";

type OutcomeMetric = "starAverage" | "nps" | "categoryAverage" | "csat" | "ces";

interface EntryRow {
  _id: string;
  title: string;
  trigger: string;
  product?: "customer_experience" | "colleague_experience";
  status: string;
  implementationDate: string | null;
  outcomeMetricDescription: string;
  outcomeMetric: OutcomeMetric | null;
  outcomeCategoryId: string | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeSampleSizeBefore: number | null;
  outcomeSampleSizeAfter: number | null;
  outcomeLowConfidence: boolean;
  ownerId: string | null;
  linkedInitiativeId: string | null;
  notes: { text: string; authorLabel: string; createdAt: string }[];
}

interface CategoryOption {
  _id: string;
  name: string;
  product?: "customer_experience" | "colleague_experience";
}

interface TeamRow {
  userId: string;
  label: string;
}

const METRIC_LABELS: Record<OutcomeMetric, string> = {
  starAverage: "Overall score (stars)",
  nps: "NPS",
  categoryAverage: "Category score",
  csat: "CSAT (% satisfied)",
  ces: "CES (% low effort)",
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
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [implementationDate, setImplementationDate] = useState("");
  const [outcomeMetricDescription, setOutcomeMetricDescription] = useState("");
  const [linkedCaseId, setLinkedCaseId] = useState<string | null>(null);
  const [linkedInitiativeId, setLinkedInitiativeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [implementationDateDraft, setImplementationDateDraft] = useState("");
  const [outcomeMetricDescriptionDraft, setOutcomeMetricDescriptionDraft] = useState("");
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
  const [showForm, setShowForm] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [product, setProduct] = useState<"customer_experience" | "colleague_experience">("customer_experience");
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/business/decision-log")
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setReadOnly(!!data.readOnly);
        // The GET route already resolves the account's currently-active
        // product tab server-side — read it from here instead of guessing
        // independently, so a new entry lands on whichever tab is open.
        if (data.product === "customer_experience" || data.product === "colleague_experience") {
          setProduct(data.product);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/business/category-owners")
      .then((res) => res.json())
      .then((d) => setCategories(d.categories ?? []));
    fetch("/api/business/team")
      .then((res) => res.json())
      .then((d) => setTeam(d.team ?? []));
    fetch("/api/business/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.business?.enabledProducts ?? ["customer_experience"];
        setCxEnabled(products.includes("customer_experience"));
        setCeEnabled(products.includes("colleague_experience"));
      });
  }, []);

  // Pre-fill the "New entry" form when arriving from Case Management's
  // pattern-nudge callout, e.g. /business/decision-log?new=1&title=...&trigger=...&linkedCaseId=...
  useEffect(() => {
    if (searchParams?.get("new") !== "1") return;
    const qTitle = searchParams.get("title");
    const qTrigger = searchParams.get("trigger");
    const qLinkedCaseId = searchParams.get("linkedCaseId");
    const qLinkedInitiativeId = searchParams.get("linkedInitiativeId");
    if (qTitle) setTitle(qTitle);
    if (qTrigger) setTrigger(qTrigger);
    if (qLinkedCaseId) setLinkedCaseId(qLinkedCaseId);
    if (qLinkedInitiativeId) setLinkedInitiativeId(qLinkedInitiativeId);
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEntry() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/decision-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        trigger,
        ownerId: ownerId || null,
        implementationDate: implementationDate || null,
        outcomeMetricDescription,
        linkedActionIds: linkedCaseId ? [linkedCaseId] : [],
        linkedInitiativeId,
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
    setOutcomeMetricDescription("");
    setLinkedCaseId(null);
    setLinkedInitiativeId(null);
    setShowForm(false);
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
    setOutcomeMetricDescriptionDraft(entry.outcomeMetricDescription ?? "");
    setMetricDraft(entry.outcomeMetric ?? "starAverage");
    setCategoryDraft(entry.outcomeCategoryId ?? "");
    setOutcomeBeforeDraft(entry.outcomeBefore !== null ? String(entry.outcomeBefore) : "");
    setOutcomeAfterDraft(entry.outcomeAfter !== null ? String(entry.outcomeAfter) : "");
    setVerdict(null);
    setMeasureError(null);
    setEditingId(null);
  }

  async function runAutoMeasure(id: string, status: string) {
    if (!implementationDateDraft) {
      setMeasureError("Set the implementation date first");
      return;
    }
    if (status !== "implemented") {
      setMeasureError("Mark this decision Implemented before measuring its outcome");
      return;
    }
    setMeasuring(true);
    setMeasureError(null);
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ implementationDate: implementationDateDraft, outcomeMetricDescription: outcomeMetricDescriptionDraft }),
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

  function ownerLabel(id: string | null) {
    if (!id) return "Unassigned";
    return team.find((t) => t.userId === id)?.label ?? "Unassigned";
  }

  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function addNote(id: string) {
    if (!noteDraft.trim()) return;
    setAddingNote(true);
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addNote: noteDraft.trim() }),
    });
    setNoteDraft("");
    setAddingNote(false);
    load();
  }

  const visibleEntries = entries.filter((e) => statusFilter === "all" || e.status === statusFilter);
  const openRow = openId ? entries.find((e) => e._id === openId) ?? null : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Decision Log</h1>
          <p className="subtitle">
            {readOnly
              ? "Managed by your parent organization — shown here read-only when it affects this branch."
              : "For a genuine management decision, not a routine case resolution — log it here deliberately, then measure whether it moved the metric. Routine cases stay in Case Management; a recurring pattern across several belongs in Improvement Initiatives instead."}
          </p>
        </div>
        {!readOnly && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <button className="btn btn-dark" data-tour="dl-new-button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "+ New decision"}
            </button>
          </div>
        )}
      </div>

      {!readOnly && showForm && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>New entry</h3>
          {linkedCaseId && <p className="card-sub">Pre-filled from a Case Management playbook — this entry will link back to that case.</p>}
          {linkedInitiativeId && (
            <p className="card-sub">Pre-filled from an Improvement Initiative's "Log outcome" — this entry will link back to it.</p>
          )}
          <div className="field-row">
            <div className="field">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Owner</label>
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
              Trigger
              <InfoTip text={tooltips["trigger"]} />
            </label>
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Implementation date (optional)</label>
              <input type="date" value={implementationDate} onChange={(e) => setImplementationDate(e.target.value)} />
            </div>
            <div className="field">
              <label>How will you know it worked?</label>
              <input
                value={outcomeMetricDescription}
                onChange={(e) => setOutcomeMetricDescription(e.target.value)}
                placeholder="e.g. Cleanliness category average, checked again in 4 weeks"
              />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dark" disabled={creating} onClick={createEntry}>
              {creating ? "Creating…" : "+ Log decision"}
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
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {visibleEntries.map((e, index) => {
            const delta = outcomeDelta(e);
            return (
              <div
                className="summary-card"
                data-tour={index === 0 ? "dl-first-card" : undefined}
                key={e._id}
                onClick={() => {
                  setOpenId(e._id);
                  setNoteDraft("");
                }}
              >
                <div className="badge-row" style={{ marginBottom: 8 }}>
                  {cxEnabled && ceEnabled && (
                    <span className={`pill ${e.product === "colleague_experience" ? "pill-blue" : "pill-gray"}`}>
                      {e.product === "colleague_experience" ? "Colleague" : "Customer"}
                    </span>
                  )}
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
                <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{e.title}</div>
                <div className="subtitle" style={{ margin: "0 0 8px" }}>
                  Owner: <b style={{ color: "var(--text-1)" }}>{ownerLabel(e.ownerId)}</b>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  <b>Outcome:</b>{" "}
                  {e.outcomeBefore !== null && e.outcomeAfter !== null
                    ? `${e.outcomeMetricDescription || "Score"} ${e.outcomeBefore} → ${e.outcomeAfter}`
                    : e.outcomeMetricDescription
                      ? `Measuring: ${e.outcomeMetricDescription}`
                      : "not measured yet"}
                </div>
                {e.notes.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-3)" }}>
                    {e.notes.length} note{e.notes.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            );
          })}
          {visibleEntries.length === 0 && (
            <div className="ab-empty">{entries.length === 0 ? "No decisions logged yet." : "No decisions with this status."}</div>
          )}
        </div>
      )}

      <DetailDrawer open={!!openRow} onClose={() => setOpenId(null)} title={openRow?.title ?? ""}>
        {openRow &&
          (() => {
            const e = openRow;
            const delta = outcomeDelta(e);
            return (
              <div>
                {editingId === e._id ? (
                  <div className="ab-panel" style={{ margin: 0 }}>
                    <div className="field">
                      <label>Title</label>
                      <input value={titleDraft} onChange={(ev) => setTitleDraft(ev.target.value)} />
                    </div>
                    <div className="field">
                      <label>Trigger</label>
                      <input value={triggerDraft} onChange={(ev) => setTriggerDraft(ev.target.value)} />
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
                    <div className="ab-meta-row" style={{ marginBottom: 10 }}>
                      <span>
                        Owner: <b>{ownerLabel(e.ownerId)}</b>
                      </span>
                      <span>
                        Status:{" "}
                        {readOnly ? (
                          STATUS_LABELS[e.status] ?? e.status
                        ) : (
                          <select value={e.status} onChange={(ev) => updateStatus(e._id, ev.target.value)} style={{ marginLeft: 4 }}>
                            <option value="planned">Planned</option>
                            <option value="in_progress">In progress</option>
                            <option value="implemented">Implemented</option>
                          </select>
                        )}
                      </span>
                    </div>
                    {e.trigger && (
                      <div className="ab-desc" style={{ marginBottom: 10 }}>
                        <b>Trigger:</b> {e.trigger}
                      </div>
                    )}
                    <div className="ab-callout">
                      <b>Outcome:</b>{" "}
                      {e.outcomeBefore !== null && e.outcomeAfter !== null
                        ? `${e.outcomeMetricDescription || "Score"} ${e.outcomeBefore} → ${e.outcomeAfter} (${delta})`
                        : e.outcomeMetricDescription
                          ? `Measuring: ${e.outcomeMetricDescription}`
                          : "not measured yet"}
                      {e.outcomeBefore !== null && e.outcomeAfter !== null && e.outcomeLowConfidence && (
                        <span
                          className="pill pill-gray"
                          style={{ marginLeft: 6, fontSize: 10 }}
                          title={`Built from a small sample — ${e.outcomeSampleSizeBefore ?? 0} response(s) before, ${e.outcomeSampleSizeAfter ?? 0} after. Treat this verdict as low-confidence.`}
                        >
                          low sample
                        </span>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="action-links" style={{ marginTop: 12 }}>
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
                        {e.outcomeBefore !== null && e.outcomeAfter !== null && e.product === "colleague_experience" && (
                          <a
                            className="btn btn-sm action-btn"
                            href={`/business/closing-the-loop?new=1&title=${encodeURIComponent(e.title)}&whatWeHeard=${encodeURIComponent(e.trigger)}&whatWereDoing=${encodeURIComponent(`${e.title} — measured outcome: ${e.outcomeMetricDescription || "score"} moved from ${e.outcomeBefore} to ${e.outcomeAfter}.`)}&linkedDecisionId=${e._id}`}
                            title="Post a &quot;you said, we did&quot; update to your Colleague Experience roster"
                          >
                            Close the loop →
                          </a>
                        )}
                        <button
                          type="button"
                          className="icon-btn btn-danger"
                          onClick={() => {
                            removeEntry(e._id);
                            setOpenId(null);
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    )}

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
                        <div className="field">
                          <label>How will you know it worked?</label>
                          <input
                            value={outcomeMetricDescriptionDraft}
                            onChange={(ev) => setOutcomeMetricDescriptionDraft(ev.target.value)}
                            placeholder="e.g. Cleanliness category average, checked again in 4 weeks"
                          />
                        </div>
                        {e.status !== "implemented" && (
                          <p className="subtitle" style={{ margin: "8px 0 0" }}>
                            Set the status above to <b>Implemented</b> before measuring — that&apos;s what starts the
                            14-day clock.
                          </p>
                        )}
                        {measureError && <p className="error-text">{measureError}</p>}
                        {verdict && <p className="callout">{VERDICT_LABELS[verdict] ?? verdict}</p>}
                        <button className="btn btn-dark btn-sm" disabled={measuring} onClick={() => runAutoMeasure(e._id, e.status)}>
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
                    <div style={{ marginTop: 18 }}>
                      <NotesThread notes={e.notes} draft={noteDraft} onDraftChange={setNoteDraft} onSubmit={() => addNote(e._id)} submitting={addingNote} />
                    </div>
                  </>
                )}
              </div>
            );
          })()}
      </DetailDrawer>
    </div>
  );
}

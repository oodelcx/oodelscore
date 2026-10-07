"use client";

import { makeWording } from "@/lib/wordingPick";
import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { DetailDrawer, NotesThread } from "@/components/detail-drawer";

interface InitiativeRow {
  _id: string;
  title: string;
  description: string;
  product?: "customer_experience" | "colleague_experience";
  status: string;
  ownerId: string | null;
  baselineMetricDescription: string;
  baselineValue: number | null;
  targetValue: number | null;
  startedAt: string | null;
  completedAt: string | null;
  linkedActionIds: string[];
  notes: { text: string; authorLabel: string; createdAt: string }[];
  linkedDecision: {
    _id: string;
    title: string;
    status: string;
    outcomeBefore: number | null;
    outcomeAfter: number | null;
    outcomeMetricDescription: string;
    closingLoop: { _id: string; title: string; status: string; sentAt: string | null } | null;
  } | null;
}

interface TeamRow {
  userId: string;
  label: string;
}

interface CaseOption {
  _id: string;
  title: string;
}

interface RecurringFlagRow {
  _id: string;
  categoryName: string;
  count: number;
  windowDays: number;
  actionable: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
};

function progressLabel(row: InitiativeRow): string | null {
  if (row.baselineValue === null || row.targetValue === null) return null;
  return `${row.baselineValue} → target ${row.targetValue}`;
}

/**
 * The systemic counterpart to Case Management: a pattern across several
 * cases ("waiting time is repeatedly poor"), not one customer's complaint.
 * Same shape as Decision Log — list, filter by status, create, measure
 * progress toward a baseline/target — but this is the thing with an owner
 * and a target, kept separate from the routine cases that revealed it.
 */
export default function BusinessImprovementInitiativesClient({ tooltips, wording }: { tooltips: Record<string, string>; wording: Record<string, string> }) {
  const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "planned" | "in_progress" | "completed">("all");
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [baselineMetricDescription, setBaselineMetricDescription] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [baselineDraft, setBaselineDraft] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [linkedCasesDraft, setLinkedCasesDraft] = useState<string[]>([]);

  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);

  const [flags, setFlags] = useState<RecurringFlagRow[]>([]);
  const [convertingFlagId, setConvertingFlagId] = useState<string | null>(null);
  const [product, setProduct] = useState<"customer_experience" | "colleague_experience">("customer_experience");
  const w = makeWording(product === "colleague_experience", wording);
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);

  function loadFlags() {
    fetch("/api/business/recurring-issues")
      .then((r) => r.json())
      .then((d) => setFlags(d.flags ?? []))
      .catch(() => setFlags([]));
  }

  async function convertFlag(id: string) {
    setConvertingFlagId(id);
    await fetch(`/api/business/recurring-issues/${id}/convert`, { method: "POST" });
    setConvertingFlagId(null);
    loadFlags();
    load();
  }

  async function dismissFlag(id: string) {
    setConvertingFlagId(id);
    await fetch(`/api/business/recurring-issues/${id}/dismiss`, { method: "POST" });
    setConvertingFlagId(null);
    loadFlags();
  }

  function load() {
    setLoading(true);
    fetch("/api/business/improvement-initiatives")
      .then((res) => res.json())
      .then((data) => {
        setInitiatives(data.initiatives ?? []);
        setReadOnly(!!data.readOnly);
        // The GET route already resolves the account's currently-active
        // product tab server-side (resolveViewProduct) — read it from here
        // rather than guessing independently from enabledProducts, so a new
        // initiative created from this form lands on whichever tab is
        // actually open instead of silently defaulting to Customer
        // Experience on a dual-product account.
        if (data.product === "customer_experience" || data.product === "colleague_experience") {
          setProduct(data.product);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    loadFlags();
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
    // For linking a case at create/edit time — the same product-scoped
    // Case Management list this account already sees.
    fetch("/api/business/action-board")
      .then((r) => r.json())
      .then((d) => setCaseOptions((d.items ?? []).map((i: { _id: string; title: string }) => ({ _id: i._id, title: i.title }))))
      .catch(() => setCaseOptions([]));
  }, []);

  function toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  async function createInitiative() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/improvement-initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        ownerId: ownerId || null,
        baselineMetricDescription,
        baselineValue: baselineValue.trim() ? Number(baselineValue) : null,
        targetValue: targetValue.trim() ? Number(targetValue) : null,
        product,
        linkedActionIds: selectedCaseIds,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setDescription("");
    setOwnerId("");
    setBaselineMetricDescription("");
    setBaselineValue("");
    setTargetValue("");
    setSelectedCaseIds([]);
    setShowForm(false);
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/business/improvement-initiatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function removeInitiative(id: string) {
    if (!confirm("Delete this improvement initiative?")) return;
    await fetch(`/api/business/improvement-initiatives/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(row: InitiativeRow) {
    setEditingId(row._id);
    setTitleDraft(row.title);
    setDescriptionDraft(row.description);
    setBaselineDraft(row.baselineValue !== null ? String(row.baselineValue) : "");
    setTargetDraft(row.targetValue !== null ? String(row.targetValue) : "");
    setLinkedCasesDraft(row.linkedActionIds);
  }

  async function saveEdit(id: string) {
    if (!titleDraft.trim()) return;
    await fetch(`/api/business/improvement-initiatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleDraft.trim(),
        description: descriptionDraft,
        baselineValue: baselineDraft.trim() ? Number(baselineDraft) : undefined,
        targetValue: targetDraft.trim() ? Number(targetDraft) : undefined,
        linkedActionIds: linkedCasesDraft,
      }),
    });
    setEditingId(null);
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
    await fetch(`/api/business/improvement-initiatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addNote: noteDraft.trim() }),
    });
    setNoteDraft("");
    setAddingNote(false);
    load();
  }

  const visible = initiatives.filter((i) => statusFilter === "all" || i.status === statusFilter);
  const openRow = openId ? initiatives.find((i) => i._id === openId) ?? null : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Improvement Initiatives
            <InfoTip text={tooltips["improvement-initiatives"]} />
          </h1>
          <p className="subtitle">
            {readOnly
              ? "Managed by your parent organization — shown here read-only when it affects this branch."
              : w("initiatives-intro", "For a pattern across several cases, not one customer's complaint — a systemic fix with its own owner, baseline, and target. Individual cases stay in Case Management; link them here once you spot the pattern.")}
          </p>
        </div>
        {!readOnly && (
          <button className="btn btn-dark" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New initiative"}
          </button>
        )}
      </div>

      {flags.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--amber, #E0A100)" }}>
          <h3 style={{ margin: "0 0 4px" }}>Suggested — recurring patterns</h3>
          <p className="card-sub" style={{ margin: "0 0 10px" }}>
            The same category keeps coming up in Case Management. Review and turn it into a tracked initiative, or
            dismiss it if it&rsquo;s not worth one right now.
          </p>
          {flags.map((f) => (
            <div
              key={f._id}
              className="field-row"
              style={{ alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)" }}
            >
              <div>
                <b>{f.categoryName}</b> — {f.count} cases in the last {f.windowDays} days
                {!f.actionable && <span className="subtitle"> · handled by your parent organization</span>}
              </div>
              {f.actionable && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-dark" disabled={convertingFlagId === f._id} onClick={() => convertFlag(f._id)}>
                    {convertingFlagId === f._id ? "…" : "Create initiative from this"}
                  </button>
                  <button className="btn btn-sm" disabled={convertingFlagId === f._id} onClick={() => dismissFlag(f._id)}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && showForm && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>New initiative</h3>
          <div className="field-row">
            <div className="field">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reduce peak-hour wait times" />
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
            <label>What's the pattern?</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Wait-time complaints repeated across the last 6 weeks"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Metric you're tracking</label>
              <input
                value={baselineMetricDescription}
                onChange={(e) => setBaselineMetricDescription(e.target.value)}
                placeholder="e.g. Average wait-time rating"
              />
            </div>
            <div className="field">
              <label>Baseline (current)</label>
              <input type="number" step="0.1" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)} />
            </div>
            <div className="field">
              <label>Target</label>
              <input type="number" step="0.1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </div>
          </div>
          {caseOptions.length > 0 && (
            <div className="field">
              <label>Link the cases that revealed this pattern</label>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: 8 }}>
                {caseOptions.map((c) => (
                  <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      checked={selectedCaseIds.includes(c._id)}
                      onChange={() => setSelectedCaseIds((prev) => toggleId(prev, c._id))}
                    />
                    {c.title}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dark" disabled={creating} onClick={createInitiative}>
              {creating ? "Creating…" : "+ Create initiative"}
            </button>
            <button className="btn" onClick={() => setShowForm(false)} disabled={creating}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!loading && initiatives.length > 0 && (
        <div className="filters">
          {(["all", "planned", "in_progress", "completed"] as const).map((s) => {
            const count = s === "all" ? initiatives.length : initiatives.filter((i) => i.status === s).length;
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
          {visible.map((row) => (
            <div
              className="summary-card"
              key={row._id}
              onClick={() => {
                setOpenId(row._id);
                setNoteDraft("");
              }}
            >
              <div className="badge-row" style={{ marginBottom: 8 }}>
                {cxEnabled && ceEnabled && (
                  <span className={`pill ${row.product === "colleague_experience" ? "pill-blue" : "pill-gray"}`}>
                    {row.product === "colleague_experience" ? "Colleague" : "Customer"}
                  </span>
                )}
                <span className={`pill ${row.status === "completed" ? "pill-green" : row.status === "in_progress" ? "pill-amber" : "pill-gray"}`}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{row.title}</div>
              <div className="subtitle" style={{ margin: "0 0 8px" }}>
                Owner: <b style={{ color: "var(--text-1)" }}>{ownerLabel(row.ownerId)}</b>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                <b>{row.baselineMetricDescription || "Metric"}:</b> {progressLabel(row) ?? "no baseline/target set yet"}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 11.5, color: "var(--text-3)" }}>
                {row.linkedActionIds.length > 0 && <span>{row.linkedActionIds.length} case{row.linkedActionIds.length === 1 ? "" : "s"}</span>}
                {row.notes.length > 0 && <span>{row.notes.length} note{row.notes.length === 1 ? "" : "s"}</span>}
                {row.linkedDecision && <span>→ Decision Log</span>}
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="ab-empty">
              {initiatives.length === 0 ? "No improvement initiatives yet." : "No initiatives with this status."}
            </div>
          )}
        </div>
      )}

      <DetailDrawer open={!!openRow} onClose={() => setOpenId(null)} title={openRow?.title ?? ""}>
        {openRow && (
          <div>
            {editingId === openRow._id ? (
              <div className="ab-panel" style={{ margin: 0 }}>
                <div className="field">
                  <label>Title</label>
                  <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
                </div>
                <div className="field">
                  <label>What's the pattern?</label>
                  <input value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Baseline</label>
                    <input type="number" step="0.1" value={baselineDraft} onChange={(e) => setBaselineDraft(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Target</label>
                    <input type="number" step="0.1" value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} />
                  </div>
                </div>
                {caseOptions.length > 0 && (
                  <div className="field">
                    <label>Linked cases</label>
                    <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: 8 }}>
                      {caseOptions.map((c) => (
                        <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 13.5 }}>
                          <input
                            type="checkbox"
                            checked={linkedCasesDraft.includes(c._id)}
                            onChange={() => setLinkedCasesDraft((prev) => toggleId(prev, c._id))}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn btn-dark btn-sm" onClick={() => saveEdit(openRow._id)}>
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
                    Owner: <b>{ownerLabel(openRow.ownerId)}</b>
                  </span>
                  <span>
                    Status:{" "}
                    {readOnly ? (
                      STATUS_LABELS[openRow.status] ?? openRow.status
                    ) : (
                      <select value={openRow.status} onChange={(e) => updateStatus(openRow._id, e.target.value)} style={{ marginLeft: 4 }}>
                        <option value="planned">Planned</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    )}
                  </span>
                </div>
                {openRow.description && (
                  <div className="ab-desc" style={{ marginBottom: 10 }}>
                    <b>Pattern:</b> {openRow.description}
                  </div>
                )}
                <div className="ab-callout">
                  <b>{openRow.baselineMetricDescription || "Metric"}:</b> {progressLabel(openRow) ?? "no baseline/target set yet"}
                </div>
                {openRow.linkedDecision && (
                  <div className="ab-callout" style={{ marginTop: 8 }}>
                    <b>Decision Log:</b> {openRow.linkedDecision.title} ({STATUS_LABELS[openRow.linkedDecision.status] ?? openRow.linkedDecision.status})
                    {openRow.linkedDecision.outcomeBefore !== null && openRow.linkedDecision.outcomeAfter !== null && (
                      <>
                        {" — "}
                        {openRow.linkedDecision.outcomeMetricDescription || "score"} {openRow.linkedDecision.outcomeBefore} →{" "}
                        {openRow.linkedDecision.outcomeAfter}
                      </>
                    )}
                    {openRow.linkedDecision.closingLoop && (
                      <>
                        {" · "}
                        <b>Closing the Loop:</b> {openRow.linkedDecision.closingLoop.title} (
                        {openRow.linkedDecision.closingLoop.status === "sent" ? "sent" : "draft"})
                      </>
                    )}
                  </div>
                )}
                {!readOnly && (
                  <div className="action-links" style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-sm action-btn" onClick={() => startEdit(openRow)}>
                      ✎ Edit
                    </button>
                    {!openRow.linkedDecision && (
                      <a
                        className="btn btn-sm action-btn"
                        href={`/business/decision-log?new=1&title=${encodeURIComponent(openRow.title)}&trigger=${encodeURIComponent(openRow.description)}&linkedInitiativeId=${openRow._id}`}
                      >
                        Log outcome →
                      </a>
                    )}
                    <button
                      type="button"
                      className="icon-btn btn-danger"
                      onClick={() => {
                        removeInitiative(openRow._id);
                        setOpenId(null);
                      }}
                    >
                      🗑
                    </button>
                  </div>
                )}
                <div style={{ marginTop: 18 }}>
                  <NotesThread
                    notes={openRow.notes}
                    draft={noteDraft}
                    onDraftChange={setNoteDraft}
                    onSubmit={() => addNote(openRow._id)}
                    submitting={addingNote}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

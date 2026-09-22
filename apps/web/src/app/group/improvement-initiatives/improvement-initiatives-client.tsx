"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

interface InitiativeRow {
  _id: string;
  title: string;
  description: string;
  status: string;
  ownerId: string | null;
  affectedBusinessIds: string[];
  linkedActionIds: string[];
  baselineMetricDescription: string;
  baselineValue: number | null;
  targetValue: number | null;
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
interface RecurringFlagRow {
  _id: string;
  categoryName: string;
  count: number;
  windowDays: number;
  businessIds: string[];
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
 * The systemic counterpart to Case Management, at group scope: a pattern
 * across several branches' cases ("waiting time is repeatedly poor across 8
 * branches"), tracked under one owner and one measured target — separate
 * from the Decision Log, which records that management chose a change, not
 * the operational program behind it.
 */
export default function GroupImprovementInitiativesClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "planned" | "in_progress" | "completed">("all");
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [affectedBusinessIds, setAffectedBusinessIds] = useState<string[]>([]);
  const [linkedActionIds, setLinkedActionIds] = useState<string[]>([]);
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

  const [flags, setFlags] = useState<RecurringFlagRow[]>([]);
  const [convertingFlagId, setConvertingFlagId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/improvement-initiatives").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
      fetch("/api/group/action-board").then((r) => r.json()),
    ]).then(([initiativesData, businessesData, teamData, actionsData]) => {
      setInitiatives(initiativesData.initiatives ?? []);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setActions((actionsData.items ?? []).map((i: { _id: string; title: string }) => ({ _id: i._id, title: i.title })));
      setLoading(false);
    });
  }

  function loadFlags() {
    fetch("/api/group/recurring-issues")
      .then((r) => r.json())
      .then((d) => setFlags(d.flags ?? []))
      .catch(() => setFlags([]));
  }

  async function convertFlag(id: string) {
    setConvertingFlagId(id);
    await fetch(`/api/group/recurring-issues/${id}/convert`, { method: "POST" });
    setConvertingFlagId(null);
    loadFlags();
    load();
  }

  async function dismissFlag(id: string) {
    setConvertingFlagId(id);
    await fetch(`/api/group/recurring-issues/${id}/dismiss`, { method: "POST" });
    setConvertingFlagId(null);
    loadFlags();
  }

  useEffect(() => {
    load();
    loadFlags();
  }, []);

  function toggleAffected(id: string) {
    setAffectedBusinessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleLinkedAction(id: string) {
    setLinkedActionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createInitiative() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/improvement-initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        ownerId: ownerId || null,
        affectedBusinessIds,
        linkedActionIds,
        baselineMetricDescription,
        baselineValue: baselineValue.trim() ? Number(baselineValue) : null,
        targetValue: targetValue.trim() ? Number(targetValue) : null,
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
    setAffectedBusinessIds([]);
    setLinkedActionIds([]);
    setBaselineMetricDescription("");
    setBaselineValue("");
    setTargetValue("");
    setShowForm(false);
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/group/improvement-initiatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function removeInitiative(id: string) {
    if (!confirm("Delete this improvement initiative?")) return;
    await fetch(`/api/group/improvement-initiatives/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(row: InitiativeRow) {
    setEditingId(row._id);
    setTitleDraft(row.title);
    setDescriptionDraft(row.description);
    setBaselineDraft(row.baselineValue !== null ? String(row.baselineValue) : "");
    setTargetDraft(row.targetValue !== null ? String(row.targetValue) : "");
  }

  async function saveEdit(id: string) {
    if (!titleDraft.trim()) return;
    await fetch(`/api/group/improvement-initiatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleDraft.trim(),
        description: descriptionDraft,
        baselineValue: baselineDraft.trim() ? Number(baselineDraft) : undefined,
        targetValue: targetDraft.trim() ? Number(targetDraft) : undefined,
      }),
    });
    setEditingId(null);
    load();
  }

  function ownerLabel(id: string | null) {
    if (!id) return "Unassigned";
    return team.find((t) => t.userId === id)?.label ?? "Unassigned";
  }
  function businessName(id: string) {
    return businesses.find((b) => b._id === id)?.name ?? "—";
  }

  const visible = initiatives.filter((i) => statusFilter === "all" || i.status === statusFilter);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Improvement Initiatives
            <InfoTip text={tooltips["improvement-initiatives"]} />
          </h1>
          <p className="subtitle">
            For a pattern across several branches' cases, not one customer's complaint — a systemic fix with its own
            owner, baseline, and target. Individual cases stay in each branch's Case Management; link them here once
            you spot the pattern.
          </p>
        </div>
        <button className="btn btn-dark" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New initiative"}
        </button>
      </div>

      {flags.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--amber, #E0A100)" }}>
          <h3 style={{ margin: "0 0 4px" }}>Suggested — cross-branch recurring patterns</h3>
          <p className="card-sub" style={{ margin: "0 0 10px" }}>
            The same category keeps coming up across multiple branches. Review and turn it into a tracked initiative,
            or dismiss it if it&rsquo;s not worth one right now.
          </p>
          {flags.map((f) => (
            <div
              key={f._id}
              className="field-row"
              style={{ alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)" }}
            >
              <div>
                <b>{f.categoryName}</b> — {f.count} cases across {f.businessIds.length} branches in the last{" "}
                {f.windowDays} days
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-dark" disabled={convertingFlagId === f._id} onClick={() => convertFlag(f._id)}>
                  {convertingFlagId === f._id ? "…" : "Create initiative from this"}
                </button>
                <button className="btn btn-sm" disabled={convertingFlagId === f._id} onClick={() => dismissFlag(f._id)}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
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
          </div>
          <div className="field">
            <label>What's the pattern?</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Wait-time complaints repeated across 8 branches over 6 weeks"
            />
          </div>
          <div className="field">
            <label>Branches affected</label>
            <div className="chip-select">
              {businesses.map((b) => (
                <div key={b._id} className={`chip ${affectedBusinessIds.includes(b._id) ? "active" : ""}`} onClick={() => toggleAffected(b._id)}>
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
                <div key={a._id} className={`chip ${linkedActionIds.includes(a._id) ? "active" : ""}`} onClick={() => toggleLinkedAction(a._id)}>
                  {a.title}
                </div>
              ))}
              {actions.length === 0 && <span className="subtitle">No cases to link yet.</span>}
            </div>
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
        <div className="ab-list">
          {visible.map((row) => (
            <div className="card ab-card" key={row._id}>
              {editingId === row._id ? (
                <div className="ab-panel" style={{ margin: 0 }}>
                  <div className="field-row">
                    <div className="field">
                      <label>Title</label>
                      <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>What's the pattern?</label>
                      <input value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
                    </div>
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
                  <button className="btn btn-dark btn-sm" onClick={() => saveEdit(row._id)}>
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
                        <span
                          className={`pill ${row.status === "completed" ? "pill-green" : row.status === "in_progress" ? "pill-amber" : "pill-gray"}`}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                        {row.linkedActionIds.length > 0 && (
                          <span className="pill pill-gray">
                            {row.linkedActionIds.length} case{row.linkedActionIds.length === 1 ? "" : "s"} linked
                          </span>
                        )}
                      </div>
                      <div className="ab-title">{row.title}</div>
                      <div className="ab-meta-row">
                        <span>
                          Owner: <b>{ownerLabel(row.ownerId)}</b>
                        </span>
                        <span>
                          Status:{" "}
                          <select value={row.status} onChange={(e) => updateStatus(row._id, e.target.value)} style={{ marginLeft: 4 }}>
                            <option value="planned">Planned</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </span>
                      </div>
                      {row.affectedBusinessIds.length > 0 && (
                        <div className="ab-desc">
                          <b>Branches:</b> {row.affectedBusinessIds.map(businessName).join(", ")}
                        </div>
                      )}
                      {row.description && (
                        <div className="ab-desc">
                          <b>Pattern:</b> {row.description}
                        </div>
                      )}
                      <div className="ab-callout">
                        <b>{row.baselineMetricDescription || "Metric"}:</b>{" "}
                        {progressLabel(row) ?? "no baseline/target set yet"}
                      </div>
                    </div>
                  </div>
                  <div className="action-links">
                    <button type="button" className="btn btn-sm action-btn" onClick={() => startEdit(row)}>
                      ✎ Edit
                    </button>
                    <button type="button" className="icon-btn btn-danger" onClick={() => removeInitiative(row._id)}>
                      🗑
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {visible.length === 0 && (
            <div className="ab-empty">
              {initiatives.length === 0 ? "No improvement initiatives yet." : "No initiatives with this status."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

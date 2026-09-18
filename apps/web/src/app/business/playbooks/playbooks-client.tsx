"use client";

import { useEffect, useState } from "react";
import { PlaybookRunPanel } from "@/components/playbook-run-panel";
import { InfoTip } from "@/components/info-tip";

type TriggerMetric = "categoryAverage" | "negativeMentionCount";

interface UsageInfo {
  usageCount90d: number;
  completionRate: number | null;
  avgResolutionHours: number | null;
  lastUsedAt: string | null;
}
interface RunHistoryRow {
  _id: string;
  status: string;
  startedAt?: string;
  completedAt?: string | null;
  caseTitle?: string;
  completedBy?: string;
  [key: string]: unknown;
}
interface PlaybookRow {
  _id: string;
  title: string;
  categoryId: string | null;
  triggerCondition: string;
  triggerMetric: TriggerMetric | null;
  triggerComparator: "below" | "above" | null;
  triggerThreshold: number | null;
  triggerWindowDays: number | null;
  steps: string[];
  escalationContactId: string | null;
  usageCount: number;
  usage?: UsageInfo;
  triggerStatus: { isTriggered: boolean; currentValue: number | null; description: string } | null;
  activeRun: { _id: string; steps: string[]; completedStepIndexes: number[]; status: "active" | "completed" | "abandoned" } | null;
}

function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}
interface CategoryRow {
  _id: string;
  name: string;
}
interface TeamRow {
  userId: string;
  label: string;
}

export default function BusinessPlaybooksClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [steps, setSteps] = useState("");
  const [escalationContactId, setEscalationContactId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [triggerMetric, setTriggerMetric] = useState<"" | TriggerMetric>("");
  const [triggerComparator, setTriggerComparator] = useState<"below" | "above">("below");
  const [triggerThreshold, setTriggerThreshold] = useState("");
  const [triggerWindowDays, setTriggerWindowDays] = useState("14");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editTriggerCondition, setEditTriggerCondition] = useState("");
  const [editSteps, setEditSteps] = useState("");
  const [editEscalationContactId, setEditEscalationContactId] = useState("");
  const [editTriggerMetric, setEditTriggerMetric] = useState<"" | TriggerMetric>("");
  const [editTriggerComparator, setEditTriggerComparator] = useState<"below" | "above">("below");
  const [editTriggerThreshold, setEditTriggerThreshold] = useState("");
  const [editTriggerWindowDays, setEditTriggerWindowDays] = useState("14");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [historyById, setHistoryById] = useState<Record<string, RunHistoryRow[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/business/playbooks").then((r) => r.json()),
      fetch("/api/business/team").then((r) => r.json()),
    ])
      .then(([data, teamData]) => {
        setPlaybooks(data.playbooks ?? []);
        setCategories(data.categories ?? []);
        setReadOnly(!!data.readOnly);
        setTeam(teamData.team ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function categoryName(id: string | null): string {
    if (!id) return "Any category";
    return categories.find((c) => c._id === id)?.name ?? "Unknown category";
  }

  function contactLabel(id: string | null) {
    if (!id) return null;
    return team.find((t) => t.userId === id)?.label ?? null;
  }

  function triggerSummary(p: PlaybookRow): string {
    if (!p.triggerMetric) return p.triggerCondition || "No automatic trigger set";
    const metricLabel = p.triggerMetric === "categoryAverage" ? "Category average" : "Negative mentions";
    const comparator = p.triggerComparator === "above" ? "rises above" : "falls below";
    if (p.triggerMetric === "negativeMentionCount") {
      return `${metricLabel} reaches ${p.triggerThreshold ?? "—"} in ${p.triggerWindowDays ?? "—"} days`;
    }
    return `${metricLabel} ${comparator} ${p.triggerThreshold ?? "—"}`;
  }

  async function createPlaybook() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/playbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        categoryId: categoryId || null,
        triggerCondition,
        steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        escalationContactId: escalationContactId || null,
        triggerMetric: triggerMetric || undefined,
        triggerComparator: triggerMetric ? triggerComparator : undefined,
        triggerThreshold: triggerThreshold.trim() ? Number(triggerThreshold) : undefined,
        triggerWindowDays: triggerMetric === "negativeMentionCount" && triggerWindowDays.trim() ? Number(triggerWindowDays) : undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setCategoryId("");
    setTriggerCondition("");
    setSteps("");
    setEscalationContactId("");
    setTriggerMetric("");
    setTriggerThreshold("");
    load();
  }

  async function removePlaybook(id: string) {
    if (!confirm("Delete this playbook?")) return;
    await fetch(`/api/business/playbooks/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(p: PlaybookRow) {
    setEditingId(p._id);
    setEditTitle(p.title);
    setEditCategoryId(p.categoryId ?? "");
    setEditTriggerCondition(p.triggerCondition);
    setEditSteps(p.steps.join("\n"));
    setEditEscalationContactId(p.escalationContactId ?? "");
    setEditTriggerMetric(p.triggerMetric ?? "");
    setEditTriggerComparator(p.triggerComparator ?? "below");
    setEditTriggerThreshold(p.triggerThreshold !== null ? String(p.triggerThreshold) : "");
    setEditTriggerWindowDays(p.triggerWindowDays !== null ? String(p.triggerWindowDays) : "14");
    setEditError(null);
    setExpandedFor(null);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/business/playbooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        categoryId: editCategoryId || null,
        triggerCondition: editTriggerCondition,
        steps: editSteps.split("\n").map((s) => s.trim()).filter(Boolean),
        escalationContactId: editEscalationContactId || null,
        triggerMetric: editTriggerMetric || null,
        triggerComparator: editTriggerMetric ? editTriggerComparator : null,
        triggerThreshold: editTriggerThreshold.trim() ? Number(editTriggerThreshold) : null,
        triggerWindowDays: editTriggerMetric === "negativeMentionCount" && editTriggerWindowDays.trim() ? Number(editTriggerWindowDays) : null,
      }),
    });
    const data = await res.json().catch(() => null);
    setEditSaving(false);
    if (!res.ok) {
      setEditError(data?.message ?? "Failed to save changes");
      return;
    }
    setEditingId(null);
    load();
  }

  async function toggleHistory(id: string) {
    if (historyFor === id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(id);
    if (!historyById[id]) {
      setHistoryLoading(true);
      const data = await fetch(`/api/business/playbooks/${id}/runs`)
        .then((r) => r.json())
        .catch(() => null);
      setHistoryById((prev) => ({ ...prev, [id]: data?.runs ?? [] }));
      setHistoryLoading(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Playbook Library
            <InfoTip text={tooltips["playbooks"]} />
          </h1>
          <p className="subtitle">
            {readOnly
              ? "Managed by your parent organization — these apply to your cases automatically. Check off steps from a case in Case Management; your parent org sees your progress there."
              : "Standard guidance per category/issue type — shown right on matching Action Board items."}
          </p>
        </div>
      </div>

      {!readOnly && (
      <div className="card" data-tour="pb-new-playbook">
        <h3>New playbook</h3>
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Any category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Trigger condition</label>
            <input
              value={triggerCondition}
              onChange={(e) => setTriggerCondition(e.target.value)}
              placeholder="e.g. 3+ mentions in 2 weeks"
            />
          </div>
        </div>
        <div className="field">
          <label>Steps (one per line)</label>
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
        <div className="field">
          <label>Escalation contact (optional)</label>
          <select value={escalationContactId} onChange={(e) => setEscalationContactId(e.target.value)}>
            <option value="">None</option>
            {team.map((t) => (
              <option key={t.userId} value={t.userId}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>
              Auto-check trigger against (optional)
              <InfoTip text={tooltips["auto-trigger"]} />
            </label>
            <select value={triggerMetric} onChange={(e) => setTriggerMetric(e.target.value as TriggerMetric | "")}>
              <option value="">Just descriptive text above, don&apos;t evaluate</option>
              <option value="categoryAverage">Category average falls below/above a number</option>
              <option value="negativeMentionCount">Negative-sentiment mentions in a window</option>
            </select>
          </div>
          {triggerMetric === "categoryAverage" && (
            <div className="field">
              <label>Comparator</label>
              <select value={triggerComparator} onChange={(e) => setTriggerComparator(e.target.value as "below" | "above")}>
                <option value="below">Falls below</option>
                <option value="above">Rises above</option>
              </select>
            </div>
          )}
          {triggerMetric && (
            <div className="field">
              <label>{triggerMetric === "categoryAverage" ? "Threshold (1-5)" : "Mention count"}</label>
              <input type="number" step="0.1" value={triggerThreshold} onChange={(e) => setTriggerThreshold(e.target.value)} />
            </div>
          )}
          {triggerMetric === "negativeMentionCount" && (
            <div className="field">
              <label>Window (days)</label>
              <input type="number" value={triggerWindowDays} onChange={(e) => setTriggerWindowDays(e.target.value)} />
            </div>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createPlaybook}>
          {creating ? "Creating…" : "+ Create playbook"}
        </button>
      </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div className="ab-list">
          {playbooks.map((p, index) => (
            <div className="card ab-card" data-tour={index === 0 ? "pb-first-card" : undefined} key={p._id}>
              {editingId === p._id ? (
                <div className="ab-panel" style={{ margin: 0 }}>
                  <div className="field-row">
                    <div className="field">
                      <label>Title</label>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Category</label>
                      <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                        <option value="">Any category</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Trigger condition</label>
                      <input value={editTriggerCondition} onChange={(e) => setEditTriggerCondition(e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Steps (one per line)</label>
                    <textarea value={editSteps} onChange={(e) => setEditSteps(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Escalation contact (optional)</label>
                    <select value={editEscalationContactId} onChange={(e) => setEditEscalationContactId(e.target.value)}>
                      <option value="">None</option>
                      {team.map((t) => (
                        <option key={t.userId} value={t.userId}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Auto-check trigger against (optional)</label>
                      <select value={editTriggerMetric} onChange={(e) => setEditTriggerMetric(e.target.value as TriggerMetric | "")}>
                        <option value="">Just descriptive text above, don&apos;t evaluate</option>
                        <option value="categoryAverage">Category average falls below/above a number</option>
                        <option value="negativeMentionCount">Negative-sentiment mentions in a window</option>
                      </select>
                    </div>
                    {editTriggerMetric === "categoryAverage" && (
                      <div className="field">
                        <label>Comparator</label>
                        <select value={editTriggerComparator} onChange={(e) => setEditTriggerComparator(e.target.value as "below" | "above")}>
                          <option value="below">Falls below</option>
                          <option value="above">Rises above</option>
                        </select>
                      </div>
                    )}
                    {editTriggerMetric && (
                      <div className="field">
                        <label>{editTriggerMetric === "categoryAverage" ? "Threshold (1-5)" : "Mention count"}</label>
                        <input type="number" step="0.1" value={editTriggerThreshold} onChange={(e) => setEditTriggerThreshold(e.target.value)} />
                      </div>
                    )}
                    {editTriggerMetric === "negativeMentionCount" && (
                      <div className="field">
                        <label>Window (days)</label>
                        <input type="number" value={editTriggerWindowDays} onChange={(e) => setEditTriggerWindowDays(e.target.value)} />
                      </div>
                    )}
                  </div>
                  {editError && <p className="error-text">{editError}</p>}
                  <button className="btn btn-dark btn-sm" disabled={editSaving} onClick={() => saveEdit(p._id)}>
                    {editSaving ? "Saving…" : "Save changes"}
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
                        <span className="pill pill-gray">{categoryName(p.categoryId)}</span>
                        <span className="pill pill-purple">
                          {p.usageCount} use{p.usageCount === 1 ? "" : "s"}
                        </span>
                        {p.triggerStatus && (
                          <span className={`pill ${p.triggerStatus.isTriggered ? "pill-red" : "pill-green"}`}>
                            {p.triggerStatus.isTriggered ? "Triggered now" : "Not triggered"}
                          </span>
                        )}
                        {p.activeRun && <span className="pill pill-amber">Run in progress</span>}
                      </div>
                      <div className="ab-title">{p.title}</div>
                      <div className="ab-meta-row">
                        <span>
                          Steps: <b>{p.steps.length}</b>
                        </span>
                        {contactLabel(p.escalationContactId) && (
                          <span>
                            Escalation contact: <b>{contactLabel(p.escalationContactId)}</b>
                          </span>
                        )}
                      </div>
                      <div className="ab-desc">
                        <b>Trigger:</b> {triggerSummary(p)}
                      </div>
                      {p.triggerStatus?.description && (
                        <div className="ab-callout">{p.triggerStatus.description}</div>
                      )}
                      {p.usage && (
                        <div className="pb-stat-grid">
                          <div className="pb-stat-tile">
                            <div className="pb-stat-label">Used (90d)</div>
                            <div className="pb-stat-val">{p.usage.usageCount90d}</div>
                          </div>
                          <div className="pb-stat-tile">
                            <div className="pb-stat-label">Completion rate</div>
                            <div className="pb-stat-val">
                              {p.usage.completionRate === null ? "—" : `${Math.round(p.usage.completionRate * 100)}%`}
                            </div>
                          </div>
                          <div className="pb-stat-tile">
                            <div className="pb-stat-label">Avg resolution</div>
                            <div className="pb-stat-val">{formatHours(p.usage.avgResolutionHours)}</div>
                          </div>
                          <div className="pb-stat-tile">
                            <div className="pb-stat-label">Last used</div>
                            <div className="pb-stat-val" style={{ fontSize: 13 }}>
                              {p.usage.lastUsedAt ? new Date(p.usage.lastUsedAt).toLocaleDateString() : "—"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="ab-actions-col">
                        <button className="icon-btn" onClick={() => startEdit(p)} title="Edit playbook">
                          ✎
                        </button>
                        <button className="icon-btn btn-danger" onClick={() => removePlaybook(p._id)} title="Delete playbook">
                          🗑
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="action-links">
                    <button
                      type="button"
                      className={`btn btn-sm action-btn${expandedFor === p._id ? " active" : ""}`}
                      onClick={() => setExpandedFor(expandedFor === p._id ? null : p._id)}
                    >
                      📘 {readOnly ? "View steps" : p.activeRun ? "Continue run" : "Steps & run"}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm action-btn${historyFor === p._id ? " active" : ""}`}
                      onClick={() => toggleHistory(p._id)}
                    >
                      🕘 View run history
                    </button>
                  </div>

                  {expandedFor === p._id && (
                    <div className="ab-panel">
                      {(!p.activeRun || readOnly) && (
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: "12.5px", color: "var(--text-2)" }}>
                          {p.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      )}
                      {readOnly && (
                        <p className="subtitle" style={{ margin: "8px 0 0" }}>
                          To work through these steps on a specific case, open it from Case Management — checking off
                          a step there is visible to your parent organization immediately.
                        </p>
                      )}
                      {!readOnly && (
                        <PlaybookRunPanel
                          triggerStatus={p.triggerStatus}
                          activeRun={p.activeRun}
                          startPath={`/api/business/playbooks/${p._id}/start`}
                          runsPath="/api/business/playbook-runs"
                          onChange={load}
                        />
                      )}
                    </div>
                  )}

                  {historyFor === p._id && (
                    <div className="ab-panel">
                      {historyLoading && !historyById[p._id] && <p className="subtitle">Loading…</p>}
                      {historyById[p._id] && historyById[p._id].length === 0 && (
                        <p className="subtitle" style={{ margin: 0 }}>
                          No runs yet.
                        </p>
                      )}
                      {historyById[p._id] && historyById[p._id].length > 0 && (
                        <table className="clean" style={{ fontSize: 12.5 }}>
                          <thead>
                            <tr>
                              <th>Case</th>
                              <th>Started</th>
                              <th>Status</th>
                              {historyById[p._id].some((r) => r.completedBy) && <th>Completed by</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {historyById[p._id].map((r) => (
                              <tr key={r._id}>
                                <td>{r.caseTitle ?? "—"}</td>
                                <td>{r.startedAt ? new Date(r.startedAt).toLocaleDateString() : "—"}</td>
                                <td>
                                  <span className={`pill ${r.status === "completed" ? "pill-green" : r.status === "abandoned" ? "pill-gray" : "pill-amber"}`}>
                                    {r.status}
                                  </span>
                                </td>
                                {historyById[p._id].some((row) => row.completedBy) && <td>{r.completedBy ?? "—"}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {playbooks.length === 0 && <div className="ab-empty">No playbooks yet.</div>}
        </div>
      )}
    </div>
  );
}

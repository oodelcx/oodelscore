"use client";

import { Fragment, useEffect, useState } from "react";

interface ItemRow {
  _id: string;
  title: string;
  description: string;
  businessId: string;
  categoryId: string | null;
  ownerId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  resolutionNote: string;
  source: string;
}
interface PlaybookRow {
  _id: string;
  categoryId: string | null;
  title: string;
  triggerCondition: string;
  steps: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_suggested: "AI suggested",
  auto_assigned: "AI auto-assigned",
  escalated: "Escalated",
};
interface BusinessRow {
  _id: string;
  name: string;
}
interface TeamRow {
  userId: string;
  label: string;
}

export default function ActionBoardPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tier, setTier] = useState<"full" | "limited" | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [expandedPlaybookFor, setExpandedPlaybookFor] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/action-board").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
    ]).then(([itemsData, businessesData, teamData]) => {
      setItems(itemsData.items ?? []);
      setPlaybooks(itemsData.playbooks ?? []);
      setTier(itemsData.tier ?? null);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setBusinessId((current) => current || businessesData.businesses?.[0]?._id || "");
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function playbookForCategory(categoryId: string | null) {
    if (!categoryId) return null;
    return playbooks.find((p) => p.categoryId === categoryId) ?? null;
  }

  function startResolve(id: string) {
    setResolvingId(id);
    setResolutionDraft("");
    setResolutionError(null);
  }

  function cancelResolve() {
    setResolvingId(null);
    setResolutionDraft("");
    setResolutionError(null);
  }

  async function confirmResolve(id: string) {
    if (!resolutionDraft.trim()) {
      setResolutionError("Describe what you did about this before marking it resolved.");
      return;
    }
    await updateItem(id, { status: "resolved", resolutionNote: resolutionDraft.trim() });
    setResolvingId(null);
    setResolutionDraft("");
    setResolutionError(null);
  }

  async function createItem() {
    if (!title.trim() || !businessId) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/action-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, businessId, priority, ownerId: ownerId || null, dueDate: dueDate || null }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setOwnerId("");
    setDueDate("");
    load();
  }

  async function updateItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/group/action-board/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  function businessName(id: string) {
    return businesses.find((b) => b._id === id)?.name ?? "—";
  }

  const isLimited = tier === "limited";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{isLimited ? "My Action Items" : "Action Board"}</h1>
          <p className="subtitle">
            {isLimited
              ? "Items assigned to you — update their status as you work through them."
              : "Work items spawned from flagged feedback across your businesses, including AI-suggested ones from Alert Rules."}
          </p>
        </div>
      </div>

      {!isLimited && (
      <div className="card">
        <h3>New action item</h3>
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Business</label>
            <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Owner (optional)</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Due date (optional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createItem}>
          {creating ? "Creating…" : "+ Log action"}
        </button>
      </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Title</th>
              {!isLimited && <th>Business</th>}
              {!isLimited && <th>Owner</th>}
              {!isLimited && <th>Priority</th>}
              <th>Source</th>
              <th>Status</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const playbook = playbookForCategory(item.categoryId);
              const colCount = isLimited ? 4 : 7;
              return (
                <Fragment key={item._id}>
                  <tr>
                    <td>
                      {item.title}
                      {item.description && <div className="card-sub" style={{ margin: "2px 0 0" }}>{item.description}</div>}
                      {playbook && (
                        <button
                          className="btn btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => setExpandedPlaybookFor(expandedPlaybookFor === item._id ? null : item._id)}
                        >
                          {expandedPlaybookFor === item._id ? "Hide playbook" : "📘 Playbook: " + playbook.title}
                        </button>
                      )}
                    </td>
                    {!isLimited && <td>{businessName(item.businessId)}</td>}
                    {!isLimited && (
                      <td>
                        <select value={item.ownerId ?? ""} onChange={(e) => updateItem(item._id, { ownerId: e.target.value || null })}>
                          <option value="">Unassigned</option>
                          {team.map((t) => (
                            <option key={t.userId} value={t.userId}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {!isLimited && (
                      <td>
                        <select value={item.priority} onChange={(e) => updateItem(item._id, { priority: e.target.value })}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </td>
                    )}
                    <td>
                      <span className={`pill ${item.source === "manual" ? "pill-gray" : "pill-purple"}`}>
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>{item.status}</span>
                    </td>
                    <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {item.status !== "resolved" && resolvingId !== item._id && (
                        <button className="btn btn-sm" onClick={() => startResolve(item._id)}>
                          Mark resolved
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedPlaybookFor === item._id && playbook && (
                    <tr>
                      <td colSpan={colCount} style={{ background: "var(--bg-2, #f7f7f8)" }}>
                        <div className="card-sub" style={{ margin: "4px 0" }}>
                          <b>Trigger:</b> {playbook.triggerCondition || "—"}
                        </div>
                        <ul style={{ margin: "4px 0 6px", paddingLeft: 18, fontSize: "12.5px", color: "var(--text-2)" }}>
                          {playbook.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  {resolvingId === item._id && (
                    <tr>
                      <td colSpan={colCount}>
                        <div className="field" style={{ margin: "6px 0" }}>
                          <label>What did you do about this?</label>
                          <textarea
                            value={resolutionDraft}
                            onChange={(e) => setResolutionDraft(e.target.value)}
                            autoFocus
                            placeholder="Describe the action taken — this is logged to the Decision Log automatically."
                          />
                        </div>
                        {resolutionError && <p className="error-text">{resolutionError}</p>}
                        <button className="btn btn-dark btn-sm" onClick={() => confirmResolve(item._id)}>
                          Confirm resolved
                        </button>{" "}
                        <button className="btn btn-sm" onClick={cancelResolve}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={isLimited ? 4 : 7} className="subtitle">
                  No action items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

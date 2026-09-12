"use client";

import { useEffect, useState } from "react";

interface ItemRow {
  _id: string;
  title: string;
  description: string;
  ownerId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  resolutionNote: string;
  source: string;
}
interface TeamRow {
  userId: string;
  label: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_suggested: "AI suggested",
  auto_assigned: "AI auto-assigned",
  escalated: "Escalated",
};

export default function BusinessActionBoardPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [tier, setTier] = useState<"full" | "limited" | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([fetch("/api/business/action-board").then((r) => r.json()), fetch("/api/business/team").then((r) => r.json())]).then(
      ([itemsData, teamData]) => {
        setItems(itemsData.items ?? []);
        setTier(itemsData.tier ?? null);
        setTeam(teamData.team ?? []);
        setLoading(false);
      }
    );
  }

  useEffect(load, []);

  async function createItem() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/action-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority, ownerId: ownerId || null, dueDate: dueDate || null }),
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
    await fetch(`/api/business/action-board/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
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
              : "Work items spawned from flagged feedback, including AI-suggested ones from Alert Rules."}
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
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
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
              {!isLimited && <th>Owner</th>}
              {!isLimited && <th>Priority</th>}
              <th>Source</th>
              <th>Status</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td>
                  {item.title}
                  {item.description && <div className="card-sub" style={{ margin: "2px 0 0" }}>{item.description}</div>}
                </td>
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
                  {item.status !== "resolved" && (
                    <button className="btn btn-sm" onClick={() => updateItem(item._id, { status: "resolved" })}>
                      Mark resolved
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={isLimited ? 4 : 6} className="subtitle">
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

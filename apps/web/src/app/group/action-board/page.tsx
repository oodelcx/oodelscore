"use client";

import { useEffect, useState } from "react";

interface ItemRow {
  _id: string;
  title: string;
  businessId: string;
  ownerId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
}
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
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/action-board").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
    ]).then(([itemsData, businessesData, teamData]) => {
      setItems(itemsData.items ?? []);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setBusinessId((current) => current || businessesData.businesses?.[0]?._id || "");
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Action Board</h1>
          <p className="subtitle">Work items spawned from flagged feedback across your businesses.</p>
        </div>
      </div>

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

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Title</th>
              <th>Business</th>
              <th>Owner</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td>{item.title}</td>
                <td>{businessName(item.businessId)}</td>
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
                <td>
                  <select value={item.priority} onChange={(e) => updateItem(item._id, { priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
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
                <td colSpan={7} className="subtitle">
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

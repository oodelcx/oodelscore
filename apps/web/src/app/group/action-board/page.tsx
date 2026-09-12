"use client";

import { useEffect, useState } from "react";

interface ItemRow {
  _id: string;
  title: string;
  businessId: string;
  priority: string;
  status: string;
  dueDate: string | null;
}
interface BusinessRow {
  _id: string;
  name: string;
}

export default function ActionBoardPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/action-board").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
    ]).then(([itemsData, businessesData]) => {
      setItems(itemsData.items ?? []);
      setBusinesses(businessesData.businesses ?? []);
      if (!businessId && businessesData.businesses?.[0]) setBusinessId(businessesData.businesses[0]._id);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createItem() {
    if (!title.trim() || !businessId) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/action-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, businessId, priority }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    load();
  }

  async function markResolved(id: string) {
    await fetch(`/api/group/action-board/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
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
                  <span className="pill pill-purple">{item.priority}</span>
                </td>
                <td>
                  <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>{item.status}</span>
                </td>
                <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {item.status !== "resolved" && (
                    <button className="btn btn-sm" onClick={() => markResolved(item._id)}>
                      Mark resolved
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="subtitle">
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

"use client";

import { useEffect, useState } from "react";

interface EntryRow {
  _id: string;
  title: string;
  trigger: string;
  status: string;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
}

export default function BusinessDecisionLogPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/business/decision-log")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createEntry() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/decision-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, trigger }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setTrigger("");
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
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Trigger</label>
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createEntry}>
          {creating ? "Creating…" : "+ Log decision"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Title</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Outcome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id}>
                <td>{e.title}</td>
                <td>{e.trigger || "—"}</td>
                <td>
                  <select value={e.status} onChange={(ev) => updateStatus(e._id, ev.target.value)}>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="implemented">Implemented</option>
                  </select>
                </td>
                <td>{e.outcomeBefore !== null && e.outcomeAfter !== null ? `${e.outcomeBefore} → ${e.outcomeAfter}` : "not measured yet"}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="icon-btn btn-danger" onClick={() => removeEntry(e._id)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  No decisions logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

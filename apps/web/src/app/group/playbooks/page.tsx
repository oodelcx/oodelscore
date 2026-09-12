"use client";

import { useEffect, useState } from "react";

interface PlaybookRow {
  _id: string;
  title: string;
  triggerCondition: string;
  steps: string[];
  usageCount: number;
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/group/playbooks")
      .then((res) => res.json())
      .then((data) => setPlaybooks(data.playbooks ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlaybook() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/playbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        triggerCondition,
        steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setTriggerCondition("");
    setSteps("");
    load();
  }

  async function removePlaybook(id: string) {
    if (!confirm("Delete this playbook?")) return;
    await fetch(`/api/group/playbooks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Playbooks</h1>
          <p className="subtitle">Standard guidance per category/issue type.</p>
        </div>
      </div>

      <div className="card">
        <h3>New playbook</h3>
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
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
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createPlaybook}>
          {creating ? "Creating…" : "+ Create playbook"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div>
          {playbooks.map((p) => (
            <div className="card" key={p._id}>
              <div className="page-head" style={{ marginBottom: 0 }}>
                <h3 style={{ margin: 0 }}>
                  {p.title} <span className="pill pill-purple">{p.usageCount} uses</span>
                </h3>
                <button className="icon-btn btn-danger" onClick={() => removePlaybook(p._id)}>
                  🗑
                </button>
              </div>
              <p className="card-sub">Trigger: {p.triggerCondition || "—"}</p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "12.5px", color: "var(--text-2)" }}>
                {p.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          ))}
          {playbooks.length === 0 && <p className="subtitle">No playbooks yet.</p>}
        </div>
      )}
    </div>
  );
}

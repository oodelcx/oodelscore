"use client";

import { useEffect, useState } from "react";

interface PlaybookRow {
  _id: string;
  title: string;
  categoryId: string | null;
  triggerCondition: string;
  steps: string[];
  usageCount: number;
}
interface CategoryRow {
  _id: string;
  name: string;
}

export default function BusinessPlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/business/playbooks")
      .then((res) => res.json())
      .then((data) => {
        setPlaybooks(data.playbooks ?? []);
        setCategories(data.categories ?? []);
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
    load();
  }

  async function removePlaybook(id: string) {
    if (!confirm("Delete this playbook?")) return;
    await fetch(`/api/business/playbooks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Playbooks</h1>
          <p className="subtitle">Standard guidance per category/issue type — shown right on matching Action Board items.</p>
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
              <p className="card-sub">
                <span className="pill pill-gray" style={{ marginRight: 8 }}>
                  {categoryName(p.categoryId)}
                </span>
                Trigger: {p.triggerCondition || "—"}
              </p>
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

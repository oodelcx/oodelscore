"use client";

import { useEffect, useState } from "react";

interface PlaybookRow {
  _id: string;
  title: string;
  categoryId: string | null;
  triggerCondition: string;
  steps: string[];
  escalationContactId: string | null;
  usageCount: number;
}
interface CategoryRow {
  _id: string;
  name: string;
}
interface TeamRow {
  userId: string;
  label: string;
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [steps, setSteps] = useState("");
  const [escalationContactId, setEscalationContactId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/playbooks").then((r) => r.json()),
      fetch("/api/group/category-owners").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
    ]).then(([playbooksData, categoryData, teamData]) => {
      setPlaybooks(playbooksData.playbooks ?? []);
      setCategories(categoryData.categories ?? []);
      setTeam(teamData.team ?? []);
      setLoading(false);
    });
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
        categoryId: categoryId || null,
        triggerCondition,
        steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        escalationContactId: escalationContactId || null,
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
    load();
  }

  async function removePlaybook(id: string) {
    if (!confirm("Delete this playbook?")) return;
    await fetch(`/api/group/playbooks/${id}`, { method: "DELETE" });
    load();
  }

  function categoryName(id: string | null) {
    if (!id) return null;
    return categories.find((c) => c._id === id)?.name ?? null;
  }
  function contactLabel(id: string | null) {
    if (!id) return null;
    return team.find((t) => t.userId === id)?.label ?? null;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Playbooks</h1>
          <p className="subtitle">Standard guidance per category/issue type, so a manager isn&apos;t improvising from scratch.</p>
        </div>
      </div>

      <div className="card">
        <h3>New playbook</h3>
        <div className="field">
          <label>Playbook title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Staff friendliness complaint" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Applies to category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
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
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createPlaybook}>
          {creating ? "Creating…" : "+ Create playbook"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div className="grid grid-2">
          {playbooks.map((p) => (
            <div className="playbook-card" key={p._id}>
              <div className="page-head" style={{ marginBottom: 0 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{p.title}</h3>
                  <p className="card-sub">
                    {p.steps.length} step{p.steps.length === 1 ? "" : "s"} · used {p.usageCount} time{p.usageCount === 1 ? "" : "s"}
                    {categoryName(p.categoryId) ? ` · ${categoryName(p.categoryId)}` : ""}
                  </p>
                </div>
                <button className="icon-btn btn-danger" onClick={() => removePlaybook(p._id)}>
                  🗑
                </button>
              </div>
              <ol style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
                {p.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {contactLabel(p.escalationContactId) && (
                <div className="metric-note" style={{ marginTop: 10 }}>Escalation contact: {contactLabel(p.escalationContactId)}</div>
              )}
            </div>
          ))}
          {playbooks.length === 0 && <p className="subtitle">No playbooks yet.</p>}
        </div>
      )}
    </div>
  );
}

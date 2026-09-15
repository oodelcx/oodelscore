"use client";

import { useEffect, useState } from "react";
import { PlaybookRunPanel } from "@/components/playbook-run-panel";

type TriggerMetric = "categoryAverage" | "negativeMentionCount";

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
  triggerStatus: { isTriggered: boolean; currentValue: number | null; description: string } | null;
  activeRun: { _id: string; steps: string[]; completedStepIndexes: number[]; status: "active" | "completed" | "abandoned" } | null;
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
  const [triggerMetric, setTriggerMetric] = useState<"" | TriggerMetric>("");
  const [triggerComparator, setTriggerComparator] = useState<"below" | "above">("below");
  const [triggerThreshold, setTriggerThreshold] = useState("");
  const [triggerWindowDays, setTriggerWindowDays] = useState("14");

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
        <div className="field-row">
          <div className="field">
            <label>Auto-check trigger against (optional)</label>
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
                {!p.activeRun &&
                  p.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
              </ol>
              {contactLabel(p.escalationContactId) && (
                <div className="metric-note" style={{ marginTop: 10 }}>Escalation contact: {contactLabel(p.escalationContactId)}</div>
              )}
              <PlaybookRunPanel
                triggerStatus={p.triggerStatus}
                activeRun={p.activeRun}
                startPath={`/api/group/playbooks/${p._id}/start`}
                runsPath="/api/group/playbook-runs"
                onChange={load}
              />
            </div>
          ))}
          {playbooks.length === 0 && <p className="subtitle">No playbooks yet.</p>}
        </div>
      )}
    </div>
  );
}

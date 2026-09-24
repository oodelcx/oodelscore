"use client";

import { useEffect, useState } from "react";

type GoalMetric = "starAverage" | "nps" | "categoryAverage" | "cxPulseLevel" | "overdueActionsCount";

interface GoalRow {
  _id: string;
  label: string;
  metric: GoalMetric;
  categoryId: string | null;
  startValue: number | null;
  targetValue: number;
  targetDate: string;
  status: "active" | "achieved" | "missed" | "archived";
  currentValue: number | null;
  progressPercent: number | null;
  onTrack: boolean | null;
  daysRemaining: number;
}

interface CategoryOption {
  _id: string;
  name: string;
  product?: "customer_experience" | "colleague_experience";
}

function metricLabels(product: "customer_experience" | "colleague_experience"): Record<GoalMetric, string> {
  const isCe = product === "colleague_experience";
  return {
    starAverage: "Overall score (stars)",
    nps: isCe ? "eNPS" : "NPS",
    categoryAverage: "Category score",
    cxPulseLevel: isCe ? "EX Pulse level" : "CX Pulse level",
    overdueActionsCount: "Overdue action items",
  };
}

function formatValue(metric: GoalMetric, value: number | null): string {
  if (value === null) return "—";
  if (metric === "starAverage" || metric === "categoryAverage") return `${value.toFixed(2)}/5`;
  if (metric === "cxPulseLevel") return `Level ${value}`;
  return String(value);
}

/** Shared by Business and Group — "give management something to work toward," tracked against the same computed metrics everything else uses. */
export function CxGoalsCard({
  apiPath,
  categoriesApiPath,
  product = "customer_experience",
  title,
}: {
  apiPath: string;
  categoriesApiPath: string;
  product?: "customer_experience" | "colleague_experience";
  title?: string;
}) {
  const METRIC_LABELS = metricLabels(product);
  const [goals, setGoals] = useState<GoalRow[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [metric, setMetric] = useState<GoalMetric>("starAverage");
  const [categoryId, setCategoryId] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTargetValue, setEditTargetValue] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editStatus, setEditStatus] = useState<GoalRow["status"]>("active");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch(`${apiPath}?product=${product}`)
      .then((res) => res.json())
      .then((d) => setGoals(d.goals ?? []));
  }

  useEffect(() => {
    load();
    fetch(categoriesApiPath)
      .then((res) => res.json())
      .then((d) => {
        const all: CategoryOption[] = d.categories ?? [];
        // Category docs carry their own product field — filter client-side
        // so a Colleague Experience goal's category dropdown doesn't offer
        // Customer Experience categories (and vice versa). A category
        // without a product field (pre-CE data) defaults to Customer
        // Experience, same as everywhere else this rule applies.
        setCategories(all.filter((c) => (c.product ?? "customer_experience") === product));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createGoal() {
    if (!label.trim() || !targetValue.trim() || !targetDate) return;
    setSaving(true);
    setError(null);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        metric,
        product,
        categoryId: metric === "categoryAverage" ? categoryId : undefined,
        targetValue: Number(targetValue),
        targetDate,
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to create goal");
      return;
    }
    setLabel("");
    setTargetValue("");
    setTargetDate("");
    setShowForm(false);
    load();
  }

  async function removeGoal(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`${apiPath}/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(g: GoalRow) {
    setEditingId(g._id);
    setEditLabel(g.label);
    setEditTargetValue(String(g.targetValue));
    setEditTargetDate(g.targetDate.slice(0, 10));
    setEditStatus(g.status);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim() || !editTargetValue.trim() || !editTargetDate) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`${apiPath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editLabel.trim(),
        targetValue: Number(editTargetValue),
        targetDate: editTargetDate,
        status: editStatus,
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

  return (
    <div className="card">
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>{title ?? (product === "colleague_experience" ? "EX Goals" : "CX Goals")}</h3>
          <p className="card-sub" style={{ margin: 0 }}>
            Targets for management to work toward, tracked automatically.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New goal"}
        </button>
      </div>

      {showForm && (
        <div style={{ marginBottom: 16, padding: 12, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
          <div className="field-row">
            <div className="field">
              <label>Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Increase cleanliness score" />
            </div>
            <div className="field">
              <label>Metric</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
                {Object.entries(METRIC_LABELS).map(([key, lbl]) => (
                  <option key={key} value={key}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {metric === "categoryAverage" && (
            <div className="field">
              <label>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field-row">
            <div className="field">
              <label>Target value</label>
              <input type="number" step="0.1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </div>
            <div className="field">
              <label>Target date</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark btn-sm" disabled={saving} onClick={createGoal}>
            {saving ? "Creating…" : "Create goal"}
          </button>
        </div>
      )}

      {goals === null && <p className="subtitle">Loading…</p>}
      {goals !== null && goals.length === 0 && !showForm && <p className="subtitle">No goals set yet.</p>}
      {goals !== null &&
        goals.map((g) => (
          <div key={g._id} style={{ marginBottom: 14 }}>
            {editingId === g._id ? (
              <div style={{ padding: 12, background: "var(--bg-2, #f7f7f5)", borderRadius: 8, marginBottom: 4 }}>
                <div className="field-row">
                  <div className="field">
                    <label>Label</label>
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as GoalRow["status"])}>
                      <option value="active">Active</option>
                      <option value="achieved">Achieved</option>
                      <option value="missed">Missed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Target value</label>
                    <input type="number" step="0.1" value={editTargetValue} onChange={(e) => setEditTargetValue(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Target date</label>
                    <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} />
                  </div>
                </div>
                <p className="subtitle" style={{ marginTop: 0 }}>
                  Metric ({METRIC_LABELS[g.metric]}) can&apos;t be changed after creation — delete and recreate the goal to track a different metric.
                </p>
                {editError && <p className="error-text">{editError}</p>}
                <div className="btn-group">
                  <button className="btn btn-dark btn-sm" disabled={editSaving} onClick={() => saveEdit(g._id)}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="page-head" style={{ marginBottom: 4 }}>
                  <div>
                    <b>{g.label}</b>
                    <span className="subtitle" style={{ marginLeft: 8 }}>
                      {formatValue(g.metric, g.currentValue)} → {formatValue(g.metric, g.targetValue)}
                    </span>
                  </div>
                  <div className="btn-group">
                    {g.status === "active" && g.onTrack !== null && (
                      <span className={`pill ${g.onTrack ? "pill-green" : "pill-amber"}`}>{g.onTrack ? "On track" : "Behind pace"}</span>
                    )}
                    {g.status !== "active" && <span className="pill">{g.status}</span>}
                    <span className="icon-btn" onClick={() => startEdit(g)} title="Edit goal">
                      ✎
                    </span>
                    <span className="icon-btn btn-danger" onClick={() => removeGoal(g._id)}>
                      🗑
                    </span>
                  </div>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, g.progressPercent ?? 0))}%`,
                      background: g.progressPercent !== null && g.progressPercent >= 100 ? "var(--green)" : "var(--accent)",
                    }}
                  />
                </div>
                <div className="subtitle">
                  {g.progressPercent === null
                    ? "Not enough data yet"
                    : `${g.progressPercent}% of the way there · ${g.daysRemaining >= 0 ? `${g.daysRemaining} days left` : "past target date"}`}
                </div>
              </>
            )}
          </div>
        ))}
    </div>
  );
}

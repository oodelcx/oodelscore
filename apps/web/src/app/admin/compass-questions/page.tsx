"use client";

import { useEffect, useState } from "react";

const ANCHOR_DIMENSIONS = ["authority", "numbers", "culture", "hearing", "ownership", "rhythm"] as const;
type AnchorDimension = (typeof ANCHOR_DIMENSIONS)[number];
const DIMENSION_LABELS: Record<AnchorDimension, string> = {
  authority: "Authority",
  numbers: "Numbers",
  culture: "Culture",
  hearing: "Hearing",
  ownership: "Ownership",
  rhythm: "Rhythm",
};

type Variant = "shared" | "cx" | "ex";
const VARIANT_LABELS: Record<Variant, string> = {
  shared: "Asked once (all accounts)",
  cx: "Customer Experience only",
  ex: "Colleague Experience only",
};
// Only these two dimensions have a CX/EX split in the fixed ANCHOR
// framework — every other dimension is asked once regardless of product.
const SPLIT_DIMENSIONS: ReadonlySet<AnchorDimension> = new Set(["hearing", "ownership"]);

interface QuestionRow {
  _id: string;
  key: string;
  dimension: AnchorDimension;
  variant: Variant;
  text: string;
  order: number;
}

function groupKey(dimension: AnchorDimension, variant: Variant) {
  return `${dimension}:${variant}`;
}

export default function CompassQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newText, setNewText] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [cadenceDraft, setCadenceDraft] = useState("");
  const [savingCadence, setSavingCadence] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/compass-questions").then((r) => r.json()),
      fetch("/api/admin/platform-settings").then((r) => r.json()),
    ])
      .then(([q, s]) => {
        const rows: QuestionRow[] = q.questions ?? [];
        setQuestions(rows);
        const nextDrafts: Record<string, string> = {};
        for (const row of rows) nextDrafts[row._id] = row.text;
        setDrafts(nextDrafts);
        setCadenceDraft(s.settings?.compassReassessmentCadenceDays != null ? String(s.settings.compassReassessmentCadenceDays) : "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveCadence() {
    setSavingCadence(true);
    await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compassReassessmentCadenceDays: cadenceDraft.trim() ? Number(cadenceDraft) : null }),
    });
    setSavingCadence(false);
  }

  async function saveText(id: string) {
    const text = drafts[id];
    if (!text || !text.trim()) return;
    setSavingId(id);
    await fetch(`/api/admin/compass-questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSavingId(null);
    load();
  }

  async function removeQuestion(id: string) {
    if (
      !confirm(
        "Delete this question? Accounts that already answered it keep their recorded answer and the wording they saw — only the live assessment stops asking it."
      )
    ) {
      return;
    }
    await fetch(`/api/admin/compass-questions/${id}`, { method: "DELETE" });
    load();
  }

  async function move(row: QuestionRow, siblings: QuestionRow[], direction: "up" | "down") {
    const idx = siblings.findIndex((q) => q._id === row._id);
    const swapWith = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (!swapWith) return;
    await Promise.all([
      fetch(`/api/admin/compass-questions/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: swapWith.order }),
      }),
      fetch(`/api/admin/compass-questions/${swapWith._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: row.order }),
      }),
    ]);
    load();
  }

  async function addQuestion(dimension: AnchorDimension, variant: Variant) {
    const key = groupKey(dimension, variant);
    const text = (newText[key] ?? "").trim();
    if (!text) return;
    setAdding(key);
    await fetch("/api/admin/compass-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimension, variant, text }),
    });
    setAdding(null);
    setNewText((prev) => ({ ...prev, [key]: "" }));
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>OodelCX Compass Questions</h1>
          <p className="subtitle">
            Every account answers the same six ANCHOR dimensions on the same scoring engine — that fixed structure
            keeps Compass scores comparable across accounts. What you edit here is the actual question wording: add,
            edit, delete, or reorder questions within a dimension, and for Hearing/Ownership choose whether a
            question applies to every account or only Customer Experience / Colleague Experience accounts.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Reassessment cadence</h3>
        <p className="subtitle" style={{ marginTop: 0 }}>
          How many days after a completed assessment an account is shown a &quot;due for reassessment&quot; flag.
          Leave blank to turn the nudge off platform-wide.
        </p>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0, width: 140 }}>
            <label>Days</label>
            <input type="number" min="1" placeholder="off" value={cadenceDraft} onChange={(e) => setCadenceDraft(e.target.value)} />
          </div>
          <button className="btn btn-dark btn-sm" disabled={savingCadence} onClick={saveCadence}>
            {savingCadence ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading &&
        ANCHOR_DIMENSIONS.map((dimension) => {
          const groups: Variant[] = SPLIT_DIMENSIONS.has(dimension) ? ["shared", "cx", "ex"] : ["shared"];
          return (
            <div className="card" style={{ marginBottom: 20 }} key={dimension}>
              <h3>{DIMENSION_LABELS[dimension]}</h3>
              {groups.map((variant) => {
                const rows = questions
                  .filter((q) => q.dimension === dimension && q.variant === variant)
                  .sort((a, b) => a.order - b.order);
                const key = groupKey(dimension, variant);
                return (
                  <div key={variant} style={{ marginBottom: 14 }}>
                    {groups.length > 1 && (
                      <div className="card-sub" style={{ fontWeight: 600 }}>
                        {VARIANT_LABELS[variant]}
                      </div>
                    )}
                    {rows.length === 0 && <p className="subtitle">No questions yet.</p>}
                    {rows.map((row, i) => (
                      <div className="qrow" key={row._id}>
                        <div className="qrow-top">
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <button className="icon-btn" disabled={i === 0} onClick={() => move(row, rows, "up")} title="Move up">
                              ↑
                            </button>
                            <button
                              className="icon-btn"
                              disabled={i === rows.length - 1}
                              onClick={() => move(row, rows, "down")}
                              title="Move down"
                            >
                              ↓
                            </button>
                          </div>
                          <input
                            style={{ flex: 1 }}
                            value={drafts[row._id] ?? row.text}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [row._id]: e.target.value }))}
                          />
                          <button className="btn btn-sm" disabled={savingId === row._id} onClick={() => saveText(row._id)}>
                            {savingId === row._id ? "Saving…" : "Save"}
                          </button>
                          <span className="icon-btn btn-danger" onClick={() => removeQuestion(row._id)}>
                            🗑
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="field-row" style={{ marginTop: 6 }}>
                      <input
                        style={{ flex: 1 }}
                        placeholder={groups.length > 1 ? `Add a question for ${VARIANT_LABELS[variant].toLowerCase()}…` : "Add a question…"}
                        value={newText[key] ?? ""}
                        onChange={(e) => setNewText((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                      <button className="btn btn-sm" disabled={adding === key} onClick={() => addQuestion(dimension, variant)}>
                        {adding === key ? "Adding…" : "+ Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

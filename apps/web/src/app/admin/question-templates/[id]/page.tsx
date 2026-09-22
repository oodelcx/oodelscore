"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const QUESTION_TYPES = [
  ["star_1_5", "Star Rating (1–5)"],
  ["nps_0_10", "NPS (0–10)"],
  ["open_text", "Open-ended / Free text"],
  ["yes_no", "Yes / No"],
  ["emoji_scale", "Emoji / Smiley scale"],
  ["multiple_choice", "Multiple choice"],
  ["multi_select", "Multi-select / Checkbox"],
  ["slider", "Slider / Numeric scale"],
  ["dropdown", "Dropdown select"],
] as const;

const OPTION_BASED_TYPES = ["multiple_choice", "multi_select", "dropdown"] as const;

function QuestionPreview({ q }: { q: QuestionRow }) {
  return (
    <div className="preview-q">
      <div className="pq-text">
        {q.text || "Untitled question"}
        {q.required && <span style={{ color: "var(--red)" }}> *</span>}
      </div>
      {q.type === "star_1_5" && (
        <div className="stars-preview">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= 4 ? "filled" : undefined}>
              ★
            </span>
          ))}
        </div>
      )}
      {q.type === "nps_0_10" && (
        <div className="nps-preview">
          {Array.from({ length: 11 }, (_, n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      )}
      {q.type === "yes_no" && (
        <div className="yn-preview">
          <span>Yes</span>
          <span>No</span>
        </div>
      )}
      {q.type === "emoji_scale" && <div style={{ fontSize: 22 }}>😞 🙁 😐 🙂 😄</div>}
      {q.type === "open_text" && <div className="text-preview">Type your answer…</div>}
      {q.type === "slider" && <input type="range" style={{ width: "100%" }} disabled />}
      {(q.type === "multiple_choice" || q.type === "multi_select") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(q.options.length ? q.options : ["Option 1", "Option 2"]).map((opt, i) => (
            <label key={i} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <input type={q.type === "multiple_choice" ? "radio" : "checkbox"} disabled />
              {opt || `Option ${i + 1}`}
            </label>
          ))}
        </div>
      )}
      {q.type === "dropdown" && (
        <select disabled>
          {(q.options.length ? q.options : ["Option 1", "Option 2"]).map((opt, i) => (
            <option key={i}>{opt || `Option ${i + 1}`}</option>
          ))}
        </select>
      )}
    </div>
  );
}

interface QuestionRow {
  text: string;
  type: string;
  categoryId: string;
  required: boolean;
  options: string[];
}

const EMPTY_QUESTION: QuestionRow = {
  text: "",
  type: "star_1_5",
  categoryId: "",
  required: false,
  options: [],
};

export default function QuestionTemplateBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";

  const [name, setName] = useState("");
  const [suggestedIndustries, setSuggestedIndustries] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [usedByCount, setUsedByCount] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetch(`/api/admin/question-templates/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        const t = d.template;
        setName(t.name ?? "");
        setSuggestedIndustries(t.suggestedIndustries ?? []);
        setUsedByCount(t.usedByCount ?? 0);
        setQuestions(
          (t.questions ?? []).map((q: Record<string, unknown>) => ({
            text: q.text ?? "",
            type: q.type ?? "star_1_5",
            categoryId: q.categoryId ?? "",
            required: !!q.required,
            options: q.options ?? [],
          }))
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [isNew, params.id]);

  function addIndustryTag() {
    const value = industryInput.trim();
    if (value && !suggestedIndustries.includes(value)) {
      setSuggestedIndustries((s) => [...s, value]);
    }
    setIndustryInput("");
  }

  function removeIndustryTag(value: string) {
    setSuggestedIndustries((s) => s.filter((v) => v !== value));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, { ...EMPTY_QUESTION }]);
  }

  function updateQuestion(index: number, patch: Partial<QuestionRow>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index));
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const target = index + dir;
      if (target < 0 || target >= qs.length) return qs;
      const copy = [...qs];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function addCategory() {
    const categoryName = window.prompt("New category name");
    if (!categoryName?.trim()) return;
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) setCategories((c) => [...c, data.category]);
    else setError(data?.message ?? "Failed to add category");
  }

  async function handleSave() {
    setError(null);

    for (const q of questions) {
      if (!OPTION_BASED_TYPES.includes(q.type as (typeof OPTION_BASED_TYPES)[number])) continue;
      const nonEmpty = q.options.map((o) => o.trim()).filter(Boolean);
      if (nonEmpty.length < 2) {
        setError(`"${q.text || "Untitled question"}" needs at least 2 options`);
        return;
      }
    }

    setSaving(true);

    const body = {
      name,
      suggestedIndustries,
      questions: questions.map((q) => ({
        text: q.text,
        type: q.type,
        categoryId: q.categoryId || null,
        required: q.required,
        options: q.options.map((o) => o.trim()).filter(Boolean),
      })),
    };

    const res = await fetch(isNew ? "/api/admin/question-templates" : `/api/admin/question-templates/${params.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      setError(data?.message ?? "Save failed");
      return;
    }

    router.push(isNew ? `/admin/question-templates/${data.template._id}` : "/admin/question-templates");
  }

  if (loading) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <Link className="backlink" href="/admin/question-templates">
        ← Back to Question Templates
      </Link>
      <div className="page-head">
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
            Template name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. School Feedback Template"
            style={{
              fontSize: 20,
              fontWeight: 600,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "#fff",
              padding: "8px 11px",
              marginBottom: 4,
              width: "100%",
              maxWidth: 480,
            }}
          />
          {!isNew && <p className="subtitle">Used by {usedByCount} business(es)</p>}
        </div>
        <div className="btn-group">
          <Link className="btn" href="/admin/question-templates">
            Cancel
          </Link>
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="field" style={{ maxWidth: 520, marginBottom: 24 }}>
        <label>Suggested for industries</label>
        <div className="tag-input">
          {suggestedIndustries.map((tag) => (
            <span className="tag-chip" key={tag}>
              {tag} <span className="x" onClick={() => removeIndustryTag(tag)}>×</span>
            </span>
          ))}
          <input
            type="text"
            value={industryInput}
            onChange={(e) => setIndustryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIndustryTag();
              }
            }}
            placeholder="Type and press Enter"
            style={{ border: "none", flex: 1, minWidth: 120 }}
          />
        </div>
        <div className="field-hint">When Admin creates a business in one of these industries, this template is suggested first.</div>
      </div>

      <div className="builder-grid">
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Questions
          </div>
          {questions.map((q, i) => (
            <div className="qrow" key={i}>
              <div className="qrow-top">
                <button className="icon-btn btn-sm" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button className="icon-btn btn-sm" onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1}>
                  ↓
                </button>
                <input
                  type="text"
                  className="q-text"
                  value={q.text}
                  onChange={(e) => updateQuestion(i, { text: e.target.value })}
                  style={{ flex: 1 }}
                  placeholder="Question text"
                />
                <button className="icon-btn btn-danger" onClick={() => removeQuestion(i)}>
                  🗑
                </button>
              </div>
              <div className="qrow-opts">
                <select value={q.type} onChange={(e) => updateQuestion(i, { type: e.target.value })}>
                  {QUESTION_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select value={q.categoryId} onChange={(e) => {
                  if (e.target.value === "__new__") { addCategory(); return; }
                  updateQuestion(i, { categoryId: e.target.value });
                }}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__new__">+ New category…</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} />
                  Required
                </label>
              </div>
              {OPTION_BASED_TYPES.includes(q.type as (typeof OPTION_BASED_TYPES)[number]) && (
                <div className="q-options" style={{ marginTop: 10 }}>
                  <div className="field-hint" style={{ marginBottom: 6 }}>Options respondents choose from</div>
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        type="text"
                        style={{ flex: 1 }}
                        value={opt}
                        placeholder={`Option ${optIndex + 1}`}
                        onChange={(e) => {
                          const next = [...q.options];
                          next[optIndex] = e.target.value;
                          updateQuestion(i, { options: next });
                        }}
                      />
                      <button
                        className="icon-btn btn-danger btn-sm"
                        onClick={() => updateQuestion(i, { options: q.options.filter((_, idx) => idx !== optIndex) })}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-sm" onClick={() => updateQuestion(i, { options: [...q.options, ""] })}>
                    + Add option
                  </button>
                </div>
              )}
            </div>
          ))}
          <button className="btn" style={{ width: "100%" }} onClick={addQuestion}>
            + Add Question
          </button>
        </div>

        <div className="phone-frame">
          <div className="phone-toolbar">Live preview — exactly what a customer sees when they scan the QR</div>
          <div className="phone-body">
            {questions.length === 0 && <p className="subtitle">Add a question to see the preview.</p>}
            {questions.map((q, i) => (
              <QuestionPreview key={i} q={q} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

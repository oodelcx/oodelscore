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

interface QuestionRow {
  text: string;
  type: string;
  categoryId: string;
  required: boolean;
  isTracker: boolean;
  options: string[];
}

const EMPTY_QUESTION: QuestionRow = {
  text: "",
  type: "star_1_5",
  categoryId: "",
  required: false,
  isTracker: false,
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
            isTracker: !!q.isTracker,
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
    setSaving(true);
    setError(null);

    const body = {
      name,
      suggestedIndustries,
      questions: questions.map((q) => ({
        text: q.text,
        type: q.type,
        categoryId: q.categoryId || null,
        required: q.required,
        isTracker: q.isTracker,
        options: q.options,
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            style={{ fontSize: 22, fontWeight: 600, border: "none", background: "none", padding: 0, marginBottom: 4, width: "100%" }}
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
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={q.isTracker} onChange={(e) => updateQuestion(i, { isTracker: e.target.checked })} />
                  Tracker
                </label>
              </div>
            </div>
          ))}
          <button className="btn" style={{ width: "100%" }} onClick={addQuestion}>
            + Add Question
          </button>
        </div>
      </div>
    </div>
  );
}

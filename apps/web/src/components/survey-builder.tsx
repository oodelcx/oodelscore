"use client";

import { useEffect, useState } from "react";

export type QuestionType =
  | "star_1_5"
  | "nps_0_10"
  | "open_text"
  | "yes_no"
  | "emoji_scale"
  | "multiple_choice"
  | "multi_select"
  | "slider"
  | "dropdown"
  | "ces_1_5";

const QUESTION_TYPE_OPTIONS: { type: QuestionType; label: string }[] = [
  { type: "star_1_5", label: "Star rating (1–5)" },
  { type: "nps_0_10", label: "NPS (0–10)" },
  { type: "ces_1_5", label: "Effort score (1–5)" },
  { type: "multiple_choice", label: "Multiple choice" },
  { type: "multi_select", label: "Multi-select" },
  { type: "dropdown", label: "Dropdown" },
  { type: "yes_no", label: "Yes / No" },
  { type: "emoji_scale", label: "Emoji scale" },
  { type: "slider", label: "Slider" },
  { type: "open_text", label: "Open text" },
];

const CHOICE_TYPES: QuestionType[] = ["multiple_choice", "multi_select", "dropdown"];

let nextLocalKey = 1;

interface AuthoredQuestion {
  localKey: number;
  text: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  categoryId: string;
  isCsatQuestion: boolean;
}

interface TemplateQuestion {
  _id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  categoryId?: string | null;
}
interface TemplateOption {
  _id: string;
  name: string;
  product: "customer_experience" | "colleague_experience";
  questions: TemplateQuestion[];
}
interface CategoryOption {
  _id: string;
  name: string;
}

function blankQuestion(type: QuestionType): AuthoredQuestion {
  return {
    localKey: nextLocalKey++,
    text: "",
    type,
    required: false,
    options: CHOICE_TYPES.includes(type) ? ["", ""] : [],
    categoryId: "",
    isCsatQuestion: false,
  };
}

export interface SurveyBuilderPayload {
  name: string;
  description: string;
  product: "customer_experience" | "colleague_experience";
  responseQuota: number | null;
  questions: { text: string; type: QuestionType; required: boolean; options: string[]; categoryId: string | null; isCsatQuestion: boolean }[];
}

interface SurveyBuilderPanelProps {
  templatesApiPath: string;
  categoriesApiPath: string;
  cxEnabled: boolean;
  ceEnabled: boolean;
  submitting: boolean;
  error: string | null;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (payload: SurveyBuilderPayload) => void;
}

/**
 * The real survey builder (PRODUCT-ROADMAP.md Phase 6, revised per the
 * product owner's own mockup): a business writes its own question text and
 * picks any question type from the fixed library on the left — it can't
 * invent an untyped question, since the scoring engine needs to know
 * exactly what kind of answer it's reading — or start from a copy of an
 * Admin template's questions as an editable first draft. From the moment a
 * question is on the canvas it belongs to this survey, not the template;
 * editing here never writes back to the template itself. Shared between
 * the Business and Group portals, which each own their own name/branch
 * picker and POST call around this.
 */
export function SurveyBuilderPanel({
  templatesApiPath,
  categoriesApiPath,
  cxEnabled,
  ceEnabled,
  submitting,
  error,
  submitLabel = "Create feedback point",
  onCancel,
  onSubmit,
}: SurveyBuilderPanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [product, setProduct] = useState<"customer_experience" | "colleague_experience">(
    cxEnabled ? "customer_experience" : "colleague_experience"
  );
  const [quota, setQuota] = useState("");
  const [questions, setQuestions] = useState<AuthoredQuestion[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    fetch(templatesApiPath)
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
    fetch(categoriesApiPath)
      .then((r) => r.json())
      .then((d) => setCategories(d.allCategories ?? []))
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTemplates = (templates ?? []).filter((t) => t.product === product);

  function addQuestion(type: QuestionType) {
    setQuestions((qs) => [...qs, blankQuestion(type)]);
  }

  function loadTemplate(template: TemplateOption) {
    setQuestions(
      template.questions.map((q) => ({
        localKey: nextLocalKey++,
        text: q.text,
        type: q.type,
        required: q.required,
        options: q.options && q.options.length > 0 ? [...q.options] : CHOICE_TYPES.includes(q.type) ? ["", ""] : [],
        categoryId: q.categoryId ?? "",
        isCsatQuestion: false,
      }))
    );
  }

  function updateQuestion(localKey: number, patch: Partial<AuthoredQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.localKey === localKey ? { ...q, ...patch } : q)));
  }

  function removeQuestion(localKey: number) {
    setQuestions((qs) => qs.filter((q) => q.localKey !== localKey));
  }

  function moveQuestion(localKey: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const index = qs.findIndex((q) => q.localKey === localKey);
      const target = index + dir;
      if (index === -1 || target < 0 || target >= qs.length) return qs;
      const copy = [...qs];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function setCsatQuestion(localKey: number) {
    setQuestions((qs) => qs.map((q) => ({ ...q, isCsatQuestion: q.localKey === localKey ? !q.isCsatQuestion : false })));
  }

  function updateOption(localKey: number, index: number, value: string) {
    setQuestions((qs) =>
      qs.map((q) => (q.localKey === localKey ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q))
    );
  }

  function addOption(localKey: number) {
    setQuestions((qs) => qs.map((q) => (q.localKey === localKey ? { ...q, options: [...q.options, ""] } : q)));
  }

  function removeOption(localKey: number, index: number) {
    setQuestions((qs) => qs.map((q) => (q.localKey === localKey ? { ...q, options: q.options.filter((_, i) => i !== index) } : q)));
  }

  function handleSubmit() {
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Name is required");
      return;
    }
    if (questions.length === 0) {
      setLocalError("Add at least one question");
      return;
    }
    for (const q of questions) {
      if (!q.text.trim()) {
        setLocalError("Every question needs its own text");
        return;
      }
      if (CHOICE_TYPES.includes(q.type) && q.options.filter((o) => o.trim()).length < 2) {
        setLocalError(`"${q.text}" needs at least two answer options`);
        return;
      }
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      product,
      responseQuota: quota.trim() ? Number(quota) : null,
      questions: questions.map((q) => ({
        text: q.text.trim(),
        type: q.type,
        required: q.required,
        options: CHOICE_TYPES.includes(q.type) ? q.options.filter((o) => o.trim()) : [],
        categoryId: q.categoryId || null,
        isCsatQuestion: q.isCsatQuestion,
      })),
    });
  }

  const shownError = error ?? localError;

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Desk QR" />
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {cxEnabled && ceEnabled && (
          <div className="field">
            <label>Product</label>
            <select value={product} onChange={(e) => setProduct(e.target.value as "customer_experience" | "colleague_experience")}>
              <option value="customer_experience">Customer Experience</option>
              <option value="colleague_experience">Colleague Experience</option>
            </select>
          </div>
        )}
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Response quota (optional)</label>
          <input type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="Unlimited" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, marginTop: 8 }}>
        <div>
          <h4 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-2)", margin: "0 0 8px" }}>
            Question types
          </h4>
          <p className="field-hint" style={{ margin: "0 0 8px" }}>
            Click to add a question of this type — you write the wording.
          </p>
          {QUESTION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              className="btn btn-sm"
              style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}
              onClick={() => addQuestion(opt.type)}
            >
              + {opt.label}
            </button>
          ))}

          {visibleTemplates.length > 0 && (
            <>
              <h4 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-2)", margin: "16px 0 8px" }}>
                Start from a template
              </h4>
              <p className="field-hint" style={{ margin: "0 0 8px" }}>
                Loads a copy onto the canvas — fully yours to edit from there.
              </p>
              {visibleTemplates.map((t) => (
                <div
                  key={t._id}
                  className="card"
                  style={{ padding: "8px 10px", marginBottom: 6, cursor: "pointer" }}
                  onClick={() => loadTemplate(t)}
                >
                  <b style={{ display: "block", fontSize: 12 }}>{t.name}</b>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t.questions.length} questions</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 12, padding: 16, minHeight: 200, background: "var(--bg-2, #f5f6f8)" }}>
          {questions.length === 0 && (
            <p className="subtitle" style={{ margin: 0 }}>
              Add a question type from the left, or start from a template.
            </p>
          )}
          {questions.map((q, index) => (
            <div className="card" key={q.localKey} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span className="pill pill-accent">{QUESTION_TYPE_OPTIONS.find((o) => o.type === q.type)?.label ?? q.type}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className="icon-btn btn-sm" onClick={() => moveQuestion(q.localKey, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn btn-sm"
                    onClick={() => moveQuestion(q.localKey, 1)}
                    disabled={index === questions.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="icon-btn btn-danger btn-sm" onClick={() => removeQuestion(q.localKey)}>
                    🗑
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(q.localKey, { text: e.target.value })}
                placeholder="Type the question wording…"
                style={{ width: "100%", marginBottom: 8 }}
              />

              {CHOICE_TYPES.includes(q.type) && (
                <div style={{ marginBottom: 8 }}>
                  <label className="field-hint" style={{ display: "block", marginBottom: 4 }}>
                    Answer options
                  </label>
                  {q.options.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(q.localKey, i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="icon-btn btn-sm"
                        onClick={() => removeOption(q.localKey, i)}
                        disabled={q.options.length <= 2}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={() => addOption(q.localKey)}>
                    + Add option
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.localKey, { required: e.target.checked })} />
                  Required
                </label>
                {q.type === "star_1_5" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" checked={q.isCsatQuestion} onChange={() => setCsatQuestion(q.localKey)} />
                    This is the CSAT question
                  </label>
                )}
                {categories.length > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    Category
                    <select value={q.categoryId} onChange={(e) => updateQuestion(q.localKey, { categoryId: e.target.value })}>
                      <option value="">None</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn" style={{ width: "100%", borderStyle: "dashed" }} onClick={() => addQuestion("open_text")}>
            + Add another question
          </button>
        </div>
      </div>

      {shownError && (
        <p className="error-text" style={{ marginTop: 10 }}>
          {shownError}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn btn-dark" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Creating…" : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </div>
  );
}

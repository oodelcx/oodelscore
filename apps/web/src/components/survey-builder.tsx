"use client";

import { useEffect, useState, type CSSProperties } from "react";

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

const TYPE_ICON: Record<QuestionType, string> = {
  star_1_5: "★",
  nps_0_10: "🎯",
  ces_1_5: "⚡",
  multiple_choice: "◉",
  multi_select: "☑",
  dropdown: "▾",
  yes_no: "✓",
  emoji_scale: "🙂",
  slider: "━",
  open_text: "✎",
};

const TYPE_COLOR_VAR: Record<QuestionType, string> = {
  star_1_5: "--amber",
  nps_0_10: "--blue",
  ces_1_5: "--purple",
  multiple_choice: "--accent",
  multi_select: "--accent",
  dropdown: "--accent",
  yes_no: "--green",
  emoji_scale: "--amber",
  slider: "--blue",
  open_text: "--text-3",
};

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

export type DemographicMode = "off" | "optional" | "mandatory";
export interface DemographicOverridePayload {
  name: DemographicMode;
  email: DemographicMode;
  phone: DemographicMode;
  ageGroup: DemographicMode;
  gender: DemographicMode;
}
export type DeliveryMode = "qr" | "link" | "both";

const DEMOGRAPHIC_FIELDS: { key: keyof DemographicOverridePayload; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "ageGroup", label: "Age bracket" },
  { key: "gender", label: "Gender" },
];
const DEMOGRAPHIC_MODE_OPTIONS: { value: DemographicMode; label: string }[] = [
  { value: "off", label: "Don't ask" },
  { value: "optional", label: "Optional" },
  { value: "mandatory", label: "Required" },
];

export interface SurveyBuilderPayload {
  name: string;
  description: string;
  product: "customer_experience" | "colleague_experience";
  responseQuota: number | null;
  questions: { text: string; type: QuestionType; required: boolean; options: string[]; categoryId: string | null; isCsatQuestion: boolean }[];
  deliveryMode: DeliveryMode;
  demographicOverride: DemographicOverridePayload | null;
  /** True = save as a draft: the QR code and link exist, but nothing is collected until it is published. */
  isDraft: boolean;
}

interface SurveyBuilderPanelProps {
  templatesApiPath: string;
  categoriesApiPath: string;
  cxEnabled: boolean;
  ceEnabled: boolean;
  // When set (a dual-product account actively viewing one product tab),
  // the product picker is hidden entirely and every dropdown/template list
  // is locked to this product — building a survey for the tab you're not
  // even looking at is never something the UI should offer.
  lockedProduct?: "customer_experience" | "colleague_experience" | null;
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
  lockedProduct,
  submitting,
  error,
  submitLabel = "Publish",
  onCancel,
  onSubmit,
}: SurveyBuilderPanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [product, setProduct] = useState<"customer_experience" | "colleague_experience">(
    lockedProduct ?? (cxEnabled ? "customer_experience" : "colleague_experience")
  );
  const [quota, setQuota] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("both");
  const [demographics, setDemographics] = useState<DemographicOverridePayload>({
    name: "off",
    email: "off",
    phone: "off",
    ageGroup: "off",
    gender: "off",
  });
  const [questions, setQuestions] = useState<AuthoredQuestion[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (lockedProduct) setProduct(lockedProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedProduct]);

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

  function changeQuestionType(localKey: number, type: QuestionType) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.localKey !== localKey) return q;
        const wasChoice = CHOICE_TYPES.includes(q.type);
        const isChoice = CHOICE_TYPES.includes(type);
        return {
          ...q,
          type,
          options: isChoice ? (wasChoice && q.options.length >= 2 ? q.options : ["", ""]) : [],
          isCsatQuestion: type === "star_1_5" ? q.isCsatQuestion : false,
        };
      })
    );
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

  function handleSubmit(isDraft: boolean) {
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
      deliveryMode,
      demographicOverride: demographics,
      isDraft,
    });
  }

  const shownError = error ?? localError;

  return (
    <div className="qb">
      <div className="field-row">
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Desk QR" />
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {!lockedProduct && cxEnabled && ceEnabled && (
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
        <div className="field" style={{ maxWidth: 220 }}>
          <label>How will this be shared?</label>
          <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}>
            <option value="both">Printed QR + shareable link</option>
            <option value="qr">Printed QR only</option>
            <option value="link">Link only (email/SMS, no QR)</option>
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Respondent details for this survey</label>
        <div className="qb-demographics" style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {DEMOGRAPHIC_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <select
                value={demographics[f.key]}
                onChange={(e) => setDemographics((d) => ({ ...d, [f.key]: e.target.value as DemographicMode }))}
              >
                {DEMOGRAPHIC_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="qb-layout">
        <div className="qb-palette">
          <h4 className="qb-palette-heading">Question types</h4>
          <p className="field-hint" style={{ margin: "0 0 10px" }}>
            Click to add a question of this type — you write the wording.
          </p>
          {QUESTION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              className="qb-type-chip"
              style={{ "--qb-color": `var(${TYPE_COLOR_VAR[opt.type]})` } as CSSProperties}
              onClick={() => addQuestion(opt.type)}
            >
              <span className="qb-type-chip-icon">{TYPE_ICON[opt.type]}</span>
              {opt.label}
            </button>
          ))}

          {visibleTemplates.length > 0 && (
            <>
              <h4 className="qb-palette-heading" style={{ marginTop: 16 }}>
                Start from a template
              </h4>
              <p className="field-hint" style={{ margin: "0 0 8px" }}>
                Loads a copy onto the canvas — fully yours to edit from there.
              </p>
              {visibleTemplates.map((t) => (
                <div key={t._id} className="qb-template-card" onClick={() => loadTemplate(t)}>
                  <b style={{ display: "block", fontSize: 12.5 }}>{t.name}</b>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t.questions.length} questions</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="qb-canvas">
          {questions.length === 0 && (
            <div className="qb-canvas-empty">
              <span style={{ fontSize: 28 }}>✎</span>
              <p className="subtitle" style={{ margin: 0 }}>
                Add a question type from the left, or start from a template.
              </p>
            </div>
          )}
          {questions.map((q, index) => (
            <div
              className="qb-question-card"
              key={q.localKey}
              style={{ "--qb-color": `var(${TYPE_COLOR_VAR[q.type]})` } as CSSProperties}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <select
                  value={q.type}
                  onChange={(e) => changeQuestionType(q.localKey, e.target.value as QuestionType)}
                  className="qb-type-select"
                >
                  {QUESTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {TYPE_ICON[opt.type]} {opt.label}
                    </option>
                  ))}
                </select>
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
          <button
            type="button"
            className="qb-add-another"
            onClick={() => addQuestion(questions.length > 0 ? questions[questions.length - 1].type : "star_1_5")}
          >
            + Add another question
          </button>
        </div>
      </div>

      <div className="qb-footer">
        {shownError && <p className="error-text" style={{ margin: 0 }}>{shownError}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-dark" onClick={() => handleSubmit(false)} disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </button>
          <button type="button" className="btn" onClick={() => handleSubmit(true)} disabled={submitting}>
            Save as draft
          </button>
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

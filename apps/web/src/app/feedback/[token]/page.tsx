"use client";

import { use, useEffect, useState } from "react";
import "./feedback-form.css";

interface Question {
  index: number;
  text: string;
  type: string;
  required: boolean;
  options: string[];
}
interface DemographicConfig {
  name: string;
  email: string;
  phone: string;
  ageGroup: string;
  gender: string;
}
interface FormData {
  businessName: string;
  groupTag: string | null;
  formLayout: "single_page" | "one_per_screen";
  demographicConfig: DemographicConfig;
  questions: Question[];
}

const AGE_GROUPS = ["18–24", "25–34", "35–44", "45–54", "55+"];
const GENDERS = ["Female", "Male", "Other / prefer not to say"];
const EMOJIS = ["😞", "🙁", "😐", "🙂", "😄"];

type DemoField = "name" | "email" | "phone" | "ageGroup" | "gender";
interface Step {
  kind: "question" | "demographic";
  question?: Question;
  demoField?: DemoField;
  label?: string;
  required?: boolean;
}

export default function FeedbackFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [demographics, setDemographics] = useState({ name: "", email: "", phone: "", ageGroup: "", gender: "" });
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/feedback/${token}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.status !== "ok") {
          setLoadError(result.message ?? "This link isn't available");
          return;
        }
        setData(result);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="ff-body">
        <div className="ff-phone">
          <div className="ff-form-body">Loading…</div>
        </div>
      </div>
    );
  }
  if (loadError || !data) {
    return (
      <div className="ff-body">
        <div className="ff-phone">
          <div className="ff-form-body">{loadError}</div>
        </div>
      </div>
    );
  }

  const demoSteps: Step[] = [];
  const d = data.demographicConfig;
  if (d.name !== "off") demoSteps.push({ kind: "demographic", demoField: "name", label: "Your name", required: d.name === "mandatory" });
  if (d.email !== "off") demoSteps.push({ kind: "demographic", demoField: "email", label: "Email address", required: d.email === "mandatory" });
  if (d.phone !== "off") demoSteps.push({ kind: "demographic", demoField: "phone", label: "Phone number", required: d.phone === "mandatory" });
  if (d.ageGroup !== "off") demoSteps.push({ kind: "demographic", demoField: "ageGroup", label: "Age group", required: d.ageGroup === "mandatory" });
  if (d.gender !== "off") demoSteps.push({ kind: "demographic", demoField: "gender", label: "Gender", required: d.gender === "mandatory" });

  const allSteps: Step[] = [...data.questions.map((q) => ({ kind: "question" as const, question: q })), ...demoSteps];

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/feedback/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.entries(answers).map(([index, value]) => ({ index: Number(index), value })),
        respondentName: demographics.name || null,
        respondentEmail: demographics.email || null,
        respondentPhone: demographics.phone || null,
        ageGroup: demographics.ageGroup,
        gender: demographics.gender,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const result = await res.json().catch(() => null);
      setSubmitError(result?.message ?? "Something went wrong");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="ff-body">
        <div className="ff-phone">
          <div className="ff-thankyou">
            <div className="ff-check">✓</div>
            <h2>Thanks for your feedback!</h2>
            <p>{data.businessName} received it — no account, no follow-up emails unless you asked for one.</p>
            <div className="ff-powered" style={{ marginTop: 30 }}>
              Powered by <b>oodel.score</b>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-body">
      <div className="ff-phone">
        {data.formLayout === "single_page" ? (
          <SinglePageForm
            data={data}
            answers={answers}
            setAnswers={setAnswers}
            demographics={demographics}
            setDemographics={setDemographics}
            demoSteps={demoSteps}
            submitting={submitting}
            submitError={submitError}
            onSubmit={submit}
          />
        ) : (
          <StepForm
            data={data}
            allSteps={allSteps}
            stepIndex={stepIndex}
            setStepIndex={setStepIndex}
            answers={answers}
            setAnswers={setAnswers}
            demographics={demographics}
            setDemographics={setDemographics}
            submitting={submitting}
            submitError={submitError}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}

function Header({ data }: { data: FormData }) {
  return (
    <div className="ff-header">
      <div className="ff-biz-name">{data.businessName}</div>
      {data.groupTag && <div className="ff-group-tag">{data.groupTag}</div>}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  big,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  big: boolean;
}) {
  if (question.type === "star_1_5") {
    const current = typeof value === "number" ? value : 0;
    return (
      <div className="ff-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= current ? "filled" : ""} onClick={() => onChange(n)}>
            ★
          </span>
        ))}
      </div>
    );
  }
  if (question.type === "nps_0_10") {
    return (
      <div>
        <div className="ff-nps-row">
          {Array.from({ length: 11 }, (_, n) => n).map((n) => (
            <button key={n} className={value === n ? "sel" : ""} onClick={() => onChange(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="ff-nps-labels">
          <span>Not likely</span>
          <span>Very likely</span>
        </div>
      </div>
    );
  }
  if (question.type === "yes_no") {
    return (
      <div className="ff-yn-row">
        <button className={value === "yes" ? "sel" : ""} onClick={() => onChange("yes")}>
          Yes
        </button>
        <button className={value === "no" ? "sel" : ""} onClick={() => onChange("no")}>
          No
        </button>
      </div>
    );
  }
  if (question.type === "emoji_scale") {
    const current = typeof value === "number" ? value : 0;
    return (
      <div className="ff-emoji-row">
        {EMOJIS.map((emoji, i) => (
          <span key={emoji} className={current === i + 1 ? "sel" : ""} onClick={() => onChange(i + 1)}>
            {emoji}
          </span>
        ))}
      </div>
    );
  }
  if (question.type === "multiple_choice" || question.type === "dropdown") {
    if (question.type === "dropdown") {
      return (
        <select className="ff-field-input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {question.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    return (
      <div className="ff-choice-row">
        {question.options.map((opt) => (
          <button key={opt} className={value === opt ? "sel" : ""} onClick={() => onChange(opt)}>
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === "multi_select") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="ff-choice-row">
        {question.options.map((opt) => (
          <button
            key={opt}
            className={selected.includes(opt) ? "sel" : ""}
            onClick={() => onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === "slider") {
    const current = typeof value === "number" ? value : 5;
    return (
      <div>
        <input type="range" className="ff-slider" min={0} max={10} value={current} onChange={(e) => onChange(Number(e.target.value))} />
        <div className="ff-slider-labels">
          <span>0</span>
          <span>{current}</span>
          <span>10</span>
        </div>
      </div>
    );
  }
  return (
    <textarea
      className="ff-open-text"
      placeholder="Type your answer…"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={big ? { minHeight: 120 } : undefined}
    />
  );
}

function DemoFieldInput({ field, value, onChange }: { field: DemoField; value: string; onChange: (value: string) => void }) {
  if (field === "ageGroup") {
    return (
      <select className="ff-field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {AGE_GROUPS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    );
  }
  if (field === "gender") {
    return (
      <select className="ff-field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="ff-field-input"
      type={field === "email" ? "email" : "text"}
      placeholder={field === "phone" ? "Phone number" : field === "email" ? "Email address" : "Your name"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface SharedFormProps {
  data: FormData;
  answers: Record<number, unknown>;
  setAnswers: (fn: (a: Record<number, unknown>) => Record<number, unknown>) => void;
  demographics: { name: string; email: string; phone: string; ageGroup: string; gender: string };
  setDemographics: (fn: (d: { name: string; email: string; phone: string; ageGroup: string; gender: string }) => typeof demographicsInit) => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}
const demographicsInit = { name: "", email: "", phone: "", ageGroup: "", gender: "" };

function SinglePageForm({
  data,
  answers,
  setAnswers,
  demographics,
  setDemographics,
  demoSteps,
  submitting,
  submitError,
  onSubmit,
}: SharedFormProps & { demoSteps: Step[] }) {
  return (
    <>
      <Header data={data} />
      <div className="ff-form-body">
        {data.questions.map((q) => (
          <div className="ff-q-block" key={q.index}>
            <div className="ff-q-text">
              {q.text} {q.required ? <span className="ff-q-required">*</span> : <span className="ff-q-optional-tag">(optional)</span>}
            </div>
            <QuestionInput
              question={q}
              value={answers[q.index]}
              onChange={(value) => setAnswers((a) => ({ ...a, [q.index]: value }))}
              big={false}
            />
          </div>
        ))}
        {demoSteps.length > 0 && (
          <>
            <div className="ff-demo-section-tag">A little about you</div>
            {demoSteps.map((step) => (
              <div className="ff-q-block" key={step.demoField}>
                <div className="ff-q-text">
                  {step.label} {step.required ? <span className="ff-q-required">*</span> : <span className="ff-q-optional-tag">(optional)</span>}
                </div>
                <DemoFieldInput
                  field={step.demoField as DemoField}
                  value={demographics[step.demoField as DemoField]}
                  onChange={(value) => setDemographics((d) => ({ ...d, [step.demoField as DemoField]: value }))}
                />
              </div>
            ))}
          </>
        )}
      </div>
      <div className="ff-footer">
        {submitError && <p className="ff-error">{submitError}</p>}
        <button className="ff-btn-submit" disabled={submitting} onClick={onSubmit}>
          {submitting ? "Submitting…" : "Submit feedback"}
        </button>
        <div className="ff-powered">
          Powered by <b>oodel.score</b>
        </div>
      </div>
    </>
  );
}

function StepForm({
  data,
  allSteps,
  stepIndex,
  setStepIndex,
  answers,
  setAnswers,
  demographics,
  setDemographics,
  submitting,
  submitError,
  onSubmit,
}: SharedFormProps & { allSteps: Step[]; stepIndex: number; setStepIndex: (fn: (i: number) => number) => void }) {
  const step = allSteps[stepIndex];
  const isLast = stepIndex === allSteps.length - 1;
  const pct = Math.round(((stepIndex + 1) / allSteps.length) * 100);

  function currentValue(): unknown {
    if (step.kind === "question") return answers[step.question!.index];
    return demographics[step.demoField as DemoField];
  }
  function setValue(value: unknown) {
    if (step.kind === "question") {
      setAnswers((a) => ({ ...a, [step.question!.index]: value }));
    } else {
      setDemographics((d) => ({ ...d, [step.demoField as DemoField]: value as string }));
    }
  }
  function canGoNext(): boolean {
    const required = step.kind === "question" ? step.question!.required : step.required;
    if (!required) return true;
    const value = currentValue();
    return value !== undefined && value !== null && value !== "";
  }

  return (
    <>
      <Header data={data} />
      <div className="ff-progress-track">
        <div className="ff-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ff-step-count">
        {stepIndex + 1} of {allSteps.length}
      </div>
      <div className="ff-form-body">
        <div className="ff-step-q">
          <div className="ff-q-text">
            {step.kind === "question" ? step.question!.text : step.label}{" "}
            {step.kind === "question" ? (
              step.question!.required ? (
                <span className="ff-q-required">*</span>
              ) : (
                <span className="ff-q-optional-tag">(optional)</span>
              )
            ) : step.required ? (
              <span className="ff-q-required">*</span>
            ) : (
              <span className="ff-q-optional-tag">(optional)</span>
            )}
          </div>
          {step.kind === "question" ? (
            <QuestionInput question={step.question!} value={currentValue()} onChange={setValue} big />
          ) : (
            <DemoFieldInput field={step.demoField as DemoField} value={(currentValue() as string) ?? ""} onChange={setValue} />
          )}
        </div>
      </div>
      <div className="ff-footer">
        {submitError && <p className="ff-error">{submitError}</p>}
        <div className="ff-btn-row">
          {stepIndex > 0 && (
            <button className="ff-btn-back" onClick={() => setStepIndex((i) => i - 1)}>
              ←
            </button>
          )}
          <button
            className="ff-btn-submit"
            disabled={submitting || !canGoNext()}
            onClick={() => (isLast ? onSubmit() : setStepIndex((i) => i + 1))}
          >
            {submitting ? "Submitting…" : isLast ? "Submit feedback" : "Next"}
          </button>
        </div>
        <div className="ff-powered">
          Powered by <b>oodel.score</b>
        </div>
      </div>
    </>
  );
}

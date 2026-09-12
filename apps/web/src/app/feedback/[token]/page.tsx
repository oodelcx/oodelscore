"use client";

import { use, useEffect, useState } from "react";

interface Question {
  index: number;
  text: string;
  type: string;
  required: boolean;
  options: string[];
}

/**
 * Functional respondent-facing form — deliberately plain, not the styled
 * mockup (oodel-score-feedback-form.html). That pixel-fidelity pass belongs
 * to the Frontend milestone; this exists so responses can actually be
 * created and Alert Rules / AI Insights have real data to work with.
 */
export default function FeedbackFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [businessName, setBusinessName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/feedback/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "This link isn't available");
          return;
        }
        setBusinessName(data.businessName);
        setQuestions(data.questions);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/feedback/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.entries(answers).map(([index, value]) => ({ index: Number(index), value })),
        respondentEmail: email || null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Something went wrong");
      return;
    }
    setSubmitted(true);
  }

  if (loading) return <main style={{ maxWidth: 480, margin: "60px auto", fontFamily: "sans-serif" }}>Loading…</main>;
  if (error && questions.length === 0) {
    return <main style={{ maxWidth: 480, margin: "60px auto", fontFamily: "sans-serif" }}>{error}</main>;
  }
  if (submitted) {
    return (
      <main style={{ maxWidth: 480, margin: "60px auto", fontFamily: "sans-serif" }}>
        <h1>Thank you!</h1>
        <p>Your feedback for {businessName} has been submitted.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>{businessName}</h1>
      <p style={{ color: "#666" }}>We&apos;d love your feedback.</p>

      {questions.map((q) => (
        <div key={q.index} style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            {q.text} {q.required && <span style={{ color: "crimson" }}>*</span>}
          </label>
          {renderQuestionInput(q, answers[q.index] ?? "", (value) => setAnswers((a) => ({ ...a, [q.index]: value })))}
        </div>
      ))}

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Email (optional)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit feedback"}
      </button>
    </main>
  );
}

function renderQuestionInput(question: Question, value: string, onChange: (value: string) => void) {
  if (question.type === "star_1_5") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  }
  if (question.type === "nps_0_10") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {Array.from({ length: 11 }, (_, n) => n).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  }
  if (question.type === "yes_no") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (question.type === "multiple_choice" || question.type === "dropdown") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {question.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} />;
}

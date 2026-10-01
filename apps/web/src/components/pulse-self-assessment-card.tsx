"use client";

import { useEffect, useState } from "react";

interface SelfAssessmentView {
  quarter: string;
  questions: { question: string; answer: string }[];
  submittedAt: string | null;
  editable: boolean;
}

/**
 * The quarterly self-assessment that feeds half of CX/Colleague Pulse's
 * Culture dimension (see cxpulse/compute.ts cultureScore). Read-only for a
 * branch or a team member (the account owner, or — for a branch — its
 * parent org, is who actually answers); editable shows a Save button.
 */
export function PulseSelfAssessmentCard({ apiPath, title }: { apiPath: string; title: string }) {
  const [data, setData] = useState<SelfAssessmentView | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiPath)
      .then((res) => res.json())
      .then((json) => {
        if (json.status !== "ok") {
          setError(json.message ?? "Couldn't load the self-assessment");
          return;
        }
        setData(json);
      })
      .finally(() => setLoading(false));
  }, [apiPath]);

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    const answers = data.questions.map((q, i) => ({ question: q.question, answer: drafts[i] ?? q.answer }));
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || json.status !== "ok") {
      setError(json.message ?? "Couldn't save");
      return;
    }
    setData(json);
    setDrafts({});
    setSavedAt(json.submittedAt);
  }

  if (loading) return null;
  if (error && !data) return null;
  if (!data || data.questions.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>{title}</h3>
      <p className="card-sub">
        {data.quarter} — answered once per quarter, feeds the Culture dimension of your Pulse score.
        {!data.editable && " Your parent organization answers this centrally."}
      </p>
      {data.questions.map((q, i) => (
        <div className="field" key={q.question} style={{ marginBottom: 10 }}>
          <label>{q.question}</label>
          {data.editable ? (
            <textarea
              style={{ width: "100%", minHeight: 50 }}
              value={drafts[i] ?? q.answer}
              onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
            />
          ) : (
            <p className="subtitle" style={{ margin: 0 }}>
              {q.answer || "— not yet answered —"}
            </p>
          )}
        </div>
      ))}
      {data.editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-dark btn-sm" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save answers"}
          </button>
          {error && <span className="error-text">{error}</span>}
          {!error && savedAt && <span className="subtitle">Saved.</span>}
        </div>
      )}
    </div>
  );
}

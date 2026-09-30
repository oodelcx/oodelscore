"use client";

import { useEffect, useState } from "react";

const LADDER_LABELS = ["Absent", "Ad hoc", "Defined", "Embedded"] as const;
const DIMENSION_LABELS: Record<string, string> = {
  authority: "Authority",
  numbers: "Numbers",
  culture: "Culture",
  hearing: "Hearing",
  ownership: "Ownership",
  rhythm: "Rhythm",
};
const DIMENSION_ORDER = ["authority", "numbers", "culture", "hearing", "ownership", "rhythm"];

interface CompassQuestionView {
  key: string;
  dimension: string;
  text: string;
  value: 0 | 1 | 2 | 3 | null;
}

interface CompassResultView {
  dimensionScores: { dimension: string; score: 0 | 1 | 2 | 3 }[];
  overallScore: 0 | 1 | 2 | 3;
  stage: "established" | "emerging";
  gatingDimensions: string[];
  index: number;
  completedAt: string;
}

interface CompassView {
  assessmentStatus: "draft" | "completed";
  industry: string;
  questions: CompassQuestionView[];
  answeredCount: number;
  totalCount: number;
  result: CompassResultView | null;
}

function groupByDimension(questions: CompassQuestionView[]): [string, CompassQuestionView[]][] {
  const groups = new Map<string, CompassQuestionView[]>();
  for (const q of questions) {
    if (!groups.has(q.dimension)) groups.set(q.dimension, []);
    groups.get(q.dimension)!.push(q);
  }
  return DIMENSION_ORDER.filter((d) => groups.has(d)).map((d) => [d, groups.get(d)!]);
}

/** Shared by Business and Group — same owner-agnostic assessment, same UI, only the API base path differs. */
export function CompassClient({ apiPath }: { apiPath: string }) {
  const [view, setView] = useState<CompassView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  function load() {
    fetch(apiPath)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setView(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(load, [apiPath]);

  async function answer(q: CompassQuestionView, value: 0 | 1 | 2 | 3) {
    setSaving(q.key);
    setCompleteError(null);
    // Optimistic update so clicking a ladder value feels instant.
    setView((prev) => (prev ? { ...prev, questions: prev.questions.map((qq) => (qq.key === q.key ? { ...qq, value } : qq)) } : prev));
    await fetch(`${apiPath}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionKey: q.key, value }),
    });
    setSaving(null);
    load();
  }

  async function complete() {
    setCompleting(true);
    setCompleteError(null);
    const res = await fetch(`${apiPath}/submit`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setCompleting(false);
    if (!res.ok) {
      setCompleteError(data?.message ?? "Failed to complete assessment");
      return;
    }
    load();
  }

  async function restart() {
    if (!confirm("Retake the assessment? This clears every answer and this result.")) return;
    setRestarting(true);
    await fetch(`${apiPath}/restart`, { method: "POST" });
    setRestarting(false);
    load();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!view) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <h1>OodelCX Compass</h1>
      <p className="subtitle">
        A diagnostic, not another score to chase — six ANCHOR dimensions of how experience management actually
        works here, each scored on the weakest answer, never the average. One absent dimension holds the whole
        account back from &ldquo;Established,&rdquo; on purpose.
      </p>

      {view.assessmentStatus === "completed" && view.result ? (
        <CompassResultsView result={view.result} onRestart={restart} restarting={restarting} />
      ) : (
        <CompassQuestionsView
          view={view}
          onAnswer={answer}
          saving={saving}
          onComplete={complete}
          completing={completing}
          completeError={completeError}
        />
      )}
    </div>
  );
}

function stageLabel(stage: "established" | "emerging"): string {
  return stage === "established" ? "Established" : "Emerging";
}

function CompassResultsView({
  result,
  onRestart,
  restarting,
}: {
  result: CompassResultView;
  onRestart: () => void;
  restarting: boolean;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-head" style={{ marginBottom: 6 }}>
          <div>
            <span className={`pill ${result.stage === "established" ? "pill-green" : "pill-amber"}`} style={{ fontSize: 13 }}>
              {stageLabel(result.stage)}
            </span>
            <span className="subtitle" style={{ marginLeft: 10 }}>
              Compass Index {result.index}/100 · completed {new Date(result.completedAt).toLocaleDateString()}
            </span>
          </div>
          <button className="btn btn-sm" disabled={restarting} onClick={onRestart}>
            {restarting ? "Restarting…" : "Retake assessment"}
          </button>
        </div>
        <p className="card-sub" style={{ margin: 0 }}>
          {result.stage === "established"
            ? "Every dimension scores at least “Defined” — experience management runs as a system here, not as isolated effort."
            : `Held back by ${result.gatingDimensions.map((d) => DIMENSION_LABELS[d]).join(", ")} — bring the weakest dimension above “Ad hoc” to move to Established.`}
        </p>
        <p className="subtitle" style={{ marginTop: 10 }}>
          The Index above is a trend-only 0-100 average — always read it next to the stage badge, never instead of
          it: a rising Index while still &ldquo;Emerging&rdquo; means real progress that just hasn&apos;t cleared the
          gate yet.
        </p>
      </div>

      <div className="grid grid-2">
        {result.dimensionScores.map((d) => {
          const isGating = result.gatingDimensions.includes(d.dimension);
          return (
            <div key={d.dimension} className="card">
              <div className="page-head" style={{ marginBottom: 6 }}>
                <b>{DIMENSION_LABELS[d.dimension]}</b>
                {isGating && <span className="pill pill-amber">Gating</span>}
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(d.score / 3) * 100}%`,
                    background: d.score >= 2 ? "var(--green)" : "var(--amber)",
                  }}
                />
              </div>
              <div className="subtitle">{LADDER_LABELS[d.score]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompassQuestionsView({
  view,
  onAnswer,
  saving,
  onComplete,
  completing,
  completeError,
}: {
  view: CompassView;
  onAnswer: (q: CompassQuestionView, value: 0 | 1 | 2 | 3) => void;
  saving: string | null;
  onComplete: () => void;
  completing: boolean;
  completeError: string | null;
}) {
  const allAnswered = view.answeredCount >= view.totalCount;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, position: "sticky", top: 0, zIndex: 2 }}>
        <div className="page-head" style={{ marginBottom: 4 }}>
          <b>
            {view.answeredCount} of {view.totalCount} answered
          </b>
          <button className="btn btn-dark btn-sm" disabled={!allAnswered || completing} onClick={onComplete}>
            {completing ? "Completing…" : "Complete assessment"}
          </button>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${view.totalCount ? (view.answeredCount / view.totalCount) * 100 : 0}%` }} />
        </div>
        {completeError && (
          <p className="error-text" style={{ marginBottom: 0 }}>
            {completeError}
          </p>
        )}
      </div>

      {groupByDimension(view.questions).map(([dimension, questions]) => (
        <div key={dimension} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{DIMENSION_LABELS[dimension]}</h3>
          {questions.map((q) => (
            <div key={q.key} style={{ marginBottom: 18 }}>
              <p style={{ marginBottom: 8 }}>{q.text}</p>
              <div className="btn-group">
                {LADDER_LABELS.map((label, value) => (
                  <button
                    key={value}
                    className={`btn btn-sm ${q.value === value ? "btn-dark" : ""}`}
                    disabled={saving === q.key}
                    onClick={() => onAnswer(q, value as 0 | 1 | 2 | 3)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

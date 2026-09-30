"use client";

import { useEffect, useState } from "react";

const LADDER_LABELS = ["Absent", "Ad hoc", "Defined", "Embedded"] as const;
const LADDER_COLORS = ["var(--red)", "var(--amber)", "#5DA5D6", "var(--green)"];
const DIMENSION_LABELS: Record<string, string> = {
  authority: "Authority",
  numbers: "Numbers",
  culture: "Culture",
  hearing: "Hearing",
  ownership: "Ownership",
  rhythm: "Rhythm",
};
const DIMENSION_ICONS: Record<string, string> = {
  authority: "⚖️",
  numbers: "📊",
  culture: "🌱",
  hearing: "👂",
  ownership: "🧭",
  rhythm: "🔁",
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

/** Four connected rungs — the shared visual vocabulary for "how far up the ladder" a dimension sits. */
function LadderTrack({
  value,
  onSelect,
  disabled,
}: {
  value: 0 | 1 | 2 | 3 | null;
  onSelect?: (v: 0 | 1 | 2 | 3) => void;
  disabled?: boolean;
}) {
  const interactive = !!onSelect;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {LADDER_LABELS.map((label, i) => {
        const filled = value !== null && i <= value;
        const isSelected = value === i;
        return (
          <button
            key={label}
            type="button"
            disabled={disabled || !interactive}
            onClick={() => onSelect?.(i as 0 | 1 | 2 | 3)}
            title={label}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 6,
              border: isSelected ? `2px solid ${LADDER_COLORS[i]}` : "1px solid var(--border)",
              background: filled ? LADDER_COLORS[i] : "var(--bg)",
              color: filled ? "#fff" : "var(--text-3)",
              fontSize: 10.5,
              fontWeight: isSelected ? 700 : 500,
              cursor: interactive && !disabled ? "pointer" : "default",
              transition: "all 0.12s ease",
              lineHeight: 1.3,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
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
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: result.stage === "established" ? "linear-gradient(135deg, var(--green) 0%, #0a6e4f 100%)" : "linear-gradient(135deg, var(--amber) 0%, #b8863f 100%)",
          color: "#fff",
          border: "none",
        }}
      >
        <div className="page-head" style={{ marginBottom: 10, alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "2px solid rgba(255,255,255,0.4)",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{result.index}</div>
              <div style={{ fontSize: 9, opacity: 0.85 }}>/ 100</div>
            </div>
            <div>
              <span
                className="pill"
                style={{ background: "rgba(255,255,255,0.22)", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", fontSize: 13 }}
              >
                {stageLabel(result.stage)}
              </span>
              <p style={{ margin: "6px 0 0", fontSize: 12.5, opacity: 0.9 }}>
                Completed {new Date(result.completedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            className="btn btn-sm"
            disabled={restarting}
            onClick={onRestart}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.5)" }}
          >
            {restarting ? "Restarting…" : "Retake assessment"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 14, maxWidth: 640 }}>
          {result.stage === "established"
            ? "Every dimension scores at least “Defined” — experience management runs as a system here, not as isolated effort."
            : `Held back by ${result.gatingDimensions.map((d) => DIMENSION_LABELS[d]).join(", ")} — bring the weakest dimension above “Ad hoc” to move to Established.`}
        </p>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, opacity: 0.85 }}>
          The Index above is a trend-only 0–100 average — always read it next to the stage badge, never instead of
          it: a rising Index while still &ldquo;Emerging&rdquo; means real progress that just hasn&apos;t cleared the
          gate yet.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {result.dimensionScores.map((d) => {
          const isGating = result.gatingDimensions.includes(d.dimension);
          return (
            <div
              key={d.dimension}
              className="card"
              style={isGating ? { borderColor: "var(--amber)", boxShadow: "0 0 0 1px var(--amber)" } : undefined}
            >
              <div className="page-head" style={{ marginBottom: 10 }}>
                <b style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 17 }}>{DIMENSION_ICONS[d.dimension]}</span>
                  {DIMENSION_LABELS[d.dimension]}
                </b>
                {isGating && <span className="pill pill-amber">Gating</span>}
              </div>
              <LadderTrack value={d.score} />
              <div className="subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
                Currently: <b style={{ color: "var(--text-1)" }}>{LADDER_LABELS[d.score]}</b>
              </div>
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
  const dimensions = groupByDimension(view.questions);

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, position: "sticky", top: 0, zIndex: 2 }}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <b>
            {view.answeredCount} of {view.totalCount} answered
          </b>
          <button className="btn btn-dark btn-sm" disabled={!allAnswered || completing} onClick={onComplete}>
            {completing ? "Completing…" : "Complete assessment"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {dimensions.map(([dimension, questions]) => {
            const answered = questions.filter((q) => q.value !== null).length;
            const done = answered >= questions.length;
            return (
              <div key={dimension} style={{ flex: 1, textAlign: "center" }} title={`${DIMENSION_LABELS[dimension]}: ${answered}/${questions.length}`}>
                <div className="bar-track" style={{ height: 6 }}>
                  <div
                    className="bar-fill"
                    style={{ width: `${(answered / questions.length) * 100}%`, background: done ? "var(--green)" : "var(--accent)" }}
                  />
                </div>
                <div style={{ fontSize: 15, marginTop: 4 }}>{DIMENSION_ICONS[dimension]}</div>
              </div>
            );
          })}
        </div>
        {completeError && (
          <p className="error-text" style={{ marginBottom: 0, marginTop: 8 }}>
            {completeError}
          </p>
        )}
      </div>

      {dimensions.map(([dimension, questions]) => (
        <div key={dimension} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 19 }}>{DIMENSION_ICONS[dimension]}</span>
            {DIMENSION_LABELS[dimension]}
          </h3>
          {questions.map((q) => (
            <div key={q.key} style={{ marginBottom: 18 }}>
              <p style={{ marginBottom: 8 }}>{q.text}</p>
              <LadderTrack value={q.value} disabled={saving === q.key} onSelect={(value) => onAnswer(q, value)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

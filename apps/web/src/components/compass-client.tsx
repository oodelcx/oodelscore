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
  evidence?: CompassEvidenceEntry[];
  completedAt: string;
}

interface CompassEvidenceEntry {
  dimension: string;
  selfScore: 0 | 1 | 2 | 3;
  evidenceScore: 0 | 1 | 2 | 3;
  status: "confirmed" | "overstated" | "understated" | "insufficient_data";
}

interface CompassHistoryEntry {
  overallScore: 0 | 1 | 2 | 3;
  stage: "established" | "emerging";
  index: number;
  dimensionScores?: { dimension: string; score: 0 | 1 | 2 | 3 }[];
  evidence?: CompassEvidenceEntry[];
  completedAt: string;
  archivedAt: string;
}

type EvidenceStatus = "confirmed" | "overstated" | "understated" | "insufficient_data";

interface EvidenceIndicator {
  key: string;
  label: string;
  met: boolean;
}

interface DimensionEvidence {
  dimension: string;
  selfScore: 0 | 1 | 2 | 3;
  evidenceScore: 0 | 1 | 2 | 3;
  indicators: EvidenceIndicator[];
  status: EvidenceStatus;
}

interface EvidenceFusionView {
  dimensions: DimensionEvidence[];
  computedAt: string;
}

interface CompassView {
  assessmentStatus: "draft" | "completed";
  industry: string;
  questions: CompassQuestionView[];
  answeredCount: number;
  totalCount: number;
  result: CompassResultView | null;
  dueForReassessment: boolean;
  reassessmentDueAt: string | null;
  history: CompassHistoryEntry[];
  evidenceFusion: EvidenceFusionView | null;
  reach?: ReachCardView[];
}

interface ReachCardView {
  dimension: string;
  label: string;
  priority: "high" | "medium" | "low";
  recognize: string;
  elevate: string;
  align: string;
  connect: { label: string; href: string };
  habituate: string;
}

function ReachCards({ cards, apiPath, reassessmentDueAt }: { cards: ReachCardView[]; apiPath: string; reassessmentDueAt: string | null }) {
  const [team, setTeam] = useState<{ userId: string; label: string }[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [sending, setSending] = useState<string | null>(null);
  const teamPath = apiPath.includes("/group/") ? "/api/group/team" : "/api/business/team";

  useEffect(() => {
    fetch(teamPath)
      .then((r) => r.json())
      .then((d) => setTeam(Array.isArray(d.team) ? d.team : Array.isArray(d.members) ? d.members : []))
      .catch(() => setTeam([]));
  }, [teamPath]);

  async function send(dimension: string) {
    const toUserId = picked[dimension];
    if (!toUserId) {
      setMsg((m) => ({ ...m, [dimension]: { ok: false, text: "Choose who should get it first." } }));
      return;
    }
    setSending(dimension);
    const res = await fetch(`${apiPath}/elevate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimension, toUserId }),
    });
    const data = await res.json().catch(() => null);
    setSending(null);
    setMsg((m) => ({
      ...m,
      [dimension]: res.ok ? { ok: true, text: `Sent to ${data?.sentTo ?? "your colleague"}.` } : { ok: false, text: data?.message ?? "It could not be sent." },
    }));
  }

  return (
    <div className="card" id="reach" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>What to do next</h3>
      <p className="card-sub" style={{ margin: "0 0 14px" }}>
        One card for each area that is below Embedded or that the evidence does not back up. Each follows the REACH steps: Recognize, Elevate, Align, Connect, Habituate.
      </p>
      {cards.length === 0 ? (
        <p className="subtitle">Every area is Embedded and confirmed by activity. Nothing to recommend right now.</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {cards.map((c) => (
            <div key={c.dimension} className="card" style={{ background: "var(--bg-2, #f7f7f5)", minWidth: 0 }}>
              <div className="page-head" style={{ marginBottom: 8 }}>
                <b>{c.label}</b>
                <span className={`pill ${c.priority === "high" ? "pill-red" : "pill-amber"}`}>{c.priority === "high" ? "Act first" : "Next"}</span>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                <b>Recognize.</b> {c.recognize}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                <b>Elevate.</b> {c.elevate}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <select
                  aria-label={`Who should get the ${c.label} recommendation`}
                  value={picked[c.dimension] ?? ""}
                  onChange={(e) => setPicked((p) => ({ ...p, [c.dimension]: e.target.value }))}
                  style={{ minWidth: 0, flex: "1 1 160px" }}
                >
                  <option value="">Choose a colleague…</option>
                  {team.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" disabled={sending === c.dimension} onClick={() => send(c.dimension)}>
                  {sending === c.dimension ? "Sending…" : "Send by email"}
                </button>
              </div>
              {msg[c.dimension] && (
                <p className={msg[c.dimension].ok ? "callout" : "error-text"} role="status" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
                  {msg[c.dimension].text}
                </p>
              )}
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                <b>Align.</b> {c.align}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                <b>Connect.</b> <a href={c.connect.href}>{c.connect.label} →</a>
              </p>
              <p style={{ margin: 0, fontSize: 13 }}>
                <b>Habituate.</b> {c.habituate}
                {reassessmentDueAt ? ` Compass is due again on ${new Date(reassessmentDueAt).toLocaleDateString()}.` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
        // Cumulative fill shows "how far up the ladder" the selection sits
        // (same convention as a star rating), but a passed rung and the
        // actually-selected rung must never look the same state — otherwise
        // picking "Ad hoc" reads as if "Absent" got selected too. Only the
        // selected rung gets the solid color + checkmark; passed rungs get a
        // light tint outline so the two states are visually unambiguous.
        const passed = value !== null && i < value;
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
              border: isSelected ? `2px solid ${LADDER_COLORS[i]}` : passed ? `1px solid ${LADDER_COLORS[i]}` : "1px solid var(--border)",
              background: isSelected ? LADDER_COLORS[i] : passed ? `${LADDER_COLORS[i]}22` : "var(--bg)",
              color: isSelected ? "#fff" : passed ? LADDER_COLORS[i] : "var(--text-3)",
              fontSize: 10.5,
              fontWeight: isSelected ? 700 : 500,
              cursor: interactive && !disabled ? "pointer" : "default",
              transition: "all 0.12s ease",
              lineHeight: 1.3,
            }}
          >
            {isSelected ? `✓ ${label}` : label}
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
        <CompassResultsView
          result={view.result}
          onRestart={restart}
          restarting={restarting}
          dueForReassessment={view.dueForReassessment}
          reassessmentDueAt={view.reassessmentDueAt}
          history={view.history}
          evidenceFusion={view.evidenceFusion}
          reach={view.reach ?? []}
          apiPath={apiPath}
        />
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

const EVIDENCE_STATUS_META: Record<EvidenceStatus, { label: string; color: string }> = {
  confirmed: { label: "Confirmed by activity", color: "var(--green)" },
  overstated: { label: "Self-score looks overstated", color: "var(--red)" },
  understated: { label: "Doing better than self-reported", color: "#5DA5D6" },
  insufficient_data: { label: "Not enough activity data yet", color: "var(--text-3)" },
};

function EvidenceFusionCard({ evidenceFusion }: { evidenceFusion: EvidenceFusionView }) {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Evidence Fusion</h3>
      <p className="card-sub" style={{ margin: "0 0 14px" }}>
        Self-reported Compass answers checked against what&rsquo;s actually happening in the account — a goal set, a
        decision owned, a case resolved with a note on it. A dimension with no real activity behind it yet reads
        &ldquo;not enough activity data,&rdquo; not a score, exactly as it should once that data starts showing up.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {evidenceFusion.dimensions.map((d) => {
          const meta = EVIDENCE_STATUS_META[d.status];
          return (
            <div key={d.dimension} className="card" style={{ background: "var(--bg-2, #f7f7f5)" }}>
              <div className="page-head" style={{ marginBottom: 8 }}>
                <b style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{DIMENSION_ICONS[d.dimension]}</span>
                  {DIMENSION_LABELS[d.dimension]}
                </b>
                <span className="pill" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}>
                  {meta.label}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12.5 }}>
                <span>
                  Self-reported: <b style={{ color: "var(--text-1)" }}>{LADDER_LABELS[d.selfScore]}</b>
                </span>
                <span>
                  Evidence: <b style={{ color: "var(--text-1)" }}>{LADDER_LABELS[d.evidenceScore]}</b>
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {d.indicators.map((ind) => (
                  <li key={ind.key} style={{ color: ind.met ? "var(--text-1)" : "var(--text-3)", marginBottom: 2 }}>
                    {ind.met ? "✓" : "—"} {ind.label}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}


interface ProgressRow {
  key: string;
  completedAt: string;
  stage: "established" | "emerging";
  index: number;
  isCurrent: boolean;
  selfByDim: Record<string, number>;
  evidenceByDim: Record<string, CompassEvidenceEntry | undefined>;
}

/**
 * Every completed assessment, oldest first, with the self-reported score next
 * to what real activity showed at the time ("claimed / proven"). The point is
 * to see whether the two move together: a rising claim with flat evidence is
 * a warning, a rising claim followed by rising evidence is real progress.
 */
function ProgressOverTime({
  history,
  result,
  evidenceFusion,
}: {
  history: CompassHistoryEntry[];
  result: CompassResultView;
  evidenceFusion: EvidenceFusionView | null;
}) {
  const rows: ProgressRow[] = [...history].reverse().map((h) => ({
    key: h.completedAt,
    completedAt: h.completedAt,
    stage: h.stage,
    index: h.index,
    isCurrent: false,
    selfByDim: Object.fromEntries((h.dimensionScores ?? []).map((d) => [d.dimension, d.score])),
    evidenceByDim: Object.fromEntries((h.evidence ?? []).map((e) => [e.dimension, e])),
  }));
  rows.push({
    key: "current",
    completedAt: result.completedAt,
    stage: result.stage,
    index: result.index,
    isCurrent: true,
    selfByDim: Object.fromEntries(result.dimensionScores.map((d) => [d.dimension, d.score])),
    evidenceByDim: Object.fromEntries(
      (evidenceFusion
        ? evidenceFusion.dimensions.map((d) => ({ dimension: d.dimension, selfScore: d.selfScore, evidenceScore: d.evidenceScore, status: d.status }))
        : (result.evidence ?? [])
      ).map((e) => [e.dimension, e as CompassEvidenceEntry])
    ),
  });
  if (rows.length < 2) return null;

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Progress over time</h3>
      <p className="card-sub" style={{ margin: "0 0 14px" }}>
        Each cell shows <b>what you reported</b> and <b>what your activity showed</b> at the time (reported / shown, on the
        0&ndash;3 ladder). Progress is real when both numbers rise together.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="clean">
          <thead>
            <tr>
              <th>Completed</th>
              <th>Stage</th>
              <th>Index</th>
              {DIMENSION_ORDER.map((d) => (
                <th key={d}>{DIMENSION_LABELS[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  {new Date(r.completedAt).toLocaleDateString()}
                  {r.isCurrent && <span className="pill" style={{ marginLeft: 8 }}>Current</span>}
                </td>
                <td>{stageLabel(r.stage)}</td>
                <td>{r.index} / 100</td>
                {DIMENSION_ORDER.map((d) => {
                  const ev = r.evidenceByDim[d];
                  const meta = ev ? EVIDENCE_STATUS_META[ev.status] : null;
                  return (
                    <td key={d} style={{ whiteSpace: "nowrap" }}>
                      <b>{r.selfByDim[d] ?? "–"}</b>
                      {ev ? (
                        <span style={{ color: meta?.color }}> / {ev.evidenceScore}</span>
                      ) : (
                        <span style={{ color: "var(--text-3)" }}> / –</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="card-sub" style={{ margin: "10px 0 0", fontSize: 12 }}>
        <span style={{ color: "var(--green)" }}>Green</span>: confirmed by activity &middot;{" "}
        <span style={{ color: "var(--red)" }}>red</span>: reported higher than activity showed &middot;{" "}
        <span style={{ color: "#5DA5D6" }}>blue</span>: activity showed more than reported. Dashes mean no activity
        snapshot was kept for that assessment.
      </p>
    </div>
  );
}

function CompassResultsView({
  result,
  onRestart,
  restarting,
  dueForReassessment,
  reassessmentDueAt,
  history,
  evidenceFusion,
  reach,
  apiPath,
}: {
  reach: ReachCardView[];
  apiPath: string;
  result: CompassResultView;
  onRestart: () => void;
  restarting: boolean;
  dueForReassessment: boolean;
  reassessmentDueAt: string | null;
  history: CompassHistoryEntry[];
  evidenceFusion: EvidenceFusionView | null;
}) {
  return (
    <div>
      {dueForReassessment && (
        <div className="callout" style={{ background: "var(--amber-bg)", borderColor: "var(--amber)", marginBottom: 16 }}>
          <b>Due for reassessment</b> — it&rsquo;s been a while since this account&rsquo;s last completed Compass
          assessment{reassessmentDueAt ? ` (due ${new Date(reassessmentDueAt).toLocaleDateString()})` : ""}. Retake it
          below to see if anything&rsquo;s changed.
        </div>
      )}
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

      {history.length > 0 && <ProgressOverTime history={history} result={result} evidenceFusion={evidenceFusion} />}

      {evidenceFusion && <EvidenceFusionCard evidenceFusion={evidenceFusion} />}

      <ReachCards cards={reach} apiPath={apiPath} reassessmentDueAt={reassessmentDueAt} />
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
